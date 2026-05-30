import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { GoogleStrategy } from "./strategies/google.strategy";

@Module({
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, GoogleStrategy],
})
export class AuthModule {}
