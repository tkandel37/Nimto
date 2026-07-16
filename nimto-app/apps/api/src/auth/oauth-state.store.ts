import { ConfigService } from "@nestjs/config";
import crypto from "crypto";
import { Request, Response } from "express";

const OAUTH_STATE_COOKIE = "nimto_oauth_state";
const STATE_TTL_MS = 10 * 60 * 1000;

type OAuthRequest = Request & { res?: Response };
type StoreCallback = (error: Error | null, state?: string) => void;
type VerifyCallback = (
  error: Error | null,
  ok?: string | false,
  state?: unknown,
) => void;

export class OAuthStateStore {
  private readonly encryptionKey: Buffer;
  private readonly secure: boolean;

  constructor(config: ConfigService) {
    const secret = config.get<string>("JWT_SECRET");
    if (!secret) {
      throw new Error("JWT_SECRET is required for OAuth state protection.");
    }
    this.encryptionKey = crypto
      .createHash("sha256")
      .update(`oauth-state\0${secret}`)
      .digest();
    this.secure = config.get<string>("NODE_ENV") === "production";
  }

  store(
    request: OAuthRequest,
    verifier: string,
    state: unknown,
    _meta: unknown,
    callback: StoreCallback,
  ) {
    try {
      if (!request.res) {
        return callback(new Error("OAuth response is unavailable."));
      }

      const nonce = crypto.randomBytes(32).toString("base64url");
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        iv,
      );
      const plaintext = JSON.stringify({
        verifier,
        nonce,
        expiresAt: Date.now() + STATE_TTL_MS,
        state,
      });
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const authTag = cipher.getAuthTag();
      const encryptedState = Buffer.concat([iv, authTag, ciphertext]).toString(
        "base64url",
      );

      request.res.cookie(OAUTH_STATE_COOKIE, nonce, {
        httpOnly: true,
        maxAge: STATE_TTL_MS,
        path: "/auth/google",
        sameSite: "lax",
        secure: this.secure,
        priority: "high",
      });
      callback(null, encryptedState);
    } catch (error) {
      callback(
        error instanceof Error ? error : new Error("OAuth state failed."),
      );
    }
  }

  verify(
    request: OAuthRequest,
    providedState: string,
    _meta: unknown,
    callback: VerifyCallback,
  ) {
    try {
      const cookieNonce = this.readCookie(request, OAUTH_STATE_COOKIE);
      request.res?.clearCookie(OAUTH_STATE_COOKIE, {
        httpOnly: true,
        path: "/auth/google",
        sameSite: "lax",
        secure: this.secure,
      });
      if (!cookieNonce || !providedState || providedState.length > 2048) {
        return callback(null, false, {
          message: "Unable to verify the OAuth request state.",
        });
      }

      const encoded = Buffer.from(providedState, "base64url");
      if (encoded.length < 29) {
        return callback(null, false, { message: "Invalid OAuth state." });
      }
      const iv = encoded.subarray(0, 12);
      const authTag = encoded.subarray(12, 28);
      const ciphertext = encoded.subarray(28);
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);
      const decoded = JSON.parse(
        Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
          "utf8",
        ),
      ) as {
        verifier?: unknown;
        nonce?: unknown;
        expiresAt?: unknown;
        state?: unknown;
      };

      if (
        typeof decoded.verifier !== "string" ||
        typeof decoded.nonce !== "string" ||
        typeof decoded.expiresAt !== "number" ||
        decoded.expiresAt <= Date.now() ||
        !this.safeEqual(cookieNonce, decoded.nonce)
      ) {
        return callback(null, false, { message: "Invalid OAuth state." });
      }

      callback(null, decoded.verifier, decoded.state);
    } catch {
      callback(null, false, { message: "Invalid OAuth state." });
    }
  }

  private readCookie(request: Request, name: string) {
    for (const pair of request.headers.cookie?.split(";") ?? []) {
      const separator = pair.indexOf("=");
      if (separator < 0 || pair.slice(0, separator).trim() !== name) continue;
      try {
        return decodeURIComponent(pair.slice(separator + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private safeEqual(left: string, right: string) {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return (
      leftBuffer.length === rightBuffer.length &&
      crypto.timingSafeEqual(leftBuffer, rightBuffer)
    );
  }
}
