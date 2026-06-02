ALTER TABLE "InvitationTemplate"
    ADD COLUMN "scanResult" JSONB,
    ADD COLUMN "scannedAt" TIMESTAMP(3);
