CREATE TYPE "DesignCatalogStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TABLE "DesignCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "DesignCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DesignSubcategory" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "DesignCatalogStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DesignSubcategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignCategory_slug_key" ON "DesignCategory"("slug");
CREATE INDEX "DesignCategory_status_sortOrder_idx" ON "DesignCategory"("status", "sortOrder");
CREATE INDEX "DesignCategory_createdById_idx" ON "DesignCategory"("createdById");
CREATE UNIQUE INDEX "DesignSubcategory_categoryId_slug_key" ON "DesignSubcategory"("categoryId", "slug");
CREATE INDEX "DesignSubcategory_categoryId_status_sortOrder_idx" ON "DesignSubcategory"("categoryId", "status", "sortOrder");
CREATE INDEX "DesignSubcategory_createdById_idx" ON "DesignSubcategory"("createdById");

ALTER TABLE "DesignCategory"
    ADD CONSTRAINT "DesignCategory_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DesignSubcategory"
    ADD CONSTRAINT "DesignSubcategory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "DesignCategory"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DesignSubcategory"
    ADD CONSTRAINT "DesignSubcategory_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
