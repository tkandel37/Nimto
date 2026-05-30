import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    email: string;
    sessionId?: string;
  };
};

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    try {
      const secret = this.config.get<string>("JWT_SECRET");
      if (!secret) {
        throw new UnauthorizedException("JWT secret is not configured.");
      }

      const payload = jwt.verify(token, secret) as JwtPayload & {
        sub: string;
        email: string;
        sessionId?: string;
      };

      if (payload.sessionId) {
        const session = await this.prisma.userSession.findUnique({
          where: { id: payload.sessionId },
        });

        if (!session || session.revokedAt) {
          throw new UnauthorizedException("Session revoked or invalid.");
        }
      }

      request.user = {
        sub: payload.sub,
        email: payload.email,
        sessionId: payload.sessionId,
      };
      return true;
    } catch (e) {
      throw new UnauthorizedException("Invalid or expired token.");
    }
  }

  private extractToken(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
