import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AuditService } from "../audit/audit.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { SUPER_ADMIN_ROLE } from "./permissions";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: normalizedEmail,
          passwordHash,
        },
      });

      const token = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // Token expires in 24 hours

      await this.prisma.verificationToken.create({
        data: {
          userId: user.id,
          token,
          expiresAt,
        },
      });

      // Send verification email asynchronously
      this.mailService.sendVerificationEmail(user.email, token).catch((err) => {
        console.error("Failed to send verification email", err);
      });

      await this.record(user.id, "auth.registered", "User", user.id, {
        email: user.email,
      });

      return await this.buildAuthResponse(user.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BadRequestException(
          "An account with this email already exists.",
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordsMatch = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordsMatch) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    this.assertUserCanAuthenticate(user);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await this.record(user.id, "auth.login", "UserSession", undefined, {
      provider: "email",
    });

    return await this.buildAuthResponse(user.id);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: this.userAccessInclude(),
    });

    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    return {
      user: this.toPublicUser(user),
    };
  }

  async verifyEmail(token: string) {
    const verificationToken = await this.prisma.verificationToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!verificationToken) {
      throw new BadRequestException("Invalid verification token.");
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new BadRequestException("Verification token has expired.");
    }

    if (verificationToken.user.emailVerifiedAt) {
      return { message: "Email is already verified." };
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: verificationToken.userId },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.delete({
        where: { id: verificationToken.id },
      }),
    ]);

    return { message: "Email successfully verified." };
  }

  async logout(sessionId: string) {
    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
    });

    if (session && !session.revokedAt) {
      await this.prisma.userSession.update({
        where: { id: sessionId },
        data: {
          revokedAt: new Date(),
          revocationReason: "USER_LOGOUT",
        },
      });
      await this.record(
        session.userId,
        "auth.logout",
        "UserSession",
        session.id,
      );
    }
  }

  async validateOAuthLogin(
    profile: any,
    accessToken: string,
    refreshToken: string,
  ) {
    const providerAccountId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase();
    const name = profile.displayName || "Google User";

    if (!email) {
      throw new BadRequestException("No email found in Google profile");
    }

    // 1. Check if OAuth account exists
    let oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GOOGLE",
          providerAccountId,
        },
      },
      include: { user: true },
    });

    if (oauthAccount) {
      this.assertUserCanAuthenticate(oauthAccount.user);
      await this.prisma.user.update({
        where: { id: oauthAccount.user.id },
        data: { lastLoginAt: new Date() },
      });
      await this.record(
        oauthAccount.user.id,
        "auth.login",
        "OAuthAccount",
        oauthAccount.id,
        {
          provider: "GOOGLE",
        },
      );
      return this.buildAuthResponse(oauthAccount.user.id);
    }

    // 2. If not, check if User exists by email
    let user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      this.assertUserCanAuthenticate(user);
      // 3. Link new OAuth account to existing user
      await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: "GOOGLE",
          providerAccountId,
          email,
          accessToken,
          refreshToken,
        },
      });
      await this.record(user.id, "oauth.linked", "User", user.id, {
        provider: "GOOGLE",
      });
    } else {
      // 4. Create new User and link OAuth account
      user = await this.prisma.user.create({
        data: {
          name,
          email,
          emailVerifiedAt: new Date(), // Implicitly verified since it's from Google
          oauthAccounts: {
            create: {
              provider: "GOOGLE",
              providerAccountId,
              email,
              accessToken,
              refreshToken,
            },
          },
        },
      });
      await this.record(user.id, "oauth.registered", "User", user.id, {
        provider: "GOOGLE",
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.buildAuthResponse(user.id);
  }

  private record(
    actorId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.audit.record({
      actorId,
      action,
      entityType,
      entityId,
      metadata,
    });
  }

  private async buildAuthResponse(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userAccessInclude(),
    });

    if (!user) {
      throw new UnauthorizedException("User not found.");
    }

    this.assertUserCanAuthenticate(user);

    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET is required.");
    }

    const sessionId = crypto.randomBytes(16).toString("hex"); // Generate an ID to track session

    const token = jwt.sign(
      {
        email: user.email,
        sessionId,
      },
      secret,
      {
        subject: user.id,
        expiresIn: "7d",
      },
    );

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    return {
      token,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    status?: string;
    emailVerifiedAt?: Date | null;
    createdAt: Date;
    roles?: {
      role: {
        name: string;
        permissions: {
          permission: {
            key: string;
          };
        }[];
      };
    }[];
  }) {
    const roleNames = user.roles?.map((userRole) => userRole.role.name) ?? [];
    const permissions = new Set(
      user.roles?.flatMap((userRole) =>
        userRole.role.name === SUPER_ADMIN_ROLE
          ? ["*"]
          : userRole.role.permissions.map(
              (rolePermission) => rolePermission.permission.key,
            ),
      ) ?? [],
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      roles: roleNames,
      permissions: Array.from(permissions).sort(),
      createdAt: user.createdAt,
    };
  }

  private assertUserCanAuthenticate(user: { status: string }) {
    if (user.status === "ACTIVE") {
      return;
    }

    const messages: Record<string, string> = {
      BLOCKED: "This account is blocked.",
      DEACTIVATED: "This account is deactivated.",
      PENDING_DELETION: "This account is pending deletion.",
    };

    throw new UnauthorizedException(
      messages[user.status] ?? "This account is not active.",
    );
  }

  private userAccessInclude() {
    return {
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
    } as const;
  }
}
