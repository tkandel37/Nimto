CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'UNPUBLISHED');

CREATE TABLE "InvitationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "rawHtml" TEXT NOT NULL,
    "sourceFileName" TEXT,
    "htmlSize" INTEGER NOT NULL,
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvitationTemplate_status_createdAt_idx" ON "InvitationTemplate"("status", "createdAt");
CREATE INDEX "InvitationTemplate_createdById_idx" ON "InvitationTemplate"("createdById");
CREATE INDEX "InvitationTemplate_categoryId_idx" ON "InvitationTemplate"("categoryId");
CREATE INDEX "InvitationTemplate_subcategoryId_idx" ON "InvitationTemplate"("subcategoryId");

ALTER TABLE "InvitationTemplate"
    ADD CONSTRAINT "InvitationTemplate_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "DesignCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvitationTemplate"
    ADD CONSTRAINT "InvitationTemplate_subcategoryId_fkey"
    FOREIGN KEY ("subcategoryId") REFERENCES "DesignSubcategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvitationTemplate"
    ADD CONSTRAINT "InvitationTemplate_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
