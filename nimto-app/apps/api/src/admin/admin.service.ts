import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";
import { PERMISSION_CATALOG, SUPER_ADMIN_ROLE } from "../auth/permissions";

type ActorContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async seedPermissionCatalog() {
    await this.prisma.$transaction(
      PERMISSION_CATALOG.map((permission) =>
        this.prisma.permission.upsert({
          where: { key: permission.key },
          update: { description: permission.description },
          create: permission,
        }),
      ),
    );
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  listRoles() {
    return this.prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: {
          include: { permission: true },
          orderBy: { permission: { key: "asc" } },
        },
        _count: { select: { users: true } },
      },
    });
  }

  async createRole(dto: CreateRoleDto, context: ActorContext) {
    await this.assertPermissionsExist(dto.permissionKeys ?? []);
    const role = await this.prisma.role.create({
      data: {
        name: this.normalizeRoleName(dto.name),
        description: dto.description,
        permissions: {
          create: (dto.permissionKeys ?? []).map((key) => ({
            permission: { connect: { key } },
          })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });

    await this.record(context, "role.created", "Role", role.id, {
      name: role.name,
    });
    return role;
  }

  async updateRole(roleId: string, dto: UpdateRoleDto, context: ActorContext) {
    const existing = await this.getRole(roleId);
    if (existing.name === SUPER_ADMIN_ROLE) {
      throw new ForbiddenException("SUPER_ADMIN role cannot be changed.");
    }

    await this.assertPermissionsExist(dto.permissionKeys ?? []);
    const role = await this.prisma.$transaction(async (tx) => {
      if (dto.permissionKeys) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
      }

      return tx.role.update({
        where: { id: roleId },
        data: {
          name: dto.name ? this.normalizeRoleName(dto.name) : undefined,
          description: dto.description,
          permissions: dto.permissionKeys
            ? {
                create: dto.permissionKeys.map((key) => ({
                  permission: { connect: { key } },
                })),
              }
            : undefined,
        },
        include: { permissions: { include: { permission: true } } },
      });
    });

    await this.record(context, "role.updated", "Role", role.id, {
      name: role.name,
    });
    return role;
  }

  async deleteRole(roleId: string, context: ActorContext) {
    const role = await this.getRole(roleId);
    if (role.isSystem || role.name === SUPER_ADMIN_ROLE) {
      throw new ForbiddenException("System roles cannot be deleted.");
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    await this.record(context, "role.deleted", "Role", roleId, {
      name: role.name,
    });
    return { success: true };
  }

  listStaff() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });
  }

  async createStaff(dto: CreateStaffDto, context: ActorContext) {
    await this.assertRolesAssignable(dto.roleIds);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email: dto.email.trim().toLowerCase(),
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        roles: {
          create: dto.roleIds.map((roleId) => ({
            role: { connect: { id: roleId } },
          })),
        },
      },
      include: { roles: { include: { role: true } } },
    });

    await this.record(context, "staff.created", "User", user.id, {
      email: user.email,
    });
    return user;
  }

  async updateStaff(
    userId: string,
    dto: UpdateStaffDto,
    context: ActorContext,
  ) {
    await this.assertNotProtectedSuperAdmin(userId, dto);
    if (dto.roleIds) {
      await this.assertRolesAssignable(dto.roleIds);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 12)
      : undefined;
    const user = await this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId } });
      }

      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          name: dto.name?.trim(),
          passwordHash,
          status: dto.status,
          blockedAt: dto.status === UserStatus.BLOCKED ? new Date() : undefined,
          deactivatedAt:
            dto.status === UserStatus.DEACTIVATED ? new Date() : undefined,
          deletionRequestedAt:
            dto.status === UserStatus.PENDING_DELETION ? new Date() : undefined,
          roles: dto.roleIds
            ? {
                create: dto.roleIds.map((roleId) => ({
                  role: { connect: { id: roleId } },
                })),
              }
            : undefined,
        },
        include: { roles: { include: { role: true } } },
      });

      if (dto.status && dto.status !== UserStatus.ACTIVE) {
        await tx.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revocationReason:
              dto.status === UserStatus.BLOCKED
                ? "ACCOUNT_BLOCKED"
                : dto.status === UserStatus.DEACTIVATED
                  ? "ACCOUNT_DEACTIVATED"
                  : "ACCOUNT_PENDING_DELETION",
          },
        });
      }

      if (passwordHash) {
        await tx.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date(), revocationReason: "PASSWORD_CHANGED" },
        });
      }

      return updated;
    });

    await this.record(context, "staff.updated", "User", user.id, {
      email: user.email,
      status: user.status,
    });
    return user;
  }

  listSessions() {
    return this.prisma.userSession.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true, status: true } },
      },
    });
  }

  async forceLogout(sessionId: string, context: ActorContext) {
    const session = await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revocationReason: "ADMIN_FORCE_LOGOUT",
      },
    });

    await this.record(
      context,
      "session.force_logout",
      "UserSession",
      session.id,
      {
        userId: session.userId,
      },
    );
    return { success: true };
  }

  listAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }

  private async getRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException("Role not found.");
    }
    return role;
  }

  private async assertPermissionsExist(keys: string[]) {
    if (!keys.length) {
      return;
    }

    const count = await this.prisma.permission.count({
      where: { key: { in: keys } },
    });
    if (count !== new Set(keys).size) {
      throw new BadRequestException("One or more permissions do not exist.");
    }
  }

  private async assertRolesAssignable(roleIds: string[]) {
    const roles = await this.prisma.role.findMany({
      where: { id: { in: roleIds } },
    });
    if (roles.length !== new Set(roleIds).size) {
      throw new BadRequestException("One or more roles do not exist.");
    }

    if (roles.some((role) => role.name === SUPER_ADMIN_ROLE)) {
      throw new ForbiddenException("SUPER_ADMIN role cannot be assigned here.");
    }
  }

  private async assertNotProtectedSuperAdmin(
    userId: string,
    dto: UpdateStaffDto,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new NotFoundException("User not found.");
    }

    const isSuperAdmin = user.roles.some(
      (userRole) => userRole.role.name === SUPER_ADMIN_ROLE,
    );
    if (isSuperAdmin && (dto.status || dto.roleIds || dto.password)) {
      throw new ForbiddenException("Super Admin account cannot be restricted.");
    }
  }

  private normalizeRoleName(name: string) {
    return name.trim().toUpperCase().replace(/\s+/g, "_");
  }

  private record(
    context: ActorContext,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.audit.record({
      actorId: context.actorId,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}
