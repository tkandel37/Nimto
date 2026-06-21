-- CreateTable
CREATE TABLE "UserDesignUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "designId" TEXT NOT NULL,
    "lastUsedVersionId" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "firstUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDesignUsage_pkey" PRIMARY KEY ("id")
);

-- Backfill designs already used before this feature existed.
INSERT INTO "UserDesignUsage" (
    "id",
    "userId",
    "designId",
    "lastUsedVersionId",
    "usageCount",
    "firstUsedAt",
    "lastUsedAt"
)
SELECT
    'usage_' || md5(e."userId" || ':' || dv."designId"),
    e."userId",
    dv."designId",
    (
        SELECT latest_event."designVersionId"
        FROM "Event" latest_event
        JOIN "DesignVersion" latest_version
          ON latest_version."id" = latest_event."designVersionId"
        WHERE latest_event."userId" = e."userId"
          AND latest_version."designId" = dv."designId"
        ORDER BY latest_event."createdAt" DESC
        LIMIT 1
    ),
    COUNT(*)::INTEGER,
    MIN(e."createdAt"),
    MAX(e."createdAt")
FROM "Event" e
JOIN "DesignVersion" dv ON dv."id" = e."designVersionId"
WHERE e."designVersionId" IS NOT NULL
GROUP BY e."userId", dv."designId";

CREATE UNIQUE INDEX "UserDesignUsage_userId_designId_key" ON "UserDesignUsage"("userId", "designId");
CREATE INDEX "UserDesignUsage_userId_lastUsedAt_idx" ON "UserDesignUsage"("userId", "lastUsedAt");
CREATE INDEX "UserDesignUsage_designId_idx" ON "UserDesignUsage"("designId");
CREATE INDEX "UserDesignUsage_lastUsedVersionId_idx" ON "UserDesignUsage"("lastUsedVersionId");

ALTER TABLE "UserDesignUsage" ADD CONSTRAINT "UserDesignUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserDesignUsage" ADD CONSTRAINT "UserDesignUsage_designId_fkey" FOREIGN KEY ("designId") REFERENCES "InvitationDesign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserDesignUsage" ADD CONSTRAINT "UserDesignUsage_lastUsedVersionId_fkey" FOREIGN KEY ("lastUsedVersionId") REFERENCES "DesignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "UserDesignUsage" ENABLE ROW LEVEL SECURITY;
