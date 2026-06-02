ALTER TABLE "Event"
    ADD COLUMN "designVersionId" TEXT,
    ADD COLUMN "designFieldValues" JSONB;

CREATE INDEX "Event_designVersionId_idx" ON "Event"("designVersionId");

ALTER TABLE "Event"
    ADD CONSTRAINT "Event_designVersionId_fkey"
    FOREIGN KEY ("designVersionId") REFERENCES "DesignVersion"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
