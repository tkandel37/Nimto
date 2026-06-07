import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DesignCatalogStatus,
  DesignStatus,
  DesignVersionStatus,
  Prisma,
  TemplateStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PERMISSIONS, SUPER_ADMIN_ROLE } from "../auth/permissions";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDesignCategoryDto } from "./dto/create-design-category.dto";
import { CreateDesignSubcategoryDto } from "./dto/create-design-subcategory.dto";
import { CreateInvitationTemplateDto } from "./dto/create-invitation-template.dto";
import { UpdateDesignCategoryDto } from "./dto/update-design-category.dto";
import { UpdateDesignSubcategoryDto } from "./dto/update-design-subcategory.dto";
import { UpdateInvitationTemplateDto } from "./dto/update-invitation-template.dto";

type ActorContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

type TemplateField = {
  key: string;
  label: string;
  type: string;
  sectionKey?: string;
  required: boolean;
  paid: boolean;
  locked: boolean;
};

type TemplateScanResult = {
  version: 1;
  title?: string;
  categoryHint?: string;
  sections: { key: string; label: string }[];
  fields: TemplateField[];
  countdownFieldKey?: string;
  customNameFieldKeys: string[];
  hasGallery: boolean;
  hasMusic: boolean;
  hasMap: boolean;
};

type ScannedSection = { key: string; label: string; index: number };

const TEMPLATE_ACCESS_CACHE_MS = 30_000;
const TEMPLATE_DETAIL_CACHE_MS = 60_000;
const PUBLIC_DESIGN_CACHE_MS = 60_000;

type TemplateAccess = {
  updateAll: boolean;
  updateOwn: boolean;
  viewAll: boolean;
  viewOwn: boolean;
};

type DesignAccess = {
  viewAll: boolean;
  viewOwn: boolean;
};

const templateAccessCache = new Map<
  string,
  { expiresAt: number; value: TemplateAccess }
>();
const designAccessCache = new Map<
  string,
  { expiresAt: number; value: DesignAccess }
>();
const templateDetailCache = new Map<
  string,
  { expiresAt: number; value: unknown }
>();
const templateListCache = new Map<string, { expiresAt: number; value: unknown }>();
const designListCache = new Map<string, { expiresAt: number; value: unknown }>();
const publicCategoryCache = new Map<string, { expiresAt: number; value: unknown }>();
const publicDesignCache = new Map<string, { expiresAt: number; value: unknown }>();

