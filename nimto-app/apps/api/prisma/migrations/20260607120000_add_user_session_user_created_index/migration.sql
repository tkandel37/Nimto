-- Speeds up admin account session history queries ordered by newest first.
CREATE INDEX "UserSession_userId_createdAt_idx" ON "UserSession"("userId", "createdAt");
