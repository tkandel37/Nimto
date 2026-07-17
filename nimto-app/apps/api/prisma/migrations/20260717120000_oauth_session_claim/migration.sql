-- A single-use claim moves an OAuth session from the API callback host to the
-- frontend's first-party cookie boundary without putting the JWT in the URL.
ALTER TABLE "UserSession"
  ADD COLUMN "oauthClaimHash" TEXT,
  ADD COLUMN "oauthClaimExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "UserSession_oauthClaimHash_key"
  ON "UserSession"("oauthClaimHash");
