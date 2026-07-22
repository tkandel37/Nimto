import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import {
  ArgumentsHost,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
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
import { AuthService } from "../src/auth/auth.service";
import { OAuthCallbackExceptionFilter } from "../src/auth/filters/oauth-callback-exception.filter";
import { LogoutAuthGuard } from "../src/auth/guards/logout-auth.guard";
import { AdminService } from "../src/admin/admin.service";
import { AuthController } from "../src/auth/auth.controller";
import { EventsService } from "../src/events/events.service";

const strongSecret = "s3cure-production-secret-with-more-than-32-characters!";

test("mobile login returns the revocable bearer session without changing browser cookie login", async () => {
  const auth = {
    token: "signed-mobile-session",
    user: { id: "user-id", email: "host@example.com", name: "Host" },
  };
  let capturedContext: { ipAddress?: string; userAgent?: string } | undefined;
  const service = {
    login: async (
      _dto: { email: string; password: string },
      context: { ipAddress?: string; userAgent?: string },
    ) => {
      capturedContext = context;
      return auth;
    },
  };
  const controller = new AuthController(
    service as never,
    new ConfigService({ JWT_SECRET: strongSecret }),
  );

  const result = await controller.mobileLogin(
    { email: "host@example.com", password: "Valid-password1!" },
    {
      ip: "127.0.0.1",
      headers: { "user-agent": "myNimto mobile test" },
    } as never,
  );

  assert.deepEqual(result, auth);
  assert.deepEqual(capturedContext, {
    ipAddress: "127.0.0.1",
    userAgent: "myNimto mobile test",
  });
});

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

test("verified Google login repairs legacy accounts without an email verification timestamp", async () => {
  let updatedData: Record<string, unknown> | undefined;
  const prisma = {
    oAuthAccount: {
      findUnique: async () => ({
        id: "oauth-account-id",
        user: {
          id: "legacy-user-id",
          status: "ACTIVE",
          emailVerifiedAt: null,
        },
      }),
    },
    user: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updatedData = data;
      },
    },
  };
  const audit = { record: async () => undefined };
  const service = new AuthService(
    prisma as never,
    new ConfigService({ JWT_SECRET: strongSecret }),
    {} as never,
    audit as never,
  );
  (service as any).buildAuthResponse = async (userId: string) => ({ userId });

  const response = await service.validateOAuthLogin({
    id: "google-provider-id",
    displayName: "Legacy User",
    emails: [{ value: "legacy@example.com", verified: true }],
  });

  assert.equal(
    (response as unknown as { userId: string }).userId,
    "legacy-user-id",
  );
  assert.ok(updatedData?.emailVerifiedAt instanceof Date);
});

test("OAuth session handoff is encrypted, short-lived, and single-use", async () => {
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
  let storedClaimHash = "";
  let used = false;
  const prisma = {
    userSession: {
      update: async ({ data }: { data: { oauthClaimHash: string } }) => {
        storedClaimHash = data.oauthClaimHash;
      },
      updateMany: async ({ where }: { where: { oauthClaimHash: string } }) => {
        const matches = !used && where.oauthClaimHash === storedClaimHash;
        used = true;
        return { count: matches ? 1 : 0 };
      },
    },
  };
  const service = new AuthService(
    prisma as never,
    new ConfigService({
      JWT_SECRET: strongSecret,
      JWT_ISSUER: "nimto-api",
      JWT_AUDIENCE: "nimto-web",
    }),
    {} as never,
    {} as never,
  );

  const bridge = await service.createOAuthSessionBridge(token);
  assert.equal(bridge.includes(token), false);
  assert.equal(await service.consumeOAuthSessionBridge(bridge), token);
  await assert.rejects(() => service.consumeOAuthSessionBridge(bridge));
});

