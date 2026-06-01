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

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const roleNames = user?.roles.map((userRole) => userRole.role.name) ?? [];
    if (roleNames.includes(SUPER_ADMIN_ROLE)) {
      return true;
    }

    const granted = new Set(
      user?.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.key,
        ),
      ) ?? [],
    );

    if (required.every((permission) => granted.has(permission))) {
      return true;
    }

    throw new ForbiddenException(
      "You do not have permission to perform this action.",
    );
  }
}
