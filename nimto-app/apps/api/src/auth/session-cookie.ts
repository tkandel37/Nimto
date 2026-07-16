import { ConfigService } from "@nestjs/config";
import { Request, Response, CookieOptions } from "express";

export const SESSION_COOKIE_NAME = "nimto_session";
export const AUTH_COOKIE_SENTINEL = "cookie";

function cookieOptions(config: ConfigService): CookieOptions {
  const configuredSameSite = config
    .get<string>("AUTH_COOKIE_SAME_SITE")
    ?.toLowerCase();
  const sameSite = configuredSameSite === "none" ? "none" : "lax";
  const production = config.get<string>("NODE_ENV") === "production";

  return {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
    sameSite,
    secure: production || sameSite === "none",
    priority: "high",
  };
}

export function setSessionCookie(
  response: Response,
  token: string,
  config: ConfigService,
) {
  response.cookie(SESSION_COOKIE_NAME, token, cookieOptions(config));
}

export function clearSessionCookie(response: Response, config: ConfigService) {
  const options = cookieOptions(config);
  delete options.maxAge;
  response.clearCookie(SESSION_COOKIE_NAME, options);
}

export function readSessionCookie(request: Request) {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1));
    } catch {
      return undefined;
    }
  }

  return undefined;
}
