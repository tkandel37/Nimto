import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "../../prisma/prisma.service";
import { REQUIRED_PERMISSIONS_KEY } from "../decorators/require-permissions.decorator";
import { AuthenticatedRequest } from "../jwt-auth.guard";
import { SUPER_ADMIN_ROLE } from "../permissions";

const PERMISSION_CACHE_MS = 30_000;
const permissionCache = new Map<
  string,
  { expiresAt: number; permissions: Set<string>; roleNames: string[] }
>();

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;
    if (!userId) {
      throw new ForbiddenException("Missing authenticated user.");
    }

    const cached = permissionCache.get(userId);
    const access =
      cached && cached.expiresAt > Date.now()
        ? cached
        : await this.prisma.user
            .findUnique({
              where: { id: userId },
              select: {
                roles: {
                  select: {
                    role: {
                      select: {
                        name: true,
                        permissions: {
                          select: {
                            permission: { select: { key: true } },
                          },
                        },
                      },
                    },
                  },
                },
              },
            })
            .then((user) => {
              const roleNames =
                user?.roles.map((userRole) => userRole.role.name) ?? [];
              const permissions = new Set(
                user?.roles.flatMap((userRole) =>
                  userRole.role.permissions.map(
                    (rolePermission) => rolePermission.permission.key,
                  ),
                ) ?? [],
              );
              const next = {
                expiresAt: Date.now() + PERMISSION_CACHE_MS,
                permissions,
                roleNames,
              };
              permissionCache.set(userId, next);
              return next;
            });

    if (access.roleNames.includes(SUPER_ADMIN_ROLE)) {
      return true;
    }

    if (required.every((permission) => access.permissions.has(permission))) {
      return true;
    }

    throw new ForbiddenException(
      "You do not have permission to perform this action.",
    );
  }
}
