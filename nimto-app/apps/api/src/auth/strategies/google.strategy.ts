import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";
import { Request } from "express";
import { AuthService } from "../auth.service";
import { OAuthStateStore } from "../oauth-state.store";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(
    private readonly config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: config.get<string>("GOOGLE_CLIENT_ID") || "temp-client-id",
      clientSecret:
        config.get<string>("GOOGLE_CLIENT_SECRET") || "temp-client-secret",
      callbackURL:
        config.get<string>("GOOGLE_CALLBACK_URL") ||
        "http://localhost:4000/auth/google/callback",
      passReqToCallback: true,
      pkce: "S256",
      scope: ["email", "profile"],
      store: new OAuthStateStore(config),
    } as any);
  }

  async validate(
    request: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      const user = await this.authService.validateOAuthLogin(profile, {
        ipAddress: request.ip,
        userAgent: request.headers["user-agent"],
      });
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
