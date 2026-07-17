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
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
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
  private readonly registrationMessage =
    "If this email can be registered, a verification code has been sent.";
  private readonly dummyPasswordHash =
    "$2b$12$/jG.Y0FiCMTEd9JsV7YRouCZM/G/AU6tZpytO4TpYIo4NKOpGh53u";

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const trimmedName = dto.name.trim();
    // Always perform the password work so response timing does not reveal
    // whether an account or pending registration already exists.
    const passwordHashPromise = bcrypt.hash(dto.password, 12);
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
      },
    });
    const passwordHash = await passwordHashPromise;

    if (existingUser) {
      return { message: this.registrationMessage, email: normalizedEmail };
    }

    const previousPendingRegistration =
      await this.prisma.pendingRegistration.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          expiresAt: true,
        },
      });
    if (
      previousPendingRegistration &&
      previousPendingRegistration.expiresAt > new Date()
    ) {
      return { message: this.registrationMessage, email: normalizedEmail };
    }
    if (previousPendingRegistration) {
      await this.prisma.pendingRegistration.delete({
        where: { id: previousPendingRegistration.id },
      });
    }

    const verificationCode = this.generateNumericCode();
    const expiresAt = this.buildVerificationExpiry();
    const pendingRegistration = await this.prisma.pendingRegistration.create({
      data: {
        name: trimmedName,
        email: normalizedEmail,
        passwordHash,
        verificationCodeHash: this.hashCredential(
          verificationCode,
          "registration-verification",
        ),
        expiresAt,
      },
      select: {
        id: true,
        email: true,
      },
    });

    this.runAfterResponse(
      this.mailService
        .sendVerificationEmail(pendingRegistration.email, verificationCode)
        .catch(async (error) => {
          await this.prisma.pendingRegistration.deleteMany({
            where: { id: pendingRegistration.id },
          });
          throw error;
        }),
      "registration verification email",
    );

    return {
      message: this.registrationMessage,
      email: pendingRegistration.email,
    };
  }

  async login(
    dto: LoginDto,
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
      include: this.userAccessInclude(),
    });

    const passwordsMatch = await bcrypt.compare(
      dto.password,
      user?.passwordHash ?? this.dummyPasswordHash,
    );
    // A valid password can recover from a lock marker. Rejecting even the
    // correct password would let an attacker deny service to a known account
    // by intentionally exhausting its failed-attempt budget.
    if (!user?.passwordHash || !passwordsMatch) {
      if (user?.passwordHash && !passwordsMatch) {
        const lockUntil = new Date(Date.now() + 15 * 60_000);
        await this.prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: { increment: 1 },
            loginLockedUntil:
              user.failedLoginAttempts >= 9 ? lockUntil : undefined,
          },
        });
      }
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
        data: {
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          loginLockedUntil: null,
        },
      }),
      "last-login update",
    );

    return await this.buildAuthResponse(user.id, user, {
      sessionContext: context,
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

  async createOAuthSessionBridge(token: string) {
    const payload = this.verifySessionToken(token);
    const expiresAt = new Date(Date.now() + 2 * 60_000);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      this.oauthBridgeKey(),
      iv,
    );
    const plaintext = Buffer.from(
      JSON.stringify({ token, expiresAt: expiresAt.getTime() }),
      "utf8",
    );
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    const bridge = Buffer.concat([
      iv,
      cipher.getAuthTag(),
      ciphertext,
    ]).toString("base64url");

    await this.prisma.userSession.update({
      where: { id: payload.sessionId },
      data: {
        oauthClaimHash: this.hashOAuthBridge(bridge),
        oauthClaimExpiresAt: expiresAt,
      },
    });
    return bridge;
  }

  async consumeOAuthSessionBridge(bridge: string) {
    try {
      const packed = Buffer.from(bridge, "base64url");
      if (packed.length < 29) throw new Error("Invalid bridge.");
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        this.oauthBridgeKey(),
        packed.subarray(0, 12),
      );
      decipher.setAuthTag(packed.subarray(12, 28));
      const plaintext = Buffer.concat([
        decipher.update(packed.subarray(28)),
        decipher.final(),
      ]).toString("utf8");
      const parsed = JSON.parse(plaintext) as {
        token?: unknown;
        expiresAt?: unknown;
      };
      if (
        typeof parsed.token !== "string" ||
        typeof parsed.expiresAt !== "number" ||
        parsed.expiresAt <= Date.now()
      ) {
        throw new Error("Expired bridge.");
      }

      const payload = this.verifySessionToken(parsed.token);
      const claimed = await this.prisma.userSession.updateMany({
        where: {
          id: payload.sessionId,
          oauthClaimHash: this.hashOAuthBridge(bridge),
          oauthClaimExpiresAt: { gt: new Date() },
          revokedAt: null,
        },
        data: { oauthClaimHash: null, oauthClaimExpiresAt: null },
      });
      if (claimed.count !== 1) throw new Error("Bridge already used.");
      return parsed.token;
    } catch {
      throw new UnauthorizedException("Invalid or expired sign-in handoff.");
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        passwordHash: true,
      },
    });
    if (!existing) {
      throw new UnauthorizedException("User not found.");
    }

    const normalizedEmail = dto.email?.trim().toLowerCase();
    const emailChanged =
      normalizedEmail !== undefined && normalizedEmail !== existing.email;

    if (emailChanged) {
      if (!existing.passwordHash || !dto.currentPassword) {
        throw new BadRequestException(
          "Your current password is required to change the account email.",
        );
      }
      const passwordMatches = await bcrypt.compare(
        dto.currentPassword,
        existing.passwordHash,
      );
      if (!passwordMatches) {
        throw new UnauthorizedException("Current password is incorrect.");
      }

      const emailConflict = await this.prisma.user.findFirst({
        where: {
          OR: [{ email: normalizedEmail }, { pendingEmail: normalizedEmail }],
          NOT: { id: userId },
        },
        select: { id: true },
      });
      if (emailConflict) {
        throw new BadRequestException("This email cannot be used.");
      }

      const code = this.generateNumericCode();
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          name: dto.name?.trim(),
          phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
          pendingEmail: normalizedEmail,
          pendingEmailCodeHash: this.hashCredential(code, "email-change"),
          pendingEmailExpiresAt: this.buildVerificationExpiry(),
          pendingEmailAttempts: 0,
          pendingEmailLastSentAt: new Date(),
        },
      });

      try {
        await this.mailService.sendEmailChangeVerificationEmail(
          normalizedEmail!,
          code,
        );
      } catch {
        await this.clearPendingEmailChange(userId);
        this.logger.error("Failed to send an email-change verification.");
        throw new ServiceUnavailableException(this.genericMailFailureMessage);
      }

      this.runAfterResponse(
        this.mailService.sendEmailChangeStartedNotice(existing.email),
        "email-change security notice",
      );

      const user = await this.findUserWithAccess(userId);
      return {
        user: this.toPublicUser(user!),
        emailChangePending: true,
        message: "A verification code was sent to the new email address.",
      };
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        name: dto.name?.trim(),
        phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
      },
      include: this.userAccessInclude(),
    });

    return { user: this.toPublicUser(user), emailChangePending: false };
  }

  async confirmEmailChange(userId: string, dto: ConfirmEmailChangeDto) {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        pendingEmail: true,
        pendingEmailCodeHash: true,
        pendingEmailExpiresAt: true,
        pendingEmailAttempts: true,
      },
    });
    const invalidMessage = "Invalid or expired email-change code.";
    if (
      !user?.pendingEmail ||
      user.pendingEmail !== normalizedEmail ||
      !user.pendingEmailCodeHash ||
      !user.pendingEmailExpiresAt
    ) {
      throw new BadRequestException(invalidMessage);
    }

    if (
      user.pendingEmailExpiresAt <= new Date() ||
      user.pendingEmailAttempts >= 5
    ) {
      await this.clearPendingEmailChange(userId);
      throw new BadRequestException(invalidMessage);
    }

    if (
      !this.credentialMatches(
        dto.code,
        "email-change",
        user.pendingEmailCodeHash,
      )
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { pendingEmailAttempts: { increment: 1 } },
      });
      throw new BadRequestException(invalidMessage);
    }

    try {
      await this.prisma.$transaction([
        this.prisma.user.update({
          where: { id: userId },
          data: {
            email: normalizedEmail,
            emailVerifiedAt: new Date(),
            pendingEmail: null,
            pendingEmailCodeHash: null,
            pendingEmailExpiresAt: null,
            pendingEmailAttempts: 0,
            pendingEmailLastSentAt: null,
          },
        }),
        this.prisma.oAuthAccount.deleteMany({ where: { userId } }),
        this.prisma.userSession.updateMany({
          where: { userId, revokedAt: null },
          data: {
            revokedAt: new Date(),
            revocationReason: "EMAIL_CHANGED",
          },
        }),
      ]);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BadRequestException("This email cannot be used.");
      }
      throw error;
    }

    await this.record(userId, "auth.email_changed", "User", userId);
    this.runAfterResponse(
      this.mailService.sendEmailChangedNotice(user.email),
      "email-changed security notice",
    );
    return {
      success: true,
      message: "Email changed. Please sign in again.",
    };
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
          verificationCodeHash: true,
          verificationAttempts: true,
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
      throw new BadRequestException("Invalid or expired verification code.");
    }

    if (pendingRegistration) {
      if (
        pendingRegistration.expiresAt <= new Date() ||
        pendingRegistration.verificationAttempts >= 5
      ) {
        await this.prisma.pendingRegistration.delete({
          where: { id: pendingRegistration.id },
        });
        throw new BadRequestException("Invalid or expired verification code.");
      }

      if (
        !this.credentialMatches(
          dto.code,
          "registration-verification",
          pendingRegistration.verificationCodeHash,
        )
      ) {
        await this.prisma.pendingRegistration.update({
          where: { id: pendingRegistration.id },
          data: { verificationAttempts: { increment: 1 } },
        });
        throw new BadRequestException("Invalid or expired verification code.");
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
      throw new BadRequestException("Invalid or expired verification code.");
    }

    this.assertUserCanAuthenticate(user);

    const verificationToken = await this.prisma.verificationToken.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (
      !verificationToken ||
      verificationToken.expiresAt <= new Date() ||
      verificationToken.attempts >= 5
    ) {
      await this.prisma.verificationToken.deleteMany({
        where: {
          userId: user.id,
        },
      });
      throw new BadRequestException("Invalid or expired verification code.");
    }

    if (
      !this.credentialMatches(
        dto.code,
        "user-verification",
        verificationToken.tokenHash,
      )
    ) {
      await this.prisma.verificationToken.update({
        where: { id: verificationToken.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException("Invalid or expired verification code.");
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
          verificationCodeHash: true,
          expiresAt: true,
          lastSentAt: true,
        },
      });

    if (pendingRegistration) {
      if (Date.now() - pendingRegistration.lastSentAt.getTime() < 60_000) {
        return { message: this.verificationResendMessage };
      }
      const verificationCode = this.generateNumericCode();
      const expiresAt = this.buildVerificationExpiry();

      await this.prisma.pendingRegistration.update({
        where: { id: pendingRegistration.id },
        data: {
          verificationCodeHash: this.hashCredential(
            verificationCode,
            "registration-verification",
          ),
          verificationAttempts: 0,
          expiresAt,
          lastSentAt: new Date(),
        },
      });

      this.runAfterResponse(
        this.mailService
          .sendVerificationEmail(pendingRegistration.email, verificationCode)
          .catch(async (error) => {
            await this.prisma.pendingRegistration.updateMany({
              where: {
                id: pendingRegistration.id,
                verificationCodeHash: this.hashCredential(
                  verificationCode,
                  "registration-verification",
                ),
              },
              data: {
                verificationCodeHash: pendingRegistration.verificationCodeHash,
                expiresAt: pendingRegistration.expiresAt,
                lastSentAt: pendingRegistration.lastSentAt,
              },
            });
            throw error;
          }),
        "pending verification email",
      );

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

    await this.sendVerificationCode(user.id, user.email);
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

    const recentToken = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      recentToken &&
      Date.now() - recentToken.createdAt.getTime() < 10 * 60_000
    ) {
      return { message: this.passwordResetMessage };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const passwordResetCredential = await this.prisma.passwordResetToken.create(
      {
        data: {
          userId: user.id,
          tokenHash: this.hashCredential(token, "password-reset"),
          expiresAt,
        },
      },
    );

    this.runAfterResponse(
      this.mailService
        .sendPasswordResetEmail(user.email, token)
        .catch(async (error) => {
          await this.prisma.passwordResetToken.deleteMany({
            where: { id: passwordResetCredential.id },
          });
          throw error;
        }),
      "password reset email",
    );
    await this.record(
      user.id,
      "auth.password_reset.requested",
      "User",
      user.id,
    );

    return { message: this.passwordResetMessage };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const passwordResetToken = await this.prisma.passwordResetToken.findUnique({
      where: {
        tokenHash: this.hashCredential(dto.token, "password-reset"),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
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
        data: {
          passwordHash,
          failedLoginAttempts: 0,
          loginLockedUntil: null,
        },
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
    this.runAfterResponse(
      this.mailService.sendPasswordChangedNotice(passwordResetToken.user.email),
      "password-changed security notice",
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
    context?: { ipAddress?: string; userAgent?: string },
  ) {
    const providerAccountId = profile.id;
    const email = profile.emails?.[0]?.value?.toLowerCase();
    const name = (profile.displayName || "Google User").slice(0, 120);
    const emailVerified =
      profile.emails?.some(
        (candidate: { value?: string; verified?: boolean }) =>
          candidate.value?.toLowerCase() === email &&
          candidate.verified === true,
      ) || profile._json?.email_verified === true;

    if (!providerAccountId || !email || !emailVerified) {
      throw new BadRequestException(
        "Google did not provide a verified email address.",
      );
    }

    const oauthAccount = await this.prisma.oAuthAccount.findUnique({
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
        data: {
          emailVerifiedAt: oauthAccount.user.emailVerifiedAt ?? new Date(),
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
          loginLockedUntil: null,
        },
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
      return this.buildAuthResponse(oauthAccount.user.id, undefined, {
        sessionContext: context,
      });
    }

    let user = await this.prisma.user.findUnique({ where: { email } });

    if (user) {
      this.assertUserCanAuthenticate(user);
      await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: "GOOGLE",
          providerAccountId,
          email,
        },
      });
      if (!user.emailVerifiedAt) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }
      await this.record(user.id, "oauth.linked", "User", user.id, {
        provider: "GOOGLE",
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          name,
          email,
          emailVerifiedAt: new Date(),
          oauthAccounts: {
            create: {
              provider: "GOOGLE",
              providerAccountId,
              email,
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
      data: {
        lastLoginAt: new Date(),
        failedLoginAttempts: 0,
        loginLockedUntil: null,
      },
    });

    return this.buildAuthResponse(user.id, undefined, {
      sessionContext: context,
    });
  }

  private async sendVerificationCode(userId: string, email: string) {
    const existingToken = await this.prisma.verificationToken.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      existingToken &&
      Date.now() - existingToken.createdAt.getTime() < 60_000
    ) {
      return false;
    }

    await this.prisma.verificationToken.deleteMany({
      where: { userId },
    });

    const token = this.generateNumericCode();

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);

    const verificationCredential = await this.prisma.verificationToken.create({
      data: {
        userId,
        tokenHash: this.hashCredential(token, "user-verification"),
        expiresAt,
      },
    });

    this.runAfterResponse(
      this.mailService
        .sendVerificationEmail(email, token)
        .catch(async (error) => {
          await this.prisma.verificationToken.deleteMany({
            where: { id: verificationCredential.id },
          });
          throw error;
        }),
      "verification email",
    );
    return true;
  }

  private generateNumericCode() {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  }

  private buildVerificationExpiry() {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 15);
    return expiresAt;
  }

  private hashCredential(value: string, purpose: string) {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET is required.");
    }
    return crypto
      .createHmac("sha256", secret)
      .update(`${purpose}\0${value}`)
      .digest("hex");
  }

  private oauthBridgeKey() {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) throw new Error("JWT_SECRET is required.");
    return crypto
      .createHash("sha256")
      .update(`oauth-session-bridge\0${secret}`)
      .digest();
  }

  private hashOAuthBridge(bridge: string) {
    return crypto.createHash("sha256").update(bridge).digest("hex");
  }

  private verifySessionToken(token: string) {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) throw new Error("JWT_SECRET is required.");
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      audience: this.config.get<string>("JWT_AUDIENCE") ?? "nimto-web",
      issuer: this.config.get<string>("JWT_ISSUER") ?? "nimto-api",
    }) as { sessionId?: unknown };
    if (typeof payload.sessionId !== "string" || !payload.sessionId) {
      throw new UnauthorizedException("Invalid session token.");
    }
    return { sessionId: payload.sessionId };
  }

  private credentialMatches(
    value: string,
    purpose: string,
    expectedHash: string,
  ) {
    const actual = Buffer.from(this.hashCredential(value, purpose), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  }

  private clearPendingEmailChange(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: null,
        pendingEmailCodeHash: null,
        pendingEmailExpiresAt: null,
        pendingEmailAttempts: 0,
        pendingEmailLastSentAt: null,
      },
    });
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
    options: {
      afterSessionCreated?: (sessionId: string) => void;
      sessionContext?: { ipAddress?: string; userAgent?: string };
    } = {},
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

    const sessionId = crypto.randomBytes(32).toString("hex");

    const token = jwt.sign(
      {
        email: user.email,
        sessionId,
      },
      secret,
      {
        algorithm: "HS256",
        audience: this.config.get<string>("JWT_AUDIENCE") ?? "nimto-web",
        issuer: this.config.get<string>("JWT_ISSUER") ?? "nimto-api",
        subject: user.id,
        expiresIn: "7d",
      },
    );

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.$transaction(async (transaction) => {
      await transaction.userSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          tokenHash,
          ipAddress: options.sessionContext?.ipAddress?.slice(0, 64),
          userAgent: options.sessionContext?.userAgent?.slice(0, 500),
          expiresAt,
        },
      });

      const excessSessions = await transaction.userSession.findMany({
        where: { userId: user.id, revokedAt: null },
        orderBy: { createdAt: "desc" },
        skip: 10,
        select: { id: true },
      });
      if (excessSessions.length) {
        await transaction.userSession.updateMany({
          where: { id: { in: excessSessions.map((session) => session.id) } },
          data: {
            revokedAt: new Date(),
            revocationReason: "ADMIN_FORCE_LOGOUT",
          },
        });
      }
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
    void work.catch(() => {
      this.logger.error(`Failed to complete ${label}.`);
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