@Injectable()
export class TemplateDesignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listCategories() {
    return this.prisma.designCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subcategories: {
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  listPublicCategories() {
    const cacheKey = "active";
    const cached = publicCategoryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const query = this.prisma.designCategory.findMany({
      where: { status: DesignCatalogStatus.ACTIVE },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subcategories: {
          where: { status: DesignCatalogStatus.ACTIVE },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });
    void query.then((value) => {
      publicCategoryCache.set(cacheKey, {
        expiresAt: Date.now() + PUBLIC_DESIGN_CACHE_MS,
        value,
      });
    });
    return query;
  }

  listPublicDesigns(filters: {
    categoryId?: string;
    subcategoryId?: string;
    search?: string;
  }) {
    const search = filters.search?.trim();
    const cacheKey = JSON.stringify({
      categoryId: filters.categoryId ?? "",
      subcategoryId: filters.subcategoryId ?? "",
      search: search ?? "",
    });
    const cached = publicDesignCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const query = this.prisma.invitationDesign.findMany({
      where: {
        status: DesignStatus.ACTIVE,
        categoryId: filters.categoryId || undefined,
        subcategoryId: filters.subcategoryId || undefined,
        AND: [
          filters.categoryId
            ? {}
            : {
                OR: [
                  { categoryId: null },
                  { category: { status: DesignCatalogStatus.ACTIVE } },
                ],
              },
          filters.subcategoryId
            ? {}
            : {
                OR: [
                  { subcategoryId: null },
                  { subcategory: { status: DesignCatalogStatus.ACTIVE } },
                ],
              },
        ],
        versions: { some: { status: DesignVersionStatus.CURRENT } },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" as const } },
                { slug: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
        versions: {
          where: { status: DesignVersionStatus.CURRENT },
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            id: true,
            versionNumber: true,
            status: true,
            name: true,
            rawHtml: true,
            htmlSize: true,
            scanResult: true,
            createdAt: true,
          },
        },
      },
    });
    void query.then((value) => {
      publicDesignCache.set(cacheKey, {
        expiresAt: Date.now() + PUBLIC_DESIGN_CACHE_MS,
        value,
      });
    });
    return query;
  }

  async listTemplates(userId: string) {
    const cached = templateListCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const access = await this.templateAccess(userId);
    if (!access.viewAll && !access.viewOwn) {
      throw new ForbiddenException("You cannot view templates.");
    }

    const templates = await this.prisma.invitationTemplate.findMany({
      where: access.viewAll ? undefined : { createdById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        sourceFileName: true,
        htmlSize: true,
        scanResult: true,
        scannedAt: true,
        designId: true,
        design: {
          select: {
            id: true,
            slug: true,
            status: true,
            versions: {
              where: { status: DesignVersionStatus.CURRENT },
              select: { id: true, versionNumber: true, status: true },
              take: 1,
            },
          },
        },
        categoryId: true,
        subcategoryId: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    templateListCache.set(userId, {
      expiresAt: Date.now() + TEMPLATE_DETAIL_CACHE_MS,
      value: templates,
    });
    return templates;
  }

  async getTemplate(templateId: string, userId: string) {
    const cacheKey = `${userId}:${templateId}`;
    const cached = templateDetailCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const template = await this.prisma.invitationTemplate.findUnique({
      where: { id: templateId },
      include: {
        category: true,
        subcategory: true,
        design: {
          include: {
            versions: {
              orderBy: { versionNumber: "desc" },
              select: {
                id: true,
                versionNumber: true,
                status: true,
                createdAt: true,
              },
            },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!template) {
      throw new NotFoundException("Template not found.");
    }

    const access = await this.templateAccess(userId);
    if (!access.viewAll && !(access.viewOwn && template.createdById === userId)) {
      throw new ForbiddenException("You cannot view this template.");
    }

    templateDetailCache.set(cacheKey, {
      expiresAt: Date.now() + TEMPLATE_DETAIL_CACHE_MS,
      value: template,
    });
    return template;
  }

  async listDesigns(userId: string) {
    const cached = designListCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const access = await this.designAccess(userId);
    if (!access.viewAll && !access.viewOwn) {
      throw new ForbiddenException("You cannot view designs.");
    }

    const designs = await this.prisma.invitationDesign.findMany({
      where: access.viewAll ? undefined : { createdById: userId },
      orderBy: { updatedAt: "desc" },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        versions: {
          orderBy: { versionNumber: "desc" },
          select: {
            id: true,
            versionNumber: true,
            status: true,
            htmlSize: true,
            createdAt: true,
          },
        },
      },
    });
    designListCache.set(userId, {
      expiresAt: Date.now() + TEMPLATE_DETAIL_CACHE_MS,
      value: designs,
    });
    return designs;
  }

  async createTemplate(
    dto: CreateInvitationTemplateDto,
    context: ActorContext,
  ) {
    this.assertNimtoHtml(dto.rawHtml);
    const scanResult = this.scanTemplateHtml(dto.rawHtml);
    await this.assertTemplateTaxonomy(dto.categoryId, dto.subcategoryId);

    const template = await this.prisma.invitationTemplate.create({
      data: {
        name: dto.name.trim(),
        rawHtml: dto.rawHtml,
        sourceFileName: dto.sourceFileName?.trim() || null,
        htmlSize: Buffer.byteLength(dto.rawHtml, "utf8"),
        scanResult,
        scannedAt: new Date(),
        categoryId: dto.categoryId || null,
        subcategoryId: dto.subcategoryId || null,
        createdById: context.actorId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        sourceFileName: true,
        htmlSize: true,
        scanResult: true,
        scannedAt: true,
        designId: true,
        categoryId: true,
        subcategoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.record(context, "invitationTemplate.created", template.id, {
      name: template.name,
      sourceFileName: template.sourceFileName,
      htmlSize: template.htmlSize,
    });
    this.clearTemplateListCaches();
    return template;
  }

  async duplicateTemplate(templateId: string, context: ActorContext) {
    const template = await this.prisma.invitationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException("Template not found.");
    }

    const access = await this.templateAccess(context.actorId);
    if (!access.viewAll && !(access.viewOwn && template.createdById === context.actorId)) {
      throw new ForbiddenException("You cannot duplicate this template.");
    }

    const scanResult = this.scanTemplateHtml(template.rawHtml);
    const copy = await this.prisma.invitationTemplate.create({
      data: {
        name: `Copy of ${template.name}`,
        rawHtml: template.rawHtml,
        sourceFileName: template.sourceFileName,
        htmlSize: template.htmlSize,
        scanResult,
        scannedAt: new Date(),
        categoryId: template.categoryId,
        subcategoryId: template.subcategoryId,
        createdById: context.actorId,
      },
      select: {
        id: true,
        name: true,
        status: true,
        sourceFileName: true,
        htmlSize: true,
        scanResult: true,
        scannedAt: true,
        categoryId: true,
        subcategoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.record(context, "invitationTemplate.duplicated", copy.id, {
      sourceTemplateId: template.id,
    });
    this.clearTemplateListCaches();
    return copy;
  }

  async updateTemplate(
    templateId: string,
    dto: UpdateInvitationTemplateDto,
    context: ActorContext,
  ) {
    const existing = await this.prisma.invitationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!existing) {
      throw new NotFoundException("Template not found.");
    }

    const access = await this.templateAccess(context.actorId);
    const canUpdate =
      access.updateAll || (access.updateOwn && existing.createdById === context.actorId);
    if (!canUpdate) {
      throw new ForbiddenException("You cannot update this template.");
    }

    const scanResult = dto.rawHtml ? this.scanTemplateHtml(dto.rawHtml) : undefined;
    if (dto.rawHtml) {
      this.assertNimtoHtml(dto.rawHtml);
    }
    await this.assertTemplateTaxonomy(dto.categoryId, dto.subcategoryId);

    const template = await this.prisma.invitationTemplate.update({
      where: { id: templateId },
      data: {
        name: dto.name?.trim(),
        rawHtml: dto.rawHtml,
        sourceFileName:
          dto.sourceFileName !== undefined
            ? dto.sourceFileName.trim() || null
            : undefined,
        htmlSize: dto.rawHtml ? Buffer.byteLength(dto.rawHtml, "utf8") : undefined,
        scanResult,
        scannedAt: dto.rawHtml ? new Date() : undefined,
        categoryId: dto.categoryId,
        subcategoryId: dto.subcategoryId,
        status: dto.status,
      },
      select: {
        id: true,
        name: true,
        status: true,
        sourceFileName: true,
        htmlSize: true,
        scanResult: true,
        scannedAt: true,
        designId: true,
        categoryId: true,
        subcategoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.record(context, "invitationTemplate.updated", template.id, {
      name: template.name,
      status: template.status,
    });
    this.clearTemplateDetailCache(template.id);
    this.clearTemplateListCaches();
    return template;
  }

  async publishTemplate(templateId: string, context: ActorContext) {
    const template = await this.prisma.invitationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException("Template not found.");
    }

    const scanResult = this.scanTemplateHtml(template.rawHtml);
    const design = await this.prisma.$transaction(async (tx) => {
      const existingDesign = template.designId
        ? await tx.invitationDesign.findUnique({ where: { id: template.designId } })
        : null;
      const nextDesign =
        existingDesign ??
        (await tx.invitationDesign.create({
          data: {
            templateId: template.id,
            name: template.name,
            slug: await this.uniqueDesignSlug(tx, template.name),
            categoryId: template.categoryId,
            subcategoryId: template.subcategoryId,
            createdById: context.actorId,
          },
        }));

      const latestVersion = await tx.designVersion.findFirst({
        where: { designId: nextDesign.id },
        orderBy: { versionNumber: "desc" },
      });
      const versionNumber = (latestVersion?.versionNumber ?? 0) + 1;

      await tx.invitationDesign.update({
        where: { id: nextDesign.id },
        data: {
          name: template.name,
          status: DesignStatus.ACTIVE,
          categoryId: template.categoryId,
          subcategoryId: template.subcategoryId,
        },
      });
      await tx.designVersion.updateMany({
        where: {
          designId: nextDesign.id,
          status: DesignVersionStatus.CURRENT,
        },
        data: { status: DesignVersionStatus.SUPERSEDED },
      });
      await tx.designVersion.create({
        data: {
          designId: nextDesign.id,
          templateId: template.id,
          versionNumber,
          status: DesignVersionStatus.CURRENT,
          name: template.name,
          rawHtml: template.rawHtml,
          htmlSize: template.htmlSize,
          scanResult,
          publishedById: context.actorId,
        },
      });
      await tx.invitationTemplate.update({
        where: { id: template.id },
        data: {
          status: TemplateStatus.PUBLISHED,
          designId: nextDesign.id,
          scanResult,
          scannedAt: new Date(),
        },
      });

      return tx.invitationDesign.findUniqueOrThrow({
        where: { id: nextDesign.id },
        include: {
          versions: {
            orderBy: { versionNumber: "desc" },
            select: {
              id: true,
              versionNumber: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });
    });

    await this.record(context, "invitationDesign.published", design.id, {
      templateId,
      versionNumber: design.versions[0]?.versionNumber,
    });
    this.clearTemplateDetailCache(templateId);
    this.clearTemplateListCaches();
    return design;
  }

  async unpublishTemplate(templateId: string, context: ActorContext) {
    const template = await this.prisma.invitationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException("Template not found.");
    }

    const updatedTemplate = await this.prisma.$transaction(async (tx) => {
      if (template.designId) {
        await tx.invitationDesign.update({
          where: { id: template.designId },
          data: { status: DesignStatus.UNPUBLISHED },
        });
      }

      return tx.invitationTemplate.update({
        where: { id: template.id },
        data: { status: TemplateStatus.UNPUBLISHED },
        select: {
          id: true,
          name: true,
          status: true,
          designId: true,
          updatedAt: true,
        },
      });
    });

    await this.record(context, "invitationDesign.unpublished", templateId, {
      designId: template.designId,
    });
    this.clearTemplateDetailCache(templateId);
    this.clearTemplateListCaches();
    return updatedTemplate;
  }

  async rescanTemplate(templateId: string, context: ActorContext) {
    const existing = await this.prisma.invitationTemplate.findUnique({
      where: { id: templateId },
    });
    if (!existing) {
      throw new NotFoundException("Template not found.");
    }

    const access = await this.templateAccess(context.actorId);
    const canUpdate =
      access.updateAll || (access.updateOwn && existing.createdById === context.actorId);
    if (!canUpdate) {
      throw new ForbiddenException("You cannot rescan this template.");
    }

    const scanResult = this.scanTemplateHtml(existing.rawHtml);
    const template = await this.prisma.invitationTemplate.update({
      where: { id: templateId },
      data: { scanResult, scannedAt: new Date() },
      select: {
        id: true,
        name: true,
        status: true,
        sourceFileName: true,
        htmlSize: true,
        scanResult: true,
        scannedAt: true,
        categoryId: true,
        subcategoryId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.record(context, "invitationTemplate.rescanned", template.id, {
      fields: scanResult.fields.length,
      sections: scanResult.sections.length,
    });
    this.clearTemplateDetailCache(template.id);
    this.clearTemplateListCaches();
    return template;
  }

  async createCategory(dto: CreateDesignCategoryDto, context: ActorContext) {
    try {
      const category = await this.prisma.designCategory.create({
        data: {
          name: dto.name.trim(),
          slug: this.slugify(dto.slug ?? dto.name),
          description: dto.description?.trim() || null,
          sortOrder: dto.sortOrder ?? 0,
          status: dto.status ?? DesignCatalogStatus.ACTIVE,
          createdById: context.actorId,
        },
      });

      await this.record(context, "designCategory.created", category.id, {
        name: category.name,
        slug: category.slug,
      });
      return category;
    } catch (error) {
      this.throwIfUniqueConstraint(error, "A category with this slug exists.");
      throw error;
    }
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateDesignCategoryDto,
    context: ActorContext,
  ) {
    await this.assertCategory(categoryId);
    try {
      const category = await this.prisma.designCategory.update({
        where: { id: categoryId },
        data: this.categoryData(dto),
      });

      await this.record(context, "designCategory.updated", category.id, {
        name: category.name,
        status: category.status,
      });
      return category;
    } catch (error) {
      this.throwIfUniqueConstraint(error, "A category with this slug exists.");
      throw error;
    }
  }

  listSubcategories(categoryId?: string) {
    return this.prisma.designSubcategory.findMany({
      where: categoryId ? { categoryId } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        category: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createSubcategory(
    categoryId: string,
    dto: CreateDesignSubcategoryDto,
    context: ActorContext,
  ) {
    await this.assertCategory(categoryId);
    try {
      const subcategory = await this.prisma.designSubcategory.create({
        data: {
          categoryId,
          name: dto.name.trim(),
          slug: this.slugify(dto.slug ?? dto.name),
          description: dto.description?.trim() || null,
          sortOrder: dto.sortOrder ?? 0,
          status: dto.status ?? DesignCatalogStatus.ACTIVE,
          createdById: context.actorId,
        },
      });

      await this.record(context, "designSubcategory.created", subcategory.id, {
        name: subcategory.name,
        slug: subcategory.slug,
        categoryId,
      });
      return subcategory;
    } catch (error) {
      this.throwIfUniqueConstraint(
        error,
        "A subcategory with this slug exists in this category.",
      );
      throw error;
    }
  }

  async updateSubcategory(
    subcategoryId: string,
    dto: UpdateDesignSubcategoryDto,
    context: ActorContext,
  ) {
    await this.assertSubcategory(subcategoryId);
    try {
      const subcategory = await this.prisma.designSubcategory.update({
        where: { id: subcategoryId },
        data: this.subcategoryData(dto),
      });

      await this.record(context, "designSubcategory.updated", subcategory.id, {
        name: subcategory.name,
        status: subcategory.status,
      });
      return subcategory;
    } catch (error) {
      this.throwIfUniqueConstraint(
        error,
        "A subcategory with this slug exists in this category.",
      );
      throw error;
    }
  }

  private categoryData(dto: UpdateDesignCategoryDto) {
    return {
      name: dto.name?.trim(),
      slug: dto.slug ? this.slugify(dto.slug) : undefined,
      description:
        dto.description !== undefined ? dto.description.trim() || null : undefined,
      sortOrder: dto.sortOrder,
      status: dto.status,
    };
  }

  private subcategoryData(dto: UpdateDesignSubcategoryDto) {
    return {
      name: dto.name?.trim(),
      slug: dto.slug ? this.slugify(dto.slug) : undefined,
      description:
        dto.description !== undefined ? dto.description.trim() || null : undefined,
      sortOrder: dto.sortOrder,
      status: dto.status,
    };
  }

  private async assertCategory(categoryId: string) {
    const category = await this.prisma.designCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException("Design category not found.");
    }
    return category;
  }

  private async assertSubcategory(subcategoryId: string) {
    const subcategory = await this.prisma.designSubcategory.findUnique({
      where: { id: subcategoryId },
    });
    if (!subcategory) {
      throw new NotFoundException("Design subcategory not found.");
    }
    return subcategory;
  }

  private async assertTemplateTaxonomy(
    categoryId?: string,
    subcategoryId?: string,
  ) {
    if (categoryId) {
      await this.assertCategory(categoryId);
    }

    if (!subcategoryId) {
      return;
    }

    const subcategory = await this.assertSubcategory(subcategoryId);
    if (categoryId && subcategory.categoryId !== categoryId) {
      throw new BadRequestException(
        "Selected subcategory does not belong to the selected category.",
      );
    }
  }

  private assertNimtoHtml(rawHtml: string) {
    if (!/<html[\s>]/i.test(rawHtml)) {
      throw new BadRequestException("Template must be a complete HTML file.");
    }

    if (!/<script\b[^>]*\bid\s*=\s*(["']?)nimto-template-meta\1[^>]*>/i.test(rawHtml)) {
      throw new BadRequestException(
        "Template must include nimto-template-meta metadata.",
      );
    }
  }

  private scanTemplateHtml(rawHtml: string): TemplateScanResult {
    this.assertNimtoHtml(rawHtml);
    const meta = this.templateMeta(rawHtml);
    const scannedSections = this.scanSections(rawHtml);
    const sections = scannedSections.map(({ index: _index, ...section }) => section);
    const fields = this.scanFields(rawHtml, scannedSections);
    if (!fields.length) {
      throw new BadRequestException(
        "Template must include at least one data-nimto-field marker.",
      );
    }

    const countdownFieldKey =
      this.firstAttribute(rawHtml, "data-nimto-countdown-for") ??
      this.stringMeta(meta, "countdownFieldKey");

    if (
      countdownFieldKey &&
      !fields.some((field) => field.key === countdownFieldKey)
    ) {
      throw new BadRequestException(
        "Countdown field must match a data-nimto-field key.",
      );
    }

    return {
      version: 1,
      title: this.stringMeta(meta, "title"),
      categoryHint: this.stringMeta(meta, "categoryHint"),
      sections,
      fields,
      countdownFieldKey,
      customNameFieldKeys: fields
        .filter((field) => field.type === "custom_name" || field.paid)
        .map((field) => field.key),
      hasGallery: /data-nimto-gallery/i.test(rawHtml),
      hasMusic: /data-nimto-music/i.test(rawHtml),
      hasMap: /data-nimto-map/i.test(rawHtml),
    };
  }

  private scanSections(rawHtml: string) {
    const sections = new Map<string, ScannedSection>();
    for (const tag of rawHtml.matchAll(/<[^>]*\bdata-nimto-section(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>/gis)) {
      const attrs = this.attributes(tag[0]);
      const key = attrs["data-nimto-section"];
      if (!key) continue;
      this.assertFieldKey(key, "section");
      sections.set(key, {
        key,
        label: attrs["data-nimto-section-label"] ?? this.labelize(key),
        index: tag.index ?? 0,
      });
    }
    return [...sections.values()];
  }

  private scanFields(rawHtml: string, sections: ScannedSection[]) {
    const seen = new Set<string>();
    const sectionKeys = new Set(sections.map((section) => section.key));
    const fields: TemplateField[] = [];

    for (const tag of rawHtml.matchAll(/<[^>]*\bdata-nimto-field(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?[^>]*>/gis)) {
      const attrs = this.attributes(tag[0]);
      const key = attrs["data-nimto-field"];
      if (!key) continue;
      this.assertFieldKey(key, "field");
      if (seen.has(key)) {
        throw new BadRequestException(`Duplicate field key: ${key}.`);
      }
      seen.add(key);

      const sectionKey =
        attrs["data-nimto-section-ref"] ??
        this.nearestSectionKey(sections, tag.index ?? 0);
      if (sectionKey && !sectionKeys.has(sectionKey)) {
        throw new BadRequestException(`Unknown section for field ${key}.`);
      }

      fields.push({
        key,
        label: attrs["data-nimto-label"] ?? this.labelize(key),
        type: attrs["data-nimto-type"] ?? "text",
        sectionKey,
        required: this.booleanAttribute(attrs["data-nimto-required"]),
        paid: this.booleanAttribute(attrs["data-nimto-paid"]),
        locked: this.booleanAttribute(attrs["data-nimto-locked"]),
      });
    }

    return fields;
  }

  private templateMeta(rawHtml: string) {
    let content = "";
    for (const match of rawHtml.matchAll(/<script\b([^>]*)>(.*?)<\/script>/gis)) {
      const attrs = this.attributes(match[1]);
      if (attrs.id === "nimto-template-meta") {
        content = match[2].trim();
        break;
      }
    }
    if (!content) return {};

    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      throw new BadRequestException("nimto-template-meta must be valid JSON.");
    }
  }

  private attributes(tag: string) {
    const attrs: Record<string, string> = {};
    for (const match of tag.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gis)) {
      attrs[match[1].toLowerCase()] = (
        match[2] ??
        match[3] ??
        match[4] ??
        ""
      ).trim();
    }
    return attrs;
  }

  private firstAttribute(rawHtml: string, attribute: string) {
    const match = rawHtml.match(
      new RegExp(`${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
    );
    return match?.[1] ?? match?.[2] ?? match?.[3];
  }

  private nearestSectionKey(sections: ScannedSection[], index: number) {
    return sections
      .filter((section) => section.index <= index)
      .sort((left, right) => right.index - left.index)[0]?.key;
  }

  private assertFieldKey(key: string, label: string) {
    if (!/^[a-z][a-z0-9_]*$/.test(key)) {
      throw new BadRequestException(
        `Nimto ${label} keys must use lowercase snake_case.`,
      );
    }
  }

  private booleanAttribute(value?: string) {
    return value === "true" || value === "1" || value === "";
  }

  private stringMeta(meta: Record<string, unknown>, key: string) {
    return typeof meta[key] === "string" ? String(meta[key]) : undefined;
  }

  private async templateAccess(userId: string): Promise<TemplateAccess> {
    const cached = templateAccessCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });

    const roleNames = user?.roles.map((userRole) => userRole.role.name) ?? [];
    if (roleNames.includes(SUPER_ADMIN_ROLE)) {
      const value = {
        viewOwn: true,
        viewAll: true,
        updateOwn: true,
        updateAll: true,
      };
      templateAccessCache.set(userId, {
        expiresAt: Date.now() + TEMPLATE_ACCESS_CACHE_MS,
        value,
      });
      return value;
    }

    const permissions = new Set(
      user?.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.key,
        ),
      ) ?? [],
    );

    const value = {
      viewOwn: permissions.has(PERMISSIONS.templateViewOwn),
      viewAll: permissions.has(PERMISSIONS.templateViewAll),
      updateOwn: permissions.has(PERMISSIONS.templateUpdateOwn),
      updateAll: permissions.has(PERMISSIONS.templateUpdateAll),
    };
    templateAccessCache.set(userId, {
      expiresAt: Date.now() + TEMPLATE_ACCESS_CACHE_MS,
      value,
    });
    return value;
  }

  private async designAccess(userId: string): Promise<DesignAccess> {
    const cached = designAccessCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        roles: {
          select: {
            role: {
              select: {
                name: true,
                permissions: {
                  select: { permission: { select: { key: true } } },
                },
              },
            },
          },
        },
      },
    });

    const roleNames = user?.roles.map((userRole) => userRole.role.name) ?? [];
    if (roleNames.includes(SUPER_ADMIN_ROLE)) {
      const value = { viewOwn: true, viewAll: true };
      designAccessCache.set(userId, {
        expiresAt: Date.now() + TEMPLATE_ACCESS_CACHE_MS,
        value,
      });
      return value;
    }

    const permissions = new Set(
      user?.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.key,
        ),
      ) ?? [],
    );

    const value = {
      viewOwn: permissions.has(PERMISSIONS.designViewOwn),
      viewAll: permissions.has(PERMISSIONS.designViewAll),
    };
    designAccessCache.set(userId, {
      expiresAt: Date.now() + TEMPLATE_ACCESS_CACHE_MS,
      value,
    });
    return value;
  }

  private clearTemplateDetailCache(templateId: string) {
    for (const key of templateDetailCache.keys()) {
      if (key.endsWith(`:${templateId}`)) {
        templateDetailCache.delete(key);
      }
    }
  }

  private clearTemplateListCaches() {
    templateListCache.clear();
    designListCache.clear();
  }

  private async record(
    context: ActorContext,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    void this.audit.record({
      actorId: context.actorId,
      action,
      entityType: "TemplateDesign",
      entityId,
      metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  private throwIfUniqueConstraint(error: unknown, message: string) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new BadRequestException(message);
    }
  }

  private slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug || `category-${Date.now()}`;
  }

  private async uniqueDesignSlug(
    tx: Prisma.TransactionClient,
    name: string,
  ) {
    const base = this.slugify(name);
    let slug = base;
    let suffix = 2;
    while (await tx.invitationDesign.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix}`;
      suffix += 1;
    }
    return slug;
  }

  private labelize(value: string) {
    return value
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
}
