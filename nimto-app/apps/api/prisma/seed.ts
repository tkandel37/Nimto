import {
  AnimationComponentType,
  DesignCatalogStatus,
  DesignStatus,
  DesignVersionStatus,
  PrismaClient,
  TemplateStatus,
  UserStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PERMISSION_CATALOG } from "../src/auth/permissions";

const prisma = new PrismaClient();
const SUPER_ADMIN_ROLE = "SUPER_ADMIN";
const CORPORATE_TEMPLATE_FILE = "corporate-summit-2026.html";
const CORPORATE_ANIMATION_FILE = "corporate-opening-animation.html";

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
] as const;

function simpleScanResult(
  title: string,
  categoryHint: string,
  fields: readonly (readonly [string, string, string, boolean])[],
) {
  return {
    version: 1,
    title,
    categoryHint,
    sections: [],
    fields: fields.map(([key, label, type, required]) => ({
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
    hasOpeningSlot: false,
    openingSlots: [],
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
      supportsOpeningAnimation: false,
      supportsBackgroundEffects: false,
    },
  };
}

async function seedSimpleDesigns(userId: string, fixtureDirectory: string) {
  for (const fixture of simpleDesigns) {
    const rawHtml = readFileSync(join(fixtureDirectory, fixture.file), "utf8");
    const scanResult = simpleScanResult(
      fixture.name,
      fixture.category,
      fixture.fields,
    );
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
            htmlSize: Buffer.byteLength(rawHtml, "utf8"),
            scanResult,
            scannedAt: new Date(),
            categoryId: category.id,
            status: TemplateStatus.PUBLISHED,
          },
        })
      : await prisma.invitationTemplate.create({
          data: {
            name: fixture.name,
            rawHtml,
            sourceFileName: fixture.file,
            htmlSize: Buffer.byteLength(rawHtml, "utf8"),
            scanResult,
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
          htmlSize: Buffer.byteLength(rawHtml, "utf8"),
          scanResult,
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
          htmlSize: Buffer.byteLength(rawHtml, "utf8"),
          scanResult,
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

  if (password.length < 8) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
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

  const user = await prisma.user.upsert({
    where: {
      email,
    },
    update: {
      name,
      passwordHash,
      status: UserStatus.ACTIVE,
      blockedAt: null,
      deactivatedAt: null,
      deletionRequestedAt: null,
      emailVerifiedAt: new Date(),
    },
    create: {
      name,
      email,
      passwordHash,
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
  });

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
          scanResult: templateScanResult(),
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
          scanResult: templateScanResult(),
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
    `$1${animationHtml}`,
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
        scanResult: templateScanResult(),
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
        scanResult: templateScanResult(),
        publishedById: user.id,
      },
    });
  }
  await prisma.invitationTemplate.update({
    where: { id: template.id },
    data: { designId: design.id, status: TemplateStatus.PUBLISHED },
  });
  await seedSimpleDesigns(user.id, fixtureDirectory);

  console.log(`Seeded Super Admin: ${email}`);
  console.log("Seeded Corporate Executive Forum design and opening animation.");
  console.log("Seeded five additional invitation designs.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
