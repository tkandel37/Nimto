import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { ExecutionContext } from "@nestjs/common";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { validateEnvironment } from "../src/config/environment";
import { JwtAuthGuard } from "../src/auth/jwt-auth.guard";
import { OAuthStateStore } from "../src/auth/oauth-state.store";
import {
  SESSION_COOKIE_NAME,
  setSessionCookie,
} from "../src/auth/session-cookie";
import { TemplateDesignService } from "../src/template-design/template-design.service";

const strongSecret = "s3cure-production-secret-with-more-than-32-characters!";

test("production configuration rejects weak secrets and partial OAuth", () => {
  assert.throws(() =>
    validateEnvironment({
      NODE_ENV: "production",
      JWT_SECRET: "replace-with-production-secret",
      FRONTEND_URL: "https://nimto.example",
    }),
  );
  assert.throws(() =>
    validateEnvironment({
      NODE_ENV: "production",
      JWT_SECRET: strongSecret,
      FRONTEND_URL: "https://nimto.example/path",
    }),
  );
  assert.throws(() =>
    validateEnvironment({
      NODE_ENV: "production",
      JWT_SECRET: strongSecret,
      FRONTEND_URL: "https://nimto.example",
      GOOGLE_CLIENT_ID: "client-id",
    }),
  );
  assert.doesNotThrow(() =>
    validateEnvironment({
      NODE_ENV: "production",
      JWT_SECRET: strongSecret,
      FRONTEND_URL: "http://localhost:3000",
      AUTH_COOKIE_SAME_SITE: "lax",
    }),
  );
});

test("session cookies are HttpOnly and Secure in production", () => {
  let captured:
    | { name: string; value: string; options: Record<string, unknown> }
    | undefined;
  const response = {
    cookie(name: string, value: string, options: Record<string, unknown>) {
      captured = { name, value, options };
    },
  };

  setSessionCookie(
    response as never,
    "signed-token",
    new ConfigService({ NODE_ENV: "production" }),
  );

  assert.equal(captured?.name, SESSION_COOKIE_NAME);
  assert.equal(captured?.value, "signed-token");
  assert.equal(captured?.options.httpOnly, true);
  assert.equal(captured?.options.secure, true);
  assert.equal(captured?.options.sameSite, "none");

  setSessionCookie(
    response as never,
    "same-site-token",
    new ConfigService({
      NODE_ENV: "production",
      AUTH_COOKIE_SAME_SITE: "lax",
    }),
  );
  assert.equal(captured?.options.sameSite, "lax");
});

test("OAuth state is encrypted, browser-bound, and returns the PKCE verifier", async () => {
  const config = new ConfigService({
    JWT_SECRET: strongSecret,
    NODE_ENV: "production",
  });
  const store = new OAuthStateStore(config);
  let nonce = "";
  const response = {
    cookie(_name: string, value: string) {
      nonce = value;
    },
    clearCookie() {},
  };
  const request = { headers: {}, res: response };

  const encryptedState = await new Promise<string>((resolve, reject) => {
    store.store(
      request as never,
      "pkce-verifier",
      { returnTo: "/events" },
      {},
      (error, state) => {
        if (error || !state) reject(error ?? new Error("Missing state"));
        else resolve(state);
      },
    );
  });

  assert.ok(nonce.length >= 40);
  assert.equal(encryptedState.includes("pkce-verifier"), false);
  (request.headers as { cookie: string }).cookie =
    `${SESSION_COOKIE_NAME}=unrelated; nimto_oauth_state=${nonce}`;

  const verified = await new Promise<{
    ok?: string | false;
    state?: unknown;
  }>((resolve, reject) => {
    store.verify(request as never, encryptedState, {}, (error, ok, state) => {
      if (error) reject(error);
      else resolve({ ok, state });
    });
  });

  assert.equal(verified.ok, "pkce-verifier");
  assert.deepEqual(verified.state, { returnTo: "/events" });
});

test("cookie-authenticated writes require the browser sentinel and a live DB session", async () => {
  const config = new ConfigService({
    JWT_SECRET: strongSecret,
    JWT_ISSUER: "nimto-api",
    JWT_AUDIENCE: "nimto-web",
  });
  const sessionId = crypto.randomBytes(32).toString("hex");
  const token = jwt.sign(
    { email: "user@example.com", sessionId },
    strongSecret,
    {
      algorithm: "HS256",
      audience: "nimto-web",
      issuer: "nimto-api",
      subject: "user-id",
      expiresIn: "5m",
    },
  );
  const session = {
    tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt: new Date(Date.now() + 300_000),
    revokedAt: null as Date | null,
    userId: "user-id",
    user: {
      email: "user@example.com",
      emailVerifiedAt: new Date(),
      status: "ACTIVE",
    },
  };
  const prisma = {
    userSession: { findUnique: async () => session },
  };
  const guard = new JwtAuthGuard(config, prisma as never);
  const request = {
    method: "POST",
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    } as { cookie: string; authorization?: string },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  await assert.rejects(() => guard.canActivate(context));

  request.headers.authorization = "Bearer cookie";
  assert.equal(await guard.canActivate(context), true);
  assert.deepEqual((request as { user?: unknown }).user, {
    sub: "user-id",
    email: "user@example.com",
    sessionId,
  });

  session.revokedAt = new Date();
  await assert.rejects(() => guard.canActivate(context));
});

test("uploaded invitation HTML rejects executable behavior", () => {
  const service = new TemplateDesignService({} as never, {} as never) as any;

  assert.throws(() =>
    service.assertSafeUploadedHtml("<div><script>alert(1)</script></div>", {
      requireCompleteDocument: false,
    }),
  );
  assert.throws(() =>
    service.assertSafeUploadedHtml('<div onclick="alert(1)">Open</div>', {
      requireCompleteDocument: false,
    }),
  );
  assert.throws(() =>
    service.assertStrictTemplateUpload(
      "<!doctype html><html><head><style>body{background:url(https://evil.example)}</style></head><body></body></html>",
    ),
  );
});
