import {
  AnimationComponentType,
  DesignCatalogStatus,
  DesignStatus,
  DesignVersionStatus,
  Prisma,
  PrismaClient,
  TemplateStatus,
  UserStatus,
} from "@prisma/client";
import { catalogThumbnailHtml } from "../src/template-design/catalog-thumbnail";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_CATALOG } from "../src/auth/permissions";
import { TemplateDesignService } from "../src/template-design/template-design.service";

const prisma = new PrismaClient();
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
const CORPORATE_TEMPLATE_FILE = "corporate-summit-2026.html";
const CORPORATE_ANIMATION_FILE = "corporate-opening-animation.html";
const STANDALONE_TEMPLATE_FILES = ["nepali-wedding-invitation.html"] as const;

const corporateFields = [
  ["company_name", "Company Name", "text", true],
  ["event_label", "Event Label", "text", false],
  ["headline_top", "Headline Top", "text", true],
  ["headline_bottom", "Headline Bottom", "text", true],
  ["event_message", "Event Message", "textarea", true],
  ["host_name", "Host Name", "text", false],
  ["event_date", "Event Date", "date", true],
  ["event_time", "Event Time", "text", true],
  ["venue_name", "Venue Name", "text", true],
  ["venue_address", "Venue Address", "text", true],
  ["agenda_one", "Agenda Item One", "text", false],
  ["agenda_two", "Agenda Item Two", "text", false],
  ["agenda_three", "Agenda Item Three", "text", false],
  ["invitee_name", "Invitee Name", "custom_name", false],
  ["cta_text", "Call to Action", "text", false],
] as const;

function templateScanResult() {
  return {
    version: 1,
    title: "Corporate Summit",
    categoryHint: "Corporate",
    sections: [],
    fields: corporateFields.map(([key, label, type, required]) => ({
      key,
      label,
      type,
      required,
      paid: false,
      locked: false,
    })),
    countdownFieldKey: "event_date",
    countdownFieldStatus: "valid",
    customNameFieldKeys: ["invitee_name"],
    hasOpeningSlot: true,
    openingSlots: ["corporate-reveal"],
    hasBackgroundEffectSlot: false,
    backgroundEffectSlots: [],
    effectAreas: [],
    effectSlots: [],
    hasGallery: false,
    hasMusic: false,
    hasMap: false,
    capabilities: {
      supportsCountdown: true,
      supportsInviteeName: true,
      supportsGallery: false,
      supportsMusic: false,
      supportsMap: false,
      supportsOpeningAnimation: true,
      supportsBackgroundEffects: false,
    },
  };
}

