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
import { invalidatePermissionCache } from "../auth/guards/permissions.guard";
import { invalidateSessionAuthCache } from "../auth/jwt-auth.guard";

type ActorContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

type PageOptions = {
  skip?: number;
  take?: number;
};

type PageResult<T> = {
  items: T[];
  nextSkip: number | null;
  total: number;
};

type AccountSessionListItem = {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  revokedAt: Date | null;
  revocationReason: string | null;
  userAgent: string | null;
};

type DashboardSummary = {
  auditCount: number;
  eventCount: number;
  roleCount: number;
  sessionCount: number;
  staffCount: number;
  userCount: number;
};

const ACCOUNT_SESSION_CACHE_MS = 30_000;
const DASHBOARD_SUMMARY_CACHE_MS = 30_000;
const accountSessionCache = new Map<
  string,
  { expiresAt: number; value: PageResult<AccountSessionListItem> }
>();
const dashboardSummaryCache = new Map<
  string,
  { expiresAt: number; value: DashboardSummary }
>();

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async seedPermissionCatalog(context?: ActorContext) {
    await this.prisma.$transaction(
      PERMISSION_CATALOG.map((permission) =>
        this.prisma.permission.upsert({
          where: { key: permission.key },
          update: { description: permission.description },
          create: permission,
        }),
      ),
    );

    if (context) {
      await this.record(
        context,
        "permissions.seeded",
        "Permission",
        undefined,
        {
          count: PERMISSION_CATALOG.length,
        },
      );
    }
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: "asc" } });
  }

  async dashboardSummary(userId: string) {
    const cached = dashboardSummaryCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const [
      eventCount,
      roleCount,
      staffCount,
      userCount,
      activeSessionCount,
      auditCount,
    ] = await this.prisma.$transaction([
      this.prisma.event.count({ where: { userId } }),
      this.prisma.role.count(),
      this.prisma.user.count({ where: { roles: { some: {} } } }),
      this.prisma.user.count({ where: { roles: { none: {} } } }),
      this.prisma.userSession.count({ where: { revokedAt: null } }),
      this.prisma.auditLog.count(),
    ]);

    const value = {
      auditCount,
      eventCount,
      roleCount,
      sessionCount: activeSessionCount,
      staffCount,
      userCount,
    };
    dashboardSummaryCache.set(userId, {
      expiresAt: Date.now() + DASHBOARD_SUMMARY_CACHE_MS,
      value,
    });
    return value;
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
    const name = this.normalizeRoleName(dto.name);
    const permissionKeys = this.normalizePermissionKeys(dto.permissionKeys);
    await this.assertPermissionsExist(permissionKeys);

    try {
      const role = await this.prisma.role.create({
        data: {
          name,
          description: dto.description?.trim() || null,
          permissions: {
            create: permissionKeys.map((key) => ({
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
    } catch (error) {
      this.throwIfMissingRelation(error, "One or more permissions do not exist.");
      this.throwIfUniqueConstraint(error, `Role "${name}" already exists.`);
      throw error;
    }
  }

  async updateRole(roleId: string, dto: UpdateRoleDto, context: ActorContext) {
    const existing = await this.getRole(roleId);
    if (existing.isSystem || existing.name === SUPER_ADMIN_ROLE) {
      throw new ForbiddenException("System roles cannot be changed.");
    }
    const permissionKeys =
      dto.permissionKeys === undefined
        ? undefined
        : this.normalizePermissionKeys(dto.permissionKeys);
    if (permissionKeys) await this.assertPermissionsExist(permissionKeys);
    const assignedUsers =
      permissionKeys !== undefined || dto.name !== undefined
        ? await this.prisma.userRole.findMany({
            where: { roleId },
            select: { userId: true },
          })
        : [];

    try {
      const role = await this.prisma.$transaction(async (tx) => {
        if (permissionKeys !== undefined) {
          await tx.rolePermission.deleteMany({ where: { roleId } });
        }

        return tx.role.update({
          where: { id: roleId },
          data: {
            name: dto.name ? this.normalizeRoleName(dto.name) : undefined,
            description:
              dto.description !== undefined
                ? dto.description.trim() || null
                : undefined,
            permissions:
              permissionKeys !== undefined
                ? {
                    create: permissionKeys.map((key) => ({
                      permission: { connect: { key } },
                    })),
                  }
                : undefined,
          },
          include: { permissions: { include: { permission: true } } },
        });
      });

      invalidatePermissionCache(assignedUsers.map((user) => user.userId));

      await this.record(context, "role.updated", "Role", role.id, {
        name: role.name,
      });
      return role;
    } catch (error) {
      this.throwIfMissingRelation(error, "One or more permissions do not exist.");
      this.throwIfUniqueConstraint(
        error,
        "A role with this name already exists.",
      );
      throw error;
    }
  }

  async deleteRole(roleId: string, context: ActorContext) {
    const role = await this.getRole(roleId);
    if (role.isSystem || role.name === SUPER_ADMIN_ROLE) {
      throw new ForbiddenException("System roles cannot be deleted.");
    }

    const assignedUsers = await this.prisma.userRole.count({
      where: { roleId },
    });
    if (assignedUsers > 0) {
      throw new BadRequestException(
        "Remove this role from all users before deleting it.",
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    await this.record(context, "role.deleted", "Role", roleId, {
      name: role.name,
    });
    return { success: true };
  }

  async listStaff(options: PageOptions = {}) {
    const page = this.pageOptions(options);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { roles: { some: {} } },
        orderBy: { createdAt: "desc" },
        select: this.staffSelect(),
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.user.count({ where: { roles: { some: {} } } }),
    ]);

    return this.pageResult(items, total, page);
  }

  async listUsers(options: PageOptions = {}) {
    const page = this.pageOptions(options);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { roles: { none: {} } },
        orderBy: { createdAt: "desc" },
        select: this.staffSelect(),
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.user.count({ where: { roles: { none: {} } } }),
    ]);

    return this.pageResult(items, total, page);
  }

  async createStaff(dto: CreateStaffDto, context: ActorContext) {
    await this.assertRolesAssignable(dto.roleIds);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const email = dto.email.trim().toLowerCase();

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email,
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          roles: {
            create: dto.roleIds.map((roleId) => ({
              role: { connect: { id: roleId } },
            })),
          },
        },
        select: this.staffSelect(),
      });

      await this.record(context, "staff.created", "User", user.id, {
        email: user.email,
      });
      return user;
    } catch (error) {
      this.throwIfUniqueConstraint(
        error,
        `An account with ${email} already exists.`,
      );
      throw error;
    }
  }

  async updateStaff(
    userId: string,
    dto: UpdateStaffDto,
    context: ActorContext,
  ) {
    await this.assertNotProtectedSuperAdmin(userId, dto);
    this.assertActorKeepsOwnAccess(userId, dto, context);
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
          blockedAt:
            dto.status === UserStatus.BLOCKED
              ? new Date()
              : dto.status === UserStatus.ACTIVE
                ? null
                : undefined,
          deactivatedAt:
            dto.status === UserStatus.DEACTIVATED
              ? new Date()
              : dto.status === UserStatus.ACTIVE
                ? null
                : undefined,
          deletionRequestedAt:
            dto.status === UserStatus.PENDING_DELETION
              ? new Date()
              : dto.status === UserStatus.ACTIVE
                ? null
                : undefined,
          roles: dto.roleIds
            ? {
                create: dto.roleIds.map((roleId) => ({
                  role: { connect: { id: roleId } },
                })),
              }
            : undefined,
        },
        select: this.staffSelect(),
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

    if (dto.roleIds) invalidatePermissionCache([userId]);
    if ((dto.status && dto.status !== UserStatus.ACTIVE) || passwordHash) {
      invalidateSessionAuthCache();
    }

    await this.record(context, "staff.updated", "User", user.id, {
      email: user.email,
      status: user.status,
    });
    return user;
  }

  async updateUserStatus(
    userId: string,
    dto: Pick<UpdateStaffDto, "status">,
    context: ActorContext,
  ) {
    this.assertActorKeepsOwnAccess(userId, dto, context);

    const user = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          status: dto.status,
          blockedAt:
            dto.status === UserStatus.BLOCKED
              ? new Date()
              : dto.status === UserStatus.ACTIVE
                ? null
                : undefined,
          deactivatedAt:
            dto.status === UserStatus.DEACTIVATED
              ? new Date()
              : dto.status === UserStatus.ACTIVE
                ? null
                : undefined,
          deletionRequestedAt:
            dto.status === UserStatus.PENDING_DELETION
              ? new Date()
              : dto.status === UserStatus.ACTIVE
                ? null
                : undefined,
        },
        select: this.staffSelect(),
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

      return updated;
    });

    if (dto.status && dto.status !== UserStatus.ACTIVE) {
      invalidateSessionAuthCache();
    }

    await this.record(context, "user.updated", "User", user.id, {
      email: user.email,
      status: user.status,
    });
    return user;
  }

  async deleteUser(userId: string, context: ActorContext) {
    if (context.actorId === userId) {
      throw new BadRequestException("You cannot delete your own account.");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found.");
    }

    if (user.roles.length > 0) {
      throw new BadRequestException(
        "Only regular user accounts can be deleted from this screen.",
      );
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });
    this.clearAccountSessionCache(userId);

    await this.record(context, "user.deleted", "User", userId, {
      email: user.email,
      status: user.status,
    });

    return { success: true };
  }

  listSessions() {
    return this.prisma.userSession.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: this.sessionSelect(),
    });
  }

  async listAccountSessions(userId: string, options: PageOptions = {}) {
    const page = this.pageOptions(options);
    const cacheKey = `${userId}:${page.skip}:${page.take}`;
    const cached = accountSessionCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const items = await this.prisma.userSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: this.accountSessionSelect(),
      skip: page.skip,
      take: page.take + 1,
    });

    const value = this.cursorPageResult(items, page);
    accountSessionCache.set(cacheKey, {
      expiresAt: Date.now() + ACCOUNT_SESSION_CACHE_MS,
      value,
    });
    return value;
  }

  async forceLogout(sessionId: string, context: ActorContext) {
    const existing = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });
    if (!existing) {
      throw new NotFoundException("Session not found.");
    }

    const session = existing.revokedAt
      ? existing
      : await this.prisma.userSession.update({
          where: { id: sessionId },
          data: {
            revokedAt: new Date(),
            revocationReason: "ADMIN_FORCE_LOGOUT",
          },
        });
    this.clearAccountSessionCache(session.userId);
    invalidateSessionAuthCache([session.id]);

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

  private clearAccountSessionCache(userId: string) {
    for (const key of accountSessionCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        accountSessionCache.delete(key);
      }
    }
  }

  listAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { actor: { select: { id: true, name: true, email: true } } },
    });
  }

  async listAccountAuditLogs(userId: string, options: PageOptions = {}) {
    await this.assertUserExists(userId);
    const page = this.pageOptions(options);
    const where = {
      OR: [
        { actorId: userId },
        { entityType: "User", entityId: userId },
        { entityType: "UserSession", metadata: { path: ["userId"], equals: userId } },
      ],
    } satisfies Prisma.AuditLogWhereInput;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { id: true, name: true, email: true } } },
        skip: page.skip,
        take: page.take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return this.pageResult(items, total, page);
  }

  private async getRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException("Role not found.");
    }
    return role;
  }

  private async assertUserExists(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException("User not found.");
    }
  }

  private pageOptions(options: PageOptions) {
    const skip = Number.isFinite(options.skip) ? Number(options.skip) : 0;
    const take = Number.isFinite(options.take) ? Number(options.take) : 30;

    return {
      skip: Math.max(0, skip),
      take: Math.min(100, Math.max(1, take)),
    };
  }

  private pageResult<T>(
    items: T[],
    total: number,
    page: { skip: number; take: number },
  ) {
    const nextSkip = page.skip + items.length;

    return {
      items,
      nextSkip: nextSkip < total ? nextSkip : null,
      total,
    };
  }

  private cursorPageResult<T>(items: T[], page: { skip: number; take: number }) {
    const visibleItems = items.slice(0, page.take);
    const nextSkip =
      items.length > page.take ? page.skip + visibleItems.length : null;

    return {
      items: visibleItems,
      nextSkip,
      total: page.skip + visibleItems.length,
    };
  }

  private sessionSelect() {
    return {
      id: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      revocationReason: true,
      userAgent: true,
      user: { select: { id: true, name: true, email: true, status: true } },
    } as const;
  }

  private accountSessionSelect() {
    return {
      id: true,
      createdAt: true,
      expiresAt: true,
      revokedAt: true,
      revocationReason: true,
      userAgent: true,
    } as const;
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

  private normalizePermissionKeys(keys: string[] | undefined) {
    return [...new Set((keys ?? []).map((key) => key.trim()).filter(Boolean))];
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

  private assertActorKeepsOwnAccess(
    userId: string,
    dto: UpdateStaffDto,
    context: ActorContext,
  ) {
    const restrictsOwnStatus =
      dto.status !== undefined && dto.status !== UserStatus.ACTIVE;
    if (context.actorId === userId && (restrictsOwnStatus || dto.roleIds)) {
      throw new BadRequestException(
        "You cannot remove your own access or deactivate your own account.",
      );
    }
  }

  private normalizeRoleName(name: string) {
    return name.trim().toUpperCase().replace(/\s+/g, "_");
  }

  private throwIfUniqueConstraint(
    error: unknown,
    message: string,
  ): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BadRequestException(message);
    }
  }

  private throwIfMissingRelation(error: unknown, message: string): never | void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new BadRequestException(message);
    }
  }

  private staffSelect() {
    return {
      id: true,
      name: true,
      email: true,
      status: true,
      emailVerifiedAt: true,
      blockedAt: true,
      deactivatedAt: true,
      deletionRequestedAt: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      roles: {
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
              isSystem: true,
              permissions: { include: { permission: true } },
            },
          },
        },
      },
    } as const;
  }

  private record(
    context: ActorContext,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    void this.audit.record({
      actorId: context.actorId,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
    return Promise.resolve(null);
  }
}
