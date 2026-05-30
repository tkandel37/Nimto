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
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailService: MailService,
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

      return this.buildAuthResponse(user);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new BadRequestException("An account with this email already exists.");
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

    const passwordsMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordsMatch) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    return this.buildAuthResponse(user);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
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

  private buildAuthResponse(user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  }) {
    const secret = this.config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET is required.");
    }

    const token = jwt.sign(
      {
        email: user.email,
      },
      secret,
      {
        subject: user.id,
        expiresIn: "7d",
      },
    );

    return {
      token,
      user: this.toPublicUser(user),
    };
  }

  private toPublicUser(user: {
    id: string;
    name: string;
    email: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      createdAt: user.createdAt,
    };
  }
}
