ALTER TABLE "InvitationTemplate"
ADD COLUMN "featureConfig" JSONB;

ALTER TABLE "DesignVersion"
ADD COLUMN "featureConfig" JSONB;

ALTER TABLE "Event"
ADD COLUMN "featureSettings" JSONB,
ADD COLUMN "rsvpConfig" JSONB;