test("replayed OAuth callbacks recover to the frontend instead of exposing a 401", () => {
  let redirectStatus = 0;
  let redirectUrl = "";
  let clearedCookie = "";
  const response = {
    clearCookie(name: string) {
      clearedCookie = name;
    },
    setHeader() {},
    redirect(status: number, url: string) {
      redirectStatus = status;
      redirectUrl = url;
    },
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  const filter = new OAuthCallbackExceptionFilter(
    new ConfigService({
      NODE_ENV: "production",
      FRONTEND_URL: "https://www.mynimto.com",
    }),
  );

  filter.catch(new Error("Replayed callback"), host);

  assert.equal(clearedCookie, "nimto_oauth_state");
  assert.equal(redirectStatus, 303);
  assert.equal(
    redirectUrl,
    "https://www.mynimto.com/auth?mode=login&oauthError=restart",
  );
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

test("logout remains CSRF-protected but permits clearing an invalid cookie", async () => {
  const request = {
    headers: {} as { authorization?: string },
  };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  const requiredGuard = {
    canActivate: async () => {
      throw new UnauthorizedException("Expired session");
    },
  };
  const guard = new LogoutAuthGuard(requiredGuard as unknown as JwtAuthGuard);

  await assert.rejects(() => guard.canActivate(context));

  request.headers.authorization = "Bearer cookie";
  assert.equal(await guard.canActivate(context), true);
});

test("admin dashboard summary reuses its short-lived database result", async () => {
  let countCalls = 0;
  const count = async () => {
    countCalls += 1;
    return countCalls;
  };
  const prisma = {
    event: { count },
    role: { count },
    user: { count },
    userSession: { count },
    auditLog: { count },
    $transaction: (queries: Promise<number>[]) => Promise.all(queries),
  };
  const service = new AdminService(prisma as never, {} as never);
  const userId = `summary-cache-${Date.now()}`;

  const first = await service.dashboardSummary(userId);
  const second = await service.dashboardSummary(userId);

  assert.deepEqual(second, first);
  assert.equal(countCalls, 6);
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

test("event design values only accept editable free template fields", () => {
  const service = new EventsService({} as never, {} as never) as any;
  const scanResult = {
    fields: [
      { key: "headline", editableByUser: true },
      { key: "locked_copy", locked: true },
      { key: "guest_name", paid: true },
    ],
  };

  assert.deepEqual(
    service.normalizeDesignFieldValues(scanResult, { headline: "Welcome" }),
    { headline: "Welcome" },
  );
  assert.throws(() =>
    service.normalizeDesignFieldValues(scanResult, { locked_copy: "Changed" }),
  );
  assert.throws(() =>
    service.normalizeDesignFieldValues(scanResult, { guest_name: "Guest" }),
  );
  assert.throws(() =>
    service.normalizeDesignFieldValues(scanResult, { unknown: "Changed" }),
  );
  assert.throws(() =>
    service.normalizeDesignFieldValues(scanResult, {
      headline: { nested: true },
    }),
  );
});

test("event feature drafts are constrained to template capabilities and safe values", () => {
  const service = new EventsService({} as never, {} as never) as any;
  const featureConfig = {
    music: { available: true },
    links: { available: true },
    theme: { available: true },
    rsvp: { available: false },
    sharePreview: { available: true },
  };
  const scanResult = {
    linkableFieldKeys: ["venue"],
    styleSlots: [{ key: "accentColor" }],
  };

  assert.deepEqual(
    service.normalizeFeatureSettings(featureConfig, scanResult, {
      music: { enabled: true, url: "https://cdn.example.test/song.mp3" },
      rsvp: { enabled: true },
      links: [
        {
          fieldKey: "venue",
          url: "https://maps.example.test/place",
          hoverText: "Open map",
        },
      ],
      theme: { accentColor: "#663355" },
      sharePreview: { title: "Our invitation" },
    }),
    {
      countdown: { enabled: false },
      rsvp: { enabled: false },
      openingAnimation: { enabled: false },
      music: {
        enabled: true,
        url: "https://cdn.example.test/song.mp3",
      },
      additionalInfo: { enabled: false, text: "" },
      links: [
        {
          fieldKey: "venue",
          url: "https://maps.example.test/place",
          hoverText: "Open map",
        },
      ],
      theme: { accentColor: "#663355" },
      sharePreview: {
        title: "Our invitation",
        description: "",
        imageUrl: "",
      },
    },
  );
  assert.throws(() =>
    service.normalizeFeatureSettings(featureConfig, scanResult, {
      links: [{ fieldKey: "venue", url: "javascript:alert(1)" }],
    }),
  );
  assert.throws(() =>
    service.normalizeFeatureSettings(featureConfig, scanResult, {
      theme: { accentColor: "red;}body{display:none}" },
    }),
  );
});

test("publishing requires event details and every editable required field", async () => {
  const prisma = {
    designVersion: {
      findUnique: async () => ({
        scanResult: {
          fields: [
            { key: "headline", label: "Headline", required: true },
            { key: "locked_copy", required: true, locked: true },
          ],
        },
      }),
    },
  };
  const service = new EventsService(prisma as never, {} as never) as any;
  const complete = {
    eventDate: new Date("2027-04-18T06:00:00.000Z"),
    venue: "Kathmandu",
    designVersionId: "version-id",
    designFieldValues: { headline: "You are invited" },
  };

  await assert.doesNotReject(() =>
    service.assertPublishableInvitation(complete),
  );
  await assert.rejects(() =>
    service.assertPublishableInvitation({ ...complete, eventDate: null }),
  );
  await assert.rejects(() =>
    service.assertPublishableInvitation({
      ...complete,
      designFieldValues: {},
    }),
  );
});
