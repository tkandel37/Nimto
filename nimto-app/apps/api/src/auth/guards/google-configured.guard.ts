import { CanActivate, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GoogleConfiguredGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate() {
    if (
      this.config.get<string>("GOOGLE_CLIENT_ID") &&
      this.config.get<string>("GOOGLE_CLIENT_SECRET") &&
      this.config.get<string>("GOOGLE_CALLBACK_URL")
    ) {
      return true;
    }
    throw new NotFoundException("Google authentication is not configured.");
  }
}
