ALTER TABLE "Event"
ADD COLUMN "draftFeatureSettings" JSONB;

ALTER TABLE "EventDesignRevision"
ADD COLUMN "featureSettings" JSONB;

UPDATE "Event"
SET "draftFeatureSettings" = "featureSettings"
WHERE "featureSettings" IS NOT NULL;
