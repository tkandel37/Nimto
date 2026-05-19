import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import {
  AuthenticatedRequest,
  JwtAuthGuard,
} from "./jwt-auth.guard";

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

  @UseGuards(JwtAuthGuard)
  @Get("auth/me")
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.me(request.user!.sub);
  }
}
