ALTER TABLE "Event"
ADD COLUMN "rsvpDeadline" TIMESTAMP(3),
ADD COLUMN "organizerNotes" TEXT,
ADD COLUMN "checklist" JSONB,
ADD COLUMN "draftDesignVersionId" TEXT,
ADD COLUMN "draftDesignFieldValues" JSONB,
ADD COLUMN "draftSavedAt" TIMESTAMP(3);

ALTER TABLE "InvitationInvitee"
ADD COLUMN "email" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "groupName" TEXT,
ADD COLUMN "organizerNotes" TEXT,
ADD COLUMN "linkDisabledAt" TIMESTAMP(3),
ADD COLUMN "linkExpiresAt" TIMESTAMP(3),
ADD COLUMN "lastSharedAt" TIMESTAMP(3),
ADD COLUMN "lastShareChannel" TEXT;

CREATE TABLE "EventDesignRevision" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "designVersionId" TEXT NOT NULL,
  "fieldValues" JSONB NOT NULL,
  "label" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventDesignRevision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventActivity" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "inviteeId" TEXT,
  "type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Event_draftDesignVersionId_idx" ON "Event"("draftDesignVersionId");
CREATE INDEX "InvitationInvitee_eventId_groupName_idx" ON "InvitationInvitee"("eventId", "groupName");
CREATE INDEX "EventDesignRevision_eventId_createdAt_idx" ON "EventDesignRevision"("eventId", "createdAt");
CREATE INDEX "EventDesignRevision_designVersionId_idx" ON "EventDesignRevision"("designVersionId");
CREATE INDEX "EventActivity_eventId_createdAt_idx" ON "EventActivity"("eventId", "createdAt");
CREATE INDEX "EventActivity_inviteeId_idx" ON "EventActivity"("inviteeId");
CREATE INDEX "EventActivity_type_idx" ON "EventActivity"("type");

ALTER TABLE "Event"
ADD CONSTRAINT "Event_draftDesignVersionId_fkey"
FOREIGN KEY ("draftDesignVersionId") REFERENCES "DesignVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventDesignRevision"
ADD CONSTRAINT "EventDesignRevision_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventDesignRevision"
ADD CONSTRAINT "EventDesignRevision_designVersionId_fkey"
FOREIGN KEY ("designVersionId") REFERENCES "DesignVersion"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventActivity"
ADD CONSTRAINT "EventActivity_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "Event"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EventActivity"
ADD CONSTRAINT "EventActivity_inviteeId_fkey"
FOREIGN KEY ("inviteeId") REFERENCES "InvitationInvitee"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventDesignRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EventActivity" ENABLE ROW LEVEL SECURITY;
