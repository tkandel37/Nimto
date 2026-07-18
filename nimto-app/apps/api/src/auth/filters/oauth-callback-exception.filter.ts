import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  Injectable,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";

@Catch()
@Injectable()
export class OAuthCallbackExceptionFilter implements ExceptionFilter {
  constructor(private readonly config: ConfigService) {}

  catch(_exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const frontendUrl =
      this.config.get<string>("FRONTEND_URL") ?? "http://localhost:3000";
    const primaryFrontendUrl = frontendUrl
      .split(",")[0]
      .trim()
      .replace(/\/$/, "");

    response.clearCookie("nimto_oauth_state", {
      httpOnly: true,
      path: "/auth/google",
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
    });
    response.setHeader("Cache-Control", "no-store");
    response.redirect(
      303,
      `${primaryFrontendUrl}/auth?mode=login&oauthError=restart`,
    );
  }
}
