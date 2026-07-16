-- Invalidate legacy plaintext verification/reset credentials before replacing
-- their columns with one-way hashes.
ALTER TYPE "SessionRevocationReason" ADD VALUE 'EMAIL_CHANGED';

DELETE FROM "VerificationToken";
DELETE FROM "PasswordResetToken";
DELETE FROM "PendingRegistration";

DROP INDEX IF EXISTS "VerificationToken_token_idx";
DROP INDEX IF EXISTS "VerificationToken_token_key";
ALTER TABLE "VerificationToken" DROP COLUMN "token";
ALTER TABLE "VerificationToken"
  ADD COLUMN "tokenHash" TEXT NOT NULL,
  ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX "VerificationToken_tokenHash_key"
  ON "VerificationToken"("tokenHash");

DROP INDEX IF EXISTS "PasswordResetToken_token_idx";
DROP INDEX IF EXISTS "PasswordResetToken_token_key";
ALTER TABLE "PasswordResetToken" DROP COLUMN "token";
ALTER TABLE "PasswordResetToken" ADD COLUMN "tokenHash" TEXT NOT NULL;
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key"
  ON "PasswordResetToken"("tokenHash");

ALTER TABLE "PendingRegistration" DROP COLUMN "verificationCode";
ALTER TABLE "PendingRegistration"
  ADD COLUMN "verificationCodeHash" TEXT NOT NULL,
  ADD COLUMN "verificationAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastSentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "User"
  ADD COLUMN "pendingEmail" TEXT,
  ADD COLUMN "pendingEmailCodeHash" TEXT,
  ADD COLUMN "pendingEmailExpiresAt" TIMESTAMP(3),
  ADD COLUMN "pendingEmailAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pendingEmailLastSentAt" TIMESTAMP(3),
  ADD COLUMN "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "loginLockedUntil" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_pendingEmail_key" ON "User"("pendingEmail");

-- OAuth provider credentials are not needed after profile validation and must
-- not remain in the application database or schema.
ALTER TABLE "OAuthAccount"
  DROP COLUMN "accessToken",
  DROP COLUMN "refreshToken";

-- Legacy personalized links contained event and invitee names and were
-- enumerable. Rotate all of them to opaque, random identifiers.
UPDATE "InvitationInvitee"
SET "slug" = 'invite-' || replace(gen_random_uuid()::text, '-', '');

-- JWT verification is tightened by this release. Revoke every old session so
-- deployment never leaves an ambiguous mixture of old and new token formats.
UPDATE "UserSession"
SET "revokedAt" = CURRENT_TIMESTAMP,
    "revocationReason" = 'ADMIN_FORCE_LOGOUT'
WHERE "revokedAt" IS NULL;

-- The runtime login receives this NOLOGIN role as its only database role. RLS
-- policies are scoped to it, so Supabase Data API roles remain denied even if
-- a broad grant is accidentally introduced later.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nimto_runtime') THEN
    CREATE ROLE nimto_runtime
      NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;

REVOKE ALL PRIVILEGES ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO nimto_runtime;

-- The application connects directly with Prisma and does not use Supabase's
-- public Data API. Revoke all Data API privileges and enable RLS on every
-- existing public table, including tables added by earlier migrations.
DO $$
DECLARE
  relation RECORD;
  api_role TEXT;
BEGIN
  FOR relation IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      relation.schemaname,
      relation.tablename
    );
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM PUBLIC',
      relation.schemaname,
      relation.tablename
    );

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON TABLE %I.%I FROM %I',
          relation.schemaname,
          relation.tablename,
          api_role
        );
      END IF;
    END LOOP;

    IF relation.tablename <> '_prisma_migrations' THEN
      EXECUTE format(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO nimto_runtime',
        relation.schemaname,
        relation.tablename
      );
      EXECUTE format(
        'DROP POLICY IF EXISTS nimto_runtime_full_access ON %I.%I',
        relation.schemaname,
        relation.tablename
      );
      EXECUTE format(
        'CREATE POLICY nimto_runtime_full_access ON %I.%I FOR ALL TO nimto_runtime USING (true) WITH CHECK (true)',
        relation.schemaname,
        relation.tablename
      );
    END IF;
  END LOOP;

  FOR relation IN
    SELECT sequence_schema AS schemaname, sequence_name AS sequencename
    FROM information_schema.sequences
    WHERE sequence_schema = 'public'
  LOOP
    EXECUTE format(
      'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM PUBLIC',
      relation.schemaname,
      relation.sequencename
    );

    FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
    LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
        EXECUTE format(
          'REVOKE ALL PRIVILEGES ON SEQUENCE %I.%I FROM %I',
          relation.schemaname,
          relation.sequencename,
          api_role
        );
      END IF;
    END LOOP;

    EXECUTE format(
      'GRANT USAGE, SELECT ON SEQUENCE %I.%I TO nimto_runtime',
      relation.schemaname,
      relation.sequencename
    );
  END LOOP;
END $$;

REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO nimto_runtime;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL PRIVILEGES ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nimto_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nimto_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO nimto_runtime;

DO $$
DECLARE
  api_role TEXT;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON SCHEMA public FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON TABLES FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL PRIVILEGES ON SEQUENCES FROM %I',
        api_role
      );
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM %I',
        api_role
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM %I',
        api_role
      );
    END IF;
  END LOOP;
END $$;
