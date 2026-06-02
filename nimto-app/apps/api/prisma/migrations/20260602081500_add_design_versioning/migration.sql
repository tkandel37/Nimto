CREATE TYPE "DesignStatus" AS ENUM ('ACTIVE', 'UNPUBLISHED');
CREATE TYPE "DesignVersionStatus" AS ENUM ('CURRENT', 'SUPERSEDED');

CREATE TABLE "InvitationDesign" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "DesignStatus" NOT NULL DEFAULT 'ACTIVE',
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationDesign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DesignVersion" (
    "id" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "templateId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "status" "DesignVersionStatus" NOT NULL DEFAULT 'CURRENT',
    "name" TEXT NOT NULL,
    "rawHtml" TEXT NOT NULL,
    "htmlSize" INTEGER NOT NULL,
    "scanResult" JSONB,
    "publishedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesignVersion_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "InvitationTemplate" ADD COLUMN "designId" TEXT;

CREATE UNIQUE INDEX "InvitationDesign_slug_key" ON "InvitationDesign"("slug");
CREATE INDEX "InvitationDesign_status_createdAt_idx" ON "InvitationDesign"("status", "createdAt");
CREATE INDEX "InvitationDesign_categoryId_idx" ON "InvitationDesign"("categoryId");
CREATE INDEX "InvitationDesign_subcategoryId_idx" ON "InvitationDesign"("subcategoryId");
CREATE INDEX "InvitationDesign_createdById_idx" ON "InvitationDesign"("createdById");
CREATE UNIQUE INDEX "DesignVersion_designId_versionNumber_key" ON "DesignVersion"("designId", "versionNumber");
CREATE INDEX "DesignVersion_status_createdAt_idx" ON "DesignVersion"("status", "createdAt");
CREATE INDEX "DesignVersion_templateId_idx" ON "DesignVersion"("templateId");
CREATE INDEX "DesignVersion_publishedById_idx" ON "DesignVersion"("publishedById");
CREATE INDEX "InvitationTemplate_designId_idx" ON "InvitationTemplate"("designId");

ALTER TABLE "InvitationTemplate"
    ADD CONSTRAINT "InvitationTemplate_designId_fkey"
    FOREIGN KEY ("designId") REFERENCES "InvitationDesign"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvitationDesign"
    ADD CONSTRAINT "InvitationDesign_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "DesignCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvitationDesign"
    ADD CONSTRAINT "InvitationDesign_subcategoryId_fkey"
    FOREIGN KEY ("subcategoryId") REFERENCES "DesignSubcategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvitationDesign"
    ADD CONSTRAINT "InvitationDesign_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DesignVersion"
    ADD CONSTRAINT "DesignVersion_designId_fkey"
    FOREIGN KEY ("designId") REFERENCES "InvitationDesign"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesignVersion"
    ADD CONSTRAINT "DesignVersion_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
