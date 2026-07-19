import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
  UseFilters,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "@nestjs/passport";
import { minutes, Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { VerifyEmailDto } from "./dto/verify-email.dto";
import { ResendVerificationDto } from "./dto/resend-verification.dto";
import { AuthenticatedRequest, JwtAuthGuard } from "./jwt-auth.guard";
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import {
  AUTH_COOKIE_SENTINEL,
  clearSessionCookie,
  setSessionCookie,
} from "./session-cookie";
import { GoogleConfiguredGuard } from "./guards/google-configured.guard";
import { ClaimOAuthSessionDto } from "./dto/claim-oauth-session.dto";
import { OAuthCallbackExceptionFilter } from "./filters/oauth-callback-exception.filter";
import { LogoutAuthGuard } from "./guards/logout-auth.guard";

@Controller()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Get("health")
  health() {
    return {
      ok: true,
      service: "nimto-api",
      timestamp: new Date().toISOString(),
    };
  }

  @Post("auth/register")
  @Throttle({
    default: { limit: 5, ttl: minutes(15), blockDuration: minutes(15) },
  })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("auth/login")
  @Throttle({
    default: { limit: 8, ttl: minutes(15), blockDuration: minutes(15) },
  })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const auth = await this.authService.login(dto, this.context(request));
    setSessionCookie(response, auth.token, this.config);
    response.setHeader("Cache-Control", "no-store");
    return { user: auth.user, token: AUTH_COOKIE_SENTINEL };
  }

  @Post("auth/forgot-password")
  @Throttle({
    default: { limit: 3, ttl: minutes(15), blockDuration: minutes(30) },
  })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("auth/reset-password")
  @Throttle({
    default: { limit: 5, ttl: minutes(15), blockDuration: minutes(30) },
  })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post("auth/verify-email")
  @Throttle({
    default: { limit: 10, ttl: minutes(15), blockDuration: minutes(30) },
  })
  verifyEmailCode(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmailCode(dto);
  }

  @Post("auth/verify-email/resend")
  @Throttle({
    default: { limit: 3, ttl: minutes(15), blockDuration: minutes(30) },
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get("auth/me")
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!.sub);
  }

  @Post("auth/oauth/session")
  @Throttle({
    default: { limit: 10, ttl: minutes(15), blockDuration: minutes(15) },
  })
  async claimOAuthSession(
    @Body() dto: ClaimOAuthSessionDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = await this.authService.consumeOAuthSessionBridge(dto.bridge);
    setSessionCookie(response, token, this.config);
    response.setHeader("Cache-Control", "no-store");
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Patch("auth/profile")
  @Throttle({
    default: { limit: 10, ttl: minutes(15), blockDuration: minutes(15) },
  })
  updateProfile(
    @Body() dto: UpdateProfileDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.updateProfile(request.user!.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post("auth/profile/email/confirm")
  @Throttle({
    default: { limit: 8, ttl: minutes(15), blockDuration: minutes(30) },
  })
  async confirmEmailChange(
    @Body() dto: ConfirmEmailChangeDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.confirmEmailChange(
      request.user!.sub,
      dto,
    );
    clearSessionCookie(response, this.config);
    return result;
  }

  @UseGuards(LogoutAuthGuard)
  @Post("auth/logout")
  async logout(
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    clearSessionCookie(response, this.config);
    if (request.user?.sessionId) {
      await this.authService.logout(request.user.sessionId);
    }
    return { success: true };
  }

  @Get("auth/google")
  @Throttle({
    default: { limit: 10, ttl: minutes(15), blockDuration: minutes(15) },
  })
  @UseGuards(GoogleConfiguredGuard, AuthGuard("google"))
  async googleAuth() {
    // Initiates the Google OAuth2 login flow
  }

  @Get("auth/google/callback")
  @Throttle({
    default: { limit: 20, ttl: minutes(15), blockDuration: minutes(15) },
  })
  @UseFilters(OAuthCallbackExceptionFilter)
  @UseGuards(GoogleConfiguredGuard, AuthGuard("google"))
  async googleAuthRedirect(@Req() req: any, @Res() res: Response) {
    const { token } = req.user;
    setSessionCookie(res, token, this.config);
    const bridge = await this.authService.createOAuthSessionBridge(token);
    const frontendUrl =
      process.env.FRONTEND_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "http://localhost:3000";
    const primaryFrontendUrl = frontendUrl
      .split(",")[0]
      .trim()
      .replace(/\/$/, "");
    res.setHeader("Cache-Control", "no-store");
    res.redirect(
      303,
      `${primaryFrontendUrl}/auth/oauth-success#bridge=${encodeURIComponent(bridge)}`,
    );
  }

  private context(request: Request) {
    return {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };
  }
}