const simpleDesigns = [
  {
    file: "birthday-confetti.html",
    name: "Birthday Confetti",
    slug: "birthday-confetti",
    category: "Birthday",
    categorySlug: "birthday",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["age", "Age", "number", false],
      ["celebrant_name", "Celebrant Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "wedding-botanical.html",
    name: "Botanical Wedding",
    slug: "botanical-wedding",
    category: "Wedding",
    categorySlug: "wedding",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["bride_name", "Bride Name", "text", true],
      ["groom_name", "Groom Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "house-party-neon.html",
    name: "Neon House Party",
    slug: "neon-house-party",
    category: "House Party",
    categorySlug: "house-party",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["event_title", "Event Title", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "business-opening-modern.html",
    name: "Modern Business Opening",
    slug: "modern-business-opening",
    category: "Business Opening",
    categorySlug: "business-opening",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["business_name", "Business Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["venue_address", "Venue Address", "text", false],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "family-gathering-warm.html",
    name: "Warm Family Gathering",
    slug: "warm-family-gathering",
    category: "Family Gathering",
    categorySlug: "family-gathering",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["event_title", "Event Title", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "nepali-mandap-wedding.html",
    name: "Nepali Mandap Wedding",
    slug: "nepali-mandap-wedding",
    category: "Wedding",
    categorySlug: "wedding",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["bride_name", "Bride Name", "text", true],
      ["groom_name", "Groom Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "dashain-tika-blessing.html",
    name: "Dashain Tika Blessing",
    slug: "dashain-tika-blessing",
    category: "Dashain",
    categorySlug: "dashain",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["family_name", "Family Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "tihar-deusi-bhailo.html",
    name: "Tihar Deusi Bhailo",
    slug: "tihar-deusi-bhailo",
    category: "Tihar",
    categorySlug: "tihar",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["event_title", "Event Title", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "bratabandha-ceremony.html",
    name: "Bratabandha Ceremony",
    slug: "bratabandha-ceremony",
    category: "Bratabandha",
    categorySlug: "bratabandha",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["child_name", "Child Name", "text", true],
      ["family_name", "Family Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "pasni-rice-feeding.html",
    name: "Pasni Rice Feeding",
    slug: "pasni-rice-feeding",
    category: "Pasni",
    categorySlug: "pasni",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["baby_name", "Baby Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "teej-celebration.html",
    name: "Teej Celebration",
    slug: "teej-celebration",
    category: "Teej",
    categorySlug: "teej",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["event_title", "Event Title", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "mehendi-sangeet-night.html",
    name: "Mehendi Sangeet Night",
    slug: "mehendi-sangeet-night",
    category: "Mehendi",
    categorySlug: "mehendi",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["couple_name", "Couple Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "school-reunion.html",
    name: "School Reunion",
    slug: "school-reunion",
    category: "Reunion",
    categorySlug: "reunion",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["school_name", "School Name", "text", true],
      ["batch_year", "Batch Year", "text", false],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "baby-shower-soft.html",
    name: "Soft Baby Shower",
    slug: "soft-baby-shower",
    category: "Baby Shower",
    categorySlug: "baby-shower",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["parent_names", "Parent Names", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
  {
    file: "community-puja.html",
    name: "Community Puja",
    slug: "community-puja",
    category: "Puja",
    categorySlug: "puja",
    fields: [
      ["event_label", "Event Label", "text", false],
      ["puja_name", "Puja Name", "text", true],
      ["event_message", "Event Message", "textarea", true],
      ["event_date", "Event Date", "date", true],
      ["event_time", "Event Time", "text", true],
      ["venue_name", "Venue Name", "text", true],
      ["invitee_name", "Invitee Name", "custom_name", false],
    ],
  },
] as const;

function createTemplateScanner() {
  const service = new TemplateDesignService(
    prisma as never,
    {
      record: async () => null,
    } as never,
  );

  return {
    scanTemplateHtml(rawHtml: string, title = "Invitation Template") {
      const htmlWithMeta = /id=["']nimto-template-meta["']/i.test(rawHtml)
        ? rawHtml
        : rawHtml.replace(
            /<head[^>]*>/i,
            (match) =>
              `${match}\n<script type="application/json" id="nimto-template-meta">${JSON.stringify({ title, version: "1.0.0" })}</script>`,
          );
      return (
        service as unknown as {
          scanTemplateHtml: (html: string) => Prisma.InputJsonObject;
        }
      ).scanTemplateHtml(htmlWithMeta);
    },
    normalizeFeatureConfig(
      value: Record<string, unknown> | null | undefined,
      scanResult: Prisma.InputJsonObject,
    ) {
      return (
        service as unknown as {
          normalizeFeatureConfig: (
            source: Record<string, unknown> | null | undefined,
            result: Prisma.InputJsonObject,
          ) => Prisma.InputJsonObject;
        }
      ).normalizeFeatureConfig(value, scanResult);
    },
  };
}

async function seedSimpleDesigns(
  userId: string,
  fixtureDirectory: string,
  scanner: ReturnType<typeof createTemplateScanner>,
) {
  for (const fixture of simpleDesigns) {
    const rawHtml = readFileSync(join(fixtureDirectory, fixture.file), "utf8");
    const scanResult = scanner.scanTemplateHtml(rawHtml, fixture.name);
    const featureConfig = scanner.normalizeFeatureConfig(null, scanResult);
    const htmlSize = Buffer.byteLength(rawHtml, "utf8");
    const thumbnailHtml = catalogThumbnailHtml(fixture.slug);
    const category = await prisma.designCategory.upsert({
      where: { slug: fixture.categorySlug },
      update: {
        name: fixture.category,
        status: DesignCatalogStatus.ACTIVE,
      },
      create: {
        name: fixture.category,
        slug: fixture.categorySlug,
        status: DesignCatalogStatus.ACTIVE,
        createdById: userId,
      },
    });
    const existingTemplate = await prisma.invitationTemplate.findFirst({
      where: { sourceFileName: fixture.file },
    });
    const template = existingTemplate
      ? await prisma.invitationTemplate.update({
          where: { id: existingTemplate.id },
          data: {
            name: fixture.name,
            rawHtml,
            thumbnailHtml,
            htmlSize,
            scanResult: scanResult as Prisma.InputJsonValue,
            featureConfig: featureConfig as Prisma.InputJsonValue,
            scannedAt: new Date(),
            categoryId: category.id,
            status: TemplateStatus.PUBLISHED,
          },
        })
      : await prisma.invitationTemplate.create({
          data: {
            name: fixture.name,
            rawHtml,
            thumbnailHtml,
            sourceFileName: fixture.file,
            htmlSize,
            scanResult: scanResult as Prisma.InputJsonValue,
            featureConfig: featureConfig as Prisma.InputJsonValue,
            scannedAt: new Date(),
            categoryId: category.id,
            status: TemplateStatus.PUBLISHED,
            createdById: userId,
          },
        });
    const design = await prisma.invitationDesign.upsert({
      where: { slug: fixture.slug },
      update: {
        name: fixture.name,
        status: DesignStatus.ACTIVE,
        categoryId: category.id,
        templateId: template.id,
      },
      create: {
        name: fixture.name,
        slug: fixture.slug,
        status: DesignStatus.ACTIVE,
        categoryId: category.id,
        templateId: template.id,
        createdById: userId,
      },
    });
    const currentVersion = await prisma.designVersion.findFirst({
      where: { designId: design.id, status: DesignVersionStatus.CURRENT },
    });
    if (currentVersion) {
      await prisma.designVersion.update({
        where: { id: currentVersion.id },
        data: {
          name: fixture.name,
          rawHtml,
          thumbnailHtml,
          htmlSize,
          scanResult: scanResult as Prisma.InputJsonValue,
          featureConfig: featureConfig as Prisma.InputJsonValue,
          templateId: template.id,
        },
      });
    } else {
      await prisma.designVersion.create({
        data: {
          designId: design.id,
          templateId: template.id,
          versionNumber: 1,
          status: DesignVersionStatus.CURRENT,
          name: fixture.name,
          rawHtml,
          thumbnailHtml,
          htmlSize,
          scanResult: scanResult as Prisma.InputJsonValue,
          featureConfig: featureConfig as Prisma.InputJsonValue,
          publishedById: userId,
        },
      });
    }
    await prisma.invitationTemplate.update({
      where: { id: template.id },
      data: { designId: design.id, status: TemplateStatus.PUBLISHED },
    });
  }
}

async function syncStandaloneTemplateFiles(fixtureDirectory: string) {
  const scanner = createTemplateScanner();

  for (const fileName of STANDALONE_TEMPLATE_FILES) {
    const absolutePath = join(fixtureDirectory, fileName);
    const rawHtml = readFileSync(absolutePath, "utf8");
    const scanResult = scanner.scanTemplateHtml(rawHtml, fileName);
    const htmlSize = Buffer.byteLength(rawHtml, "utf8");

    const templates = await prisma.invitationTemplate.findMany({
      where: { sourceFileName: fileName },
      select: {
        id: true,
        featureConfig: true,
      },
    });

    for (const template of templates) {
      const featureConfig = scanner.normalizeFeatureConfig(
        template.featureConfig as Record<string, unknown> | null | undefined,
        scanResult,
      );

      await prisma.invitationTemplate.update({
        where: { id: template.id },
        data: {
          rawHtml,
          htmlSize,
          scanResult: scanResult as Prisma.InputJsonValue,
          featureConfig: featureConfig as Prisma.InputJsonValue,
          scannedAt: new Date(),
        },
      });

      const versions = await prisma.designVersion.findMany({
        where: { templateId: template.id },
        select: {
          id: true,
          featureConfig: true,
        },
      });

      for (const version of versions) {
        const versionFeatureConfig = scanner.normalizeFeatureConfig(
          version.featureConfig as Record<string, unknown> | null | undefined,
          scanResult,
        );

        await prisma.designVersion.update({
          where: { id: version.id },
          data: {
            rawHtml,
            htmlSize,
            scanResult: scanResult as Prisma.InputJsonValue,
            featureConfig: versionFeatureConfig as Prisma.InputJsonValue,
          },
        });
      }
    }
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required to seed the Super Admin account.`);
  }

  return value;
}

async function main() {
  const email = requiredEnv("SUPER_ADMIN_EMAIL").toLowerCase();
  const password = requiredEnv("SUPER_ADMIN_PASSWORD");
  const name = requiredEnv("SUPER_ADMIN_NAME");

  if (
    password.length < 12 ||
    password.length > 128 ||
    /(change.?me|replace.?with|password123|example)/i.test(password) ||
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(password)
  ) {
    throw new Error(
      "SUPER_ADMIN_PASSWORD must be a non-placeholder 12-128 character secret with uppercase, lowercase, number, and symbol characters.",
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(
    PERMISSION_CATALOG.map((permission) =>
      prisma.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );

  const role = await prisma.role.upsert({
    where: {
      name: SUPER_ADMIN_ROLE,
    },
    update: {
      description: "Protected root administrator role.",
      isSystem: true,
    },
    create: {
      name: SUPER_ADMIN_ROLE,
      description: "Protected root administrator role.",
      isSystem: true,
    },
  });

  let user = await prisma.user.findFirst({
    where: { roles: { some: { roleId: role.id } } },
    orderBy: { createdAt: "asc" },
  });

  if (!user) {
    const existingEmailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existingEmailOwner) {
      throw new Error(
        "Refusing to promote an existing account during Super Admin bootstrap.",
      );
    }

    user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });
  }

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: user.id,
        roleId: role.id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      roleId: role.id,
    },
  });

  await prisma.rolePermission.createMany({
    data: (
      await prisma.permission.findMany({
        where: {
          key: { in: PERMISSION_CATALOG.map((permission) => permission.key) },
        },
      })
    ).map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  });

  const fixtureDirectory = join(__dirname, "fixtures");
  const templateHtml = readFileSync(
    join(fixtureDirectory, CORPORATE_TEMPLATE_FILE),
    "utf8",
  );
  const animationHtml = readFileSync(
    join(fixtureDirectory, CORPORATE_ANIMATION_FILE),
    "utf8",
  );
  const scanner = createTemplateScanner();
  const corporateTemplateScan = scanner.scanTemplateHtml(
    templateHtml,
    "Corporate Executive Forum",
  );
  const corporateTemplateFeatureConfig = scanner.normalizeFeatureConfig(
    null,
    corporateTemplateScan,
  );
  const category = await prisma.designCategory.upsert({
    where: { slug: "corporate" },
    update: {
      name: "Corporate",
      status: DesignCatalogStatus.ACTIVE,
    },
    create: {
      name: "Corporate",
      slug: "corporate",
      status: DesignCatalogStatus.ACTIVE,
      sortOrder: 20,
      createdById: user.id,
    },
  });
  const animation = await prisma.animationComponent.upsert({
    where: { slug: "executive-reveal" },
    update: {
      name: "Executive Reveal",
      rawHtml: animationHtml,
      sourceFileName: CORPORATE_ANIMATION_FILE,
      htmlSize: Buffer.byteLength(animationHtml, "utf8"),
      scanResult: {
        version: 1,
        type: AnimationComponentType.OPENING,
        hasOpeningSlot: true,
        openingSlots: ["corporate-reveal"],
        hasBackgroundEffectSlot: false,
        backgroundEffectSlots: [],
        effectSlots: [],
        effectAreas: [],
      },
      status: DesignCatalogStatus.ACTIVE,
    },
    create: {
      type: AnimationComponentType.OPENING,
      name: "Executive Reveal",
      slug: "executive-reveal",
      rawHtml: animationHtml,
      sourceFileName: CORPORATE_ANIMATION_FILE,
      htmlSize: Buffer.byteLength(animationHtml, "utf8"),
      scanResult: {
        version: 1,
        type: AnimationComponentType.OPENING,
        hasOpeningSlot: true,
        openingSlots: ["corporate-reveal"],
        hasBackgroundEffectSlot: false,
        backgroundEffectSlots: [],
        effectSlots: [],
        effectAreas: [],
      },
      status: DesignCatalogStatus.ACTIVE,
      createdById: user.id,
    },
  });
  const existingTemplate = await prisma.invitationTemplate.findFirst({
    where: { sourceFileName: CORPORATE_TEMPLATE_FILE },
  });
  const template = existingTemplate
    ? await prisma.invitationTemplate.update({
        where: { id: existingTemplate.id },
        data: {
          name: "Corporate Executive Forum",
          rawHtml: templateHtml,
          htmlSize: Buffer.byteLength(templateHtml, "utf8"),
          scanResult: corporateTemplateScan as Prisma.InputJsonValue,
          featureConfig:
            corporateTemplateFeatureConfig as Prisma.InputJsonValue,
          scannedAt: new Date(),
          categoryId: category.id,
          status: TemplateStatus.PUBLISHED,
        },
      })
    : await prisma.invitationTemplate.create({
        data: {
          name: "Corporate Executive Forum",
          rawHtml: templateHtml,
          sourceFileName: CORPORATE_TEMPLATE_FILE,
          htmlSize: Buffer.byteLength(templateHtml, "utf8"),
          scanResult: corporateTemplateScan as Prisma.InputJsonValue,
          featureConfig:
            corporateTemplateFeatureConfig as Prisma.InputJsonValue,
          scannedAt: new Date(),
          categoryId: category.id,
          status: TemplateStatus.PUBLISHED,
          createdById: user.id,
        },
      });
  await prisma.templateAnimationAssignment.upsert({
    where: {
      templateId_slotKey: {
        templateId: template.id,
        slotKey: "corporate-reveal",
      },
    },
    update: { animationComponentId: animation.id },
    create: {
      templateId: template.id,
      animationComponentId: animation.id,
      slotKey: "corporate-reveal",
    },
  });
  const design = await prisma.invitationDesign.upsert({
    where: { slug: "corporate-executive-forum" },
    update: {
      name: "Corporate Executive Forum",
      status: DesignStatus.ACTIVE,
      categoryId: category.id,
      templateId: template.id,
    },
    create: {
      name: "Corporate Executive Forum",
      slug: "corporate-executive-forum",
      status: DesignStatus.ACTIVE,
      categoryId: category.id,
      templateId: template.id,
      createdById: user.id,
    },
  });
  const publishedHtml = templateHtml.replace(
    /(<[^>]+data-nimto-opening-slot=["']corporate-reveal["'][^>]*>)/i,
    (_match, openingTag) => `${openingTag}${animationHtml}`,
  );
  const corporatePublishedScan = scanner.scanTemplateHtml(
    publishedHtml,
    "Corporate Executive Forum",
  );
  const corporatePublishedFeatureConfig = scanner.normalizeFeatureConfig(
    null,
    corporatePublishedScan,
  );
  const currentVersion = await prisma.designVersion.findFirst({
    where: { designId: design.id, status: DesignVersionStatus.CURRENT },
  });
  if (currentVersion) {
    await prisma.designVersion.update({
      where: { id: currentVersion.id },
      data: {
        name: design.name,
        rawHtml: publishedHtml,
        htmlSize: Buffer.byteLength(publishedHtml, "utf8"),
        scanResult: corporatePublishedScan as Prisma.InputJsonValue,
        featureConfig: corporatePublishedFeatureConfig as Prisma.InputJsonValue,
        templateId: template.id,
      },
    });
  } else {
    await prisma.designVersion.create({
      data: {
        designId: design.id,
        templateId: template.id,
        versionNumber: 1,
        status: DesignVersionStatus.CURRENT,
        name: design.name,
        rawHtml: publishedHtml,
        htmlSize: Buffer.byteLength(publishedHtml, "utf8"),
        scanResult: corporatePublishedScan as Prisma.InputJsonValue,
        featureConfig: corporatePublishedFeatureConfig as Prisma.InputJsonValue,
        publishedById: user.id,
      },
    });
  }
  await prisma.invitationTemplate.update({
    where: { id: template.id },
    data: { designId: design.id, status: TemplateStatus.PUBLISHED },
  });
  await seedSimpleDesigns(user.id, fixtureDirectory, scanner);
  await syncStandaloneTemplateFiles(fixtureDirectory);

  console.log(`Seeded Super Admin: ${email}`);
  console.log("Seeded Corporate Executive Forum design and opening animation.");
  console.log("Seeded fifteen additional invitation designs.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
