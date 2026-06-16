-- CreateEnum
CREATE TYPE "AnimationComponentType" AS ENUM ('OPENING', 'BACKGROUND');

-- CreateTable
CREATE TABLE "InvitationInvitee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationInvitee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimationComponent" (
    "id" TEXT NOT NULL,
    "type" "AnimationComponentType" NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "rawHtml" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "htmlSize" INTEGER NOT NULL,
    "scanResult" JSONB,
    "status" "DesignCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnimationComponent_pkey" PRIMARY KEY ("id")
);

-- Enable RLS for consistency with the rest of the public schema.
ALTER TABLE "InvitationInvitee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AnimationComponent" ENABLE ROW LEVEL SECURITY;

-- CreateIndex
CREATE UNIQUE INDEX "InvitationInvitee_slug_key" ON "InvitationInvitee"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "InvitationInvitee_eventId_name_key" ON "InvitationInvitee"("eventId", "name");

-- CreateIndex
CREATE INDEX "InvitationInvitee_eventId_idx" ON "InvitationInvitee"("eventId");

-- CreateIndex
CREATE INDEX "InvitationInvitee_slug_idx" ON "InvitationInvitee"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "AnimationComponent_slug_key" ON "AnimationComponent"("slug");

-- CreateIndex
CREATE INDEX "AnimationComponent_type_status_idx" ON "AnimationComponent"("type", "status");

-- CreateIndex
CREATE INDEX "AnimationComponent_createdById_idx" ON "AnimationComponent"("createdById");

-- AddForeignKey
ALTER TABLE "InvitationInvitee" ADD CONSTRAINT "InvitationInvitee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimationComponent" ADD CONSTRAINT "AnimationComponent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
