import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { MailService } from "../mail/mail.service";
import { AuditService } from "../audit/audit.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { SUPER_ADMIN_ROLE } from "./permissions";
import { invalidateSessionAuthCache } from "./jwt-auth.guard";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly passwordResetMessage =
    "If an account with that email exists, a password reset link has been sent.";
  private readonly verificationResendMessage =
    "If a pending email verification exists for that address, a new verification code has been sent.";
  private readonly genericMailFailureMessage =
    "We couldn't complete your request right now. Please try again in a few minutes.";

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const trimmedName = dto.name.trim();
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (existingUser) {
      if (
        existingUser.status === "ACTIVE" &&
        !existingUser.emailVerifiedAt
      ) {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            name: trimmedName,
            passwordHash,
          },
        });

        try {
          await this.sendVerificationCode(existingUser.id, existingUser.email);
        } catch (resendError) {
          this.logger.error(
            `Failed to resend verification email during registration retry for ${existingUser.email}`,
            resendError instanceof Error
              ? resendError.stack
              : String(resendError),
          );
          throw new ServiceUnavailableException(
            this.genericMailFailureMessage,
          );
        }

        await this.record(
          existingUser.id,
          "auth.registered.retry_pending_verification",
          "User",
          existingUser.id,
          {
            email: existingUser.email,
          },
        );

        return {
          message:
            "This account is still waiting for verification. We updated your details and sent a new code.",
          email: existingUser.email,
        };
      }

      throw new BadRequestException(
        "An account with this email already exists.",
      );
    }

    const previousPendingRegistration =
      await this.prisma.pendingRegistration.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          name: true,
          passwordHash: true,
          verificationCode: true,
          expiresAt: true,
        },
      });
    const verificationCode = this.generateNumericCode();
    const expiresAt = this.buildVerificationExpiry();

    const pendingRegistration = previousPendingRegistration
      ? await this.prisma.pendingRegistration.update({
          where: { id: previousPendingRegistration.id },
          data: {
            name: trimmedName,
            passwordHash,
            verificationCode,
            expiresAt,
          },
          select: {
            id: true,
            email: true,
          },
        })
      : await this.prisma.pendingRegistration.create({
          data: {
            name: trimmedName,
            email: normalizedEmail,
            passwordHash,
            verificationCode,
            expiresAt,
          },
          select: {
            id: true,
            email: true,
          },
        });

    try {
      await this.mailService.sendVerificationEmail(
        pendingRegistration.email,
        verificationCode,
      );
    } catch (error) {
      if (previousPendingRegistration) {
        await this.prisma.pendingRegistration.update({
          where: { id: previousPendingRegistration.id },
          data: {
            name: previousPendingRegistration.name,
            passwordHash: previousPendingRegistration.passwordHash,
            verificationCode: previousPendingRegistration.verificationCode,
            expiresAt: previousPendingRegistration.expiresAt,
          },
        });
      } else {
        await this.prisma.pendingRegistration.delete({
          where: { id: pendingRegistration.id },
        });
      }

      this.logger.error(
        `Failed to send verification email during registration for ${pendingRegistration.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(this.genericMailFailureMessage);
    }

    return {
      message: previousPendingRegistration
        ? "This email is still waiting for verification. We updated your details and sent a new code."
        : "Account almost ready. Check your email for the verification code.",
      email: pendingRegistration.email,
    };
  }

  async login(dto: LoginDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: this.userAccessInclude(),
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
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        "Please verify your email before logging in.",
      );
    }

    this.runAfterResponse(
      this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      "last-login update",
    );

    return await this.buildAuthResponse(user.id, user, {
      afterSessionCreated: (sessionId) => {
        this.runAfterResponse(
          this.record(user.id, "auth.login", "UserSession", sessionId, {
            provider: "email",
          }),
          "login audit",
        );
      },
    });
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

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!existing) {
      throw new UnauthorizedException("User not found.");
    }

    const normalizedEmail = dto.email?.trim().toLowerCase();
    const emailChanged =
      normalizedEmail !== undefined && normalizedEmail !== existing.email;

    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: dto.name?.trim(),
          email: normalizedEmail,
          emailVerifiedAt: emailChanged ? null : undefined,
          phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
        },
        include: this.userAccessInclude(),
      });

      return { user: this.toPublicUser(user) };
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

  async verifyEmailCode(dto: VerifyEmailDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const pendingRegistration =
      await this.prisma.pendingRegistration.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          name: true,
          email: true,
          passwordHash: true,
          verificationCode: true,
          expiresAt: true,
        },
      });
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        emailVerifiedAt: true,
        status: true,
      },
    });

    if (user?.emailVerifiedAt) {
      return { message: "Email is already verified." };
    }

    if (pendingRegistration) {
      if (pendingRegistration.verificationCode !== dto.code) {
        throw new BadRequestException("Invalid verification code.");
      }

      if (pendingRegistration.expiresAt < new Date()) {
        await this.prisma.pendingRegistration.delete({
          where: { id: pendingRegistration.id },
        });
        throw new BadRequestException("Verification code has expired.");
      }

      if (user) {
        this.assertUserCanAuthenticate(user);

        await this.prisma.$transaction([
          this.prisma.user.update({
            where: { id: user.id },
            data: {
              emailVerifiedAt: new Date(),
            },
          }),
          this.prisma.pendingRegistration.delete({
            where: { id: pendingRegistration.id },
          }),
          this.prisma.verificationToken.deleteMany({
            where: { userId: user.id },
          }),
        ]);

        await this.record(user.id, "auth.verified", "User", user.id, {
          method: "otp",
        });

        return { message: "Email successfully verified." };
      }

      try {
        const createdUser = await this.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              name: pendingRegistration.name,
              email: pendingRegistration.email,
              passwordHash: pendingRegistration.passwordHash,
              emailVerifiedAt: new Date(),
            },
            select: {
              id: true,
              email: true,
            },
          });

          await tx.pendingRegistration.delete({
            where: { id: pendingRegistration.id },
          });

          return newUser;
        });

        await this.record(
          createdUser.id,
          "auth.registered",
          "User",
          createdUser.id,
          {
            email: createdUser.email,
          },
        );
        await this.record(
          createdUser.id,
          "auth.verified",
          "User",
          createdUser.id,
          {
            method: "otp",
          },
        );

        return { message: "Email successfully verified." };
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

    if (!user) {
      throw new BadRequestException("Invalid verification code.");
    }

    this.assertUserCanAuthenticate(user);

    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
        token: dto.code,
      },
    });

    if (!verificationToken) {
      throw new BadRequestException("Invalid verification code.");
    }

    if (verificationToken.expiresAt < new Date()) {
      await this.prisma.verificationToken.deleteMany({
        where: {
          userId: user.id,
        },
      });
      throw new BadRequestException("Verification code has expired.");
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      }),
      this.prisma.verificationToken.deleteMany({
        where: { userId: user.id },
      }),
    ]);

    await this.record(user.id, "auth.verified", "User", user.id, {
      method: "otp",
    });

    return { message: "Email successfully verified." };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const pendingRegistration =
      await this.prisma.pendingRegistration.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          email: true,
          verificationCode: true,
          expiresAt: true,
        },
      });

    if (pendingRegistration) {
      const verificationCode = this.generateNumericCode();
      const expiresAt = this.buildVerificationExpiry();

      await this.prisma.pendingRegistration.update({
        where: { id: pendingRegistration.id },
        data: {
          verificationCode,
          expiresAt,
        },
      });

      try {
        await this.mailService.sendVerificationEmail(
          pendingRegistration.email,
          verificationCode,
        );
      } catch (error) {
        await this.prisma.pendingRegistration.update({
          where: { id: pendingRegistration.id },
          data: {
            verificationCode: pendingRegistration.verificationCode,
            expiresAt: pendingRegistration.expiresAt,
          },
        });
        this.logger.error(
          `Failed to resend pending verification email for ${pendingRegistration.email}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw new ServiceUnavailableException(this.genericMailFailureMessage);
      }

      return { message: this.verificationResendMessage };
    }

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
      },
    });

    if (!user || user.status !== "ACTIVE" || user.emailVerifiedAt) {
      return { message: this.verificationResendMessage };
    }

    try {
      await this.sendVerificationCode(user.id, user.email);
    } catch (error) {
      this.logger.error(
        `Failed to resend verification email for ${user.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(this.genericMailFailureMessage);
    }
    await this.record(user.id, "auth.verification_resent", "User", user.id);

    return { message: this.verificationResendMessage };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return { message: this.passwordResetMessage };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendPasswordResetEmail(user.email, token);
    } catch (error) {
      await this.prisma.passwordResetToken.deleteMany({
        where: { userId: user.id },
      });
      this.logger.error(
        `Failed to send password reset email for ${user.email}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(this.genericMailFailureMessage);
    }
    await this.record(user.id, "auth.password_reset.requested", "User", user.id);

    return { message: this.passwordResetMessage };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordResetToken = await this.prisma.passwordResetToken.findUnique({
      where: { token: dto.token },
      include: {
        user: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!passwordResetToken) {
      throw new BadRequestException("Invalid password reset token.");
    }

    if (passwordResetToken.expiresAt < new Date()) {
      await this.prisma.passwordResetToken.delete({
        where: { id: passwordResetToken.id },
      });
      throw new BadRequestException("Password reset token has expired.");
    }

    this.assertUserCanAuthenticate(passwordResetToken.user);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const revokedAt = new Date();

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: passwordResetToken.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.deleteMany({
        where: { userId: passwordResetToken.userId },
      }),
      this.prisma.userSession.updateMany({
        where: {
          userId: passwordResetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt,
          revocationReason: "PASSWORD_CHANGED",
        },
      }),
    ]);
    invalidateSessionAuthCache();

    await this.record(
      passwordResetToken.userId,
      "auth.password_reset.completed",
      "User",
      passwordResetToken.userId,
    );

    return { message: "Password successfully reset." };
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
      invalidateSessionAuthCache([sessionId]);
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

  private async sendVerificationCode(userId: string, email: string) {
    await this.prisma.verificationToken.deleteMany({
      where: { userId },
    });

    const token = await this.generateUniqueNumericToken(
      async (candidate) =>
        this.prisma.verificationToken.findUnique({
          where: { token: candidate },
          select: { id: true },
        }),
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    await this.prisma.verificationToken.create({
      data: {
        userId,
        token,
        expiresAt,
      },
    });

    try {
      await this.mailService.sendVerificationEmail(email, token);
    } catch (error) {
      await this.prisma.verificationToken.deleteMany({
        where: {
          userId,
          token,
        },
      });
      throw error;
    }
  }

  private generateNumericCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private buildVerificationExpiry() {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    return expiresAt;
  }

  private async generateUniqueNumericToken(
    exists: (candidate: string) => Promise<{ id: string } | null>,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
      const existing = await exists(candidate);
      if (!existing) {
        return candidate;
      }
    }

    throw new Error("Could not generate a unique verification code.");
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

  private async buildAuthResponse(
    userId: string,
    loadedUser?: NonNullable<
      Awaited<ReturnType<AuthService["findUserWithAccess"]>>
    >,
    options: { afterSessionCreated?: (sessionId: string) => void } = {},
  ) {
    const user = loadedUser ?? (await this.findUserWithAccess(userId));

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
    options.afterSessionCreated?.(sessionId);

    return {
      token,
      user: this.toPublicUser(user),
    };
  }

  private findUserWithAccess(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      include: this.userAccessInclude(),
    });
  }

  private runAfterResponse(work: Promise<unknown>, label: string) {
    void work.catch((error) => {
      console.error(`Failed to complete ${label}`, error);
    });
  }

  private toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
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
      phone: user.phone,
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
