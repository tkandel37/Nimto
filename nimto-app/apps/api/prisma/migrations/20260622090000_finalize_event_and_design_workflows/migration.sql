CREATE TYPE "RsvpStatus" AS ENUM ('PENDING', 'ATTENDING', 'DECLINED');

ALTER TABLE "Event"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "firstOpenedAt" TIMESTAMP(3),
  ADD COLUMN "lastOpenedAt" TIMESTAMP(3),
  ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "InvitationInvitee"
  ADD COLUMN "firstOpenedAt" TIMESTAMP(3),
  ADD COLUMN "lastOpenedAt" TIMESTAMP(3),
  ADD COLUMN "openCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "rsvpStatus" "RsvpStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "partySize" INTEGER,
  ADD COLUMN "mealPreference" TEXT,
  ADD COLUMN "rsvpMessage" TEXT,
  ADD COLUMN "respondedAt" TIMESTAMP(3);

CREATE TABLE "TemplateAnimationAssignment" (
  "id" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "animationComponentId" TEXT NOT NULL,
  "slotKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TemplateAnimationAssignment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_archivedAt_idx" ON "Event"("archivedAt");
CREATE INDEX "InvitationInvitee_eventId_rsvpStatus_idx" ON "InvitationInvitee"("eventId", "rsvpStatus");
CREATE UNIQUE INDEX "TemplateAnimationAssignment_templateId_slotKey_key" ON "TemplateAnimationAssignment"("templateId", "slotKey");
CREATE INDEX "TemplateAnimationAssignment_animationComponentId_idx" ON "TemplateAnimationAssignment"("animationComponentId");

ALTER TABLE "TemplateAnimationAssignment"
  ADD CONSTRAINT "TemplateAnimationAssignment_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "InvitationTemplate"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateAnimationAssignment"
  ADD CONSTRAINT "TemplateAnimationAssignment_animationComponentId_fkey"
  FOREIGN KEY ("animationComponentId") REFERENCES "AnimationComponent"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TemplateAnimationAssignment" ENABLE ROW LEVEL SECURITY;
