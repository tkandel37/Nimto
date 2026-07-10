import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("health")
  health() {
    return {
      ok: true,
      service: "nimto-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("auth/register")
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("auth/login")
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("auth/forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("auth/reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("auth/verify-email")
  verifyEmailCode(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmailCode(dto);
  }

  @Post("auth/verify-email/resend")
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("auth/me")
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch("auth/profile")
  updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.updateProfile(request.user!.sub, dto);
  }

  @Get("auth/verify-email")
  verifyEmail(@Req() request: any) {
    const token = request.query.token as string;
    if (!token) {
      throw new BadRequestException("Token is required.");
    }
    return this.authService.verifyEmail(token);
  }

  @UseGuards(JwtAuthGuard)
  @Post("auth/logout")
  logout(@Req() request: AuthenticatedRequest) {
    if (request.user?.sessionId) {
      return this.authService.logout(request.user.sessionId);
    }
    return { success: true };
  }

  @Get("auth/google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {
    // Initiates the Google OAuth2 login flow
  }

  @Get("auth/google/callback")
  @UseGuards(AuthGuard("google"))
  googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const { token } = req.user;
    // Redirect back to frontend with the token
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const primaryFrontendUrl = frontendUrl
      .split(",")[0]
      .trim()
      .replace(/\/$/, "");
    res.redirect(`${primaryFrontendUrl}/auth/oauth-success?token=${token}`);
  }
}
