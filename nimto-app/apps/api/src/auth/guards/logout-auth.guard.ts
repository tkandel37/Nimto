import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AUTH_COOKIE_SENTINEL } from "../session-cookie";
import { JwtAuthGuard } from "../jwt-auth.guard";

@Injectable()
export class LogoutAuthGuard implements CanActivate {
  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
    }>();
    const authorization = request.headers.authorization?.trim() ?? "";

    if (authorization.toLowerCase() !== `bearer ${AUTH_COOKIE_SENTINEL}`) {
      throw new UnauthorizedException("Logout confirmation is required.");
    }

    try {
      return await this.jwtAuthGuard.canActivate(context);
    } catch {
      // Logout is intentionally idempotent. A missing, expired, or already
      // revoked cookie must still reach the controller so it can be removed.
      return true;
    }
  }
}
