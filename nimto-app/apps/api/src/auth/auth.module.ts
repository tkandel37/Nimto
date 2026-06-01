import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PermissionsGuard } from "./guards/permissions.guard";
import { GoogleStrategy } from "./strategies/google.strategy";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [AuditModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, PermissionsGuard, GoogleStrategy],
  exports: [AuthService, JwtAuthGuard, PermissionsGuard],
})
export class AuthModule {}
