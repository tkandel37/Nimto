-- CreateTable
CREATE TABLE "EventRsvpResponse" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" "RsvpStatus" NOT NULL,
    "answers" JSONB NOT NULL,
    "guestCount" INTEGER,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRsvpResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventRsvpResponse_eventId_idx" ON "EventRsvpResponse"("eventId");

-- CreateIndex
CREATE INDEX "EventRsvpResponse_eventId_status_idx" ON "EventRsvpResponse"("eventId", "status");

-- CreateIndex
CREATE INDEX "EventRsvpResponse_submittedAt_idx" ON "EventRsvpResponse"("submittedAt");

-- AddForeignKey
ALTER TABLE "EventRsvpResponse" ADD CONSTRAINT "EventRsvpResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
