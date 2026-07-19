import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { GoogleStrategy } from "./strategies/google.strategy";
import { AuditModule } from "../audit/audit.module";
import { GoogleConfiguredGuard } from "./guards/google-configured.guard";
import { OAuthCallbackExceptionFilter } from "./filters/oauth-callback-exception.filter";
import { LogoutAuthGuard } from "./guards/logout-auth.guard";

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    LogoutAuthGuard,
    PermissionsGuard,
    GoogleConfiguredGuard,
    GoogleStrategy,
    OAuthCallbackExceptionFilter,
  ],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
