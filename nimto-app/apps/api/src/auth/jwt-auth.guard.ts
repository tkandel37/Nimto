import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import crypto from "crypto";
import { Request } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { AUTH_COOKIE_SENTINEL, readSessionCookie } from "./session-cookie";

export type AuthenticatedRequest = Request & {
  user?: {
    sub: string;
    email: string;
    sessionId: string;
  };
};

// Session validity is deliberately read from PostgreSQL on every protected
// request, so revocation works immediately across every API instance.
export function invalidateSessionAuthCache(_sessionIds?: Iterable<string>) {}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const bearerToken = this.extractBearerToken(request);
    const cookieToken = readSessionCookie(request);
    const token =
      bearerToken && bearerToken !== AUTH_COOKIE_SENTINEL
        ? bearerToken
        : cookieToken;

    if (!token) {
      throw new UnauthorizedException("Authentication is required.");
    }

    if (
      cookieToken &&
      token === cookieToken &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      bearerToken !== AUTH_COOKIE_SENTINEL
    ) {
      throw new UnauthorizedException("Cross-site request validation failed.");
    }

    try {
      const secret = this.config.get<string>("JWT_SECRET");
      if (!secret) {
        throw new UnauthorizedException("Authentication is unavailable.");
      }

      const payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        audience: this.config.get<string>("JWT_AUDIENCE") ?? "nimto-web",
        issuer: this.config.get<string>("JWT_ISSUER") ?? "nimto-api",
      }) as JwtPayload & {
        sub?: unknown;
        email?: unknown;
        sessionId?: unknown;
      };

      if (
        typeof payload.sub !== "string" ||
        typeof payload.email !== "string" ||
        typeof payload.sessionId !== "string" ||
        !payload.sub ||
        !payload.sessionId
      ) {
        throw new UnauthorizedException("Invalid session token.");
      }

      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sessionId },
        select: {
          tokenHash: true,
          expiresAt: true,
          revokedAt: true,
          userId: true,
          user: {
            select: {
              email: true,
              emailVerifiedAt: true,
              status: true,
            },
          },
        },
      });

      const presentedHash = crypto.createHash("sha256").update(token).digest();
      const storedHash = session?.tokenHash
        ? Buffer.from(session.tokenHash, "hex")
        : Buffer.alloc(0);
      const tokenMatches =
        storedHash.length === presentedHash.length &&
        crypto.timingSafeEqual(storedHash, presentedHash);

      if (
        !session ||
        !tokenMatches ||
        session.userId !== payload.sub ||
        session.user.email !== payload.email ||
        session.revokedAt ||
        session.expiresAt <= new Date()
      ) {
        throw new UnauthorizedException("Session revoked or invalid.");
      }

      if (session.user.status !== "ACTIVE" || !session.user.emailVerifiedAt) {
        throw new UnauthorizedException("This account cannot authenticate.");
      }

      request.user = {
        sub: session.userId,
        email: session.user.email,
        sessionId: payload.sessionId,
      };
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired session.");
    }
  }

  private extractBearerToken(request: Request) {
    const [type, token, extra] =
      request.headers.authorization?.trim().split(/\s+/) ?? [];
    return type?.toLowerCase() === "bearer" && token && !extra
      ? token
      : undefined;
  }
}
