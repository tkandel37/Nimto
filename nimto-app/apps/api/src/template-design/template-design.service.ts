import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DesignCatalogStatus, Prisma } from "@prisma/client";
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
    return this.prisma.designCategory.findMany({
      where: { status: DesignCatalogStatus.ACTIVE },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        subcategories: {
          where: { status: DesignCatalogStatus.ACTIVE },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
      },
    });
  }

  async listTemplates(userId: string) {
    const access = await this.templateAccess(userId);
    if (!access.viewAll && !access.viewOwn) {
      throw new ForbiddenException("You cannot view templates.");
    }

    return this.prisma.invitationTemplate.findMany({
      where: access.viewAll ? undefined : { createdById: userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        sourceFileName: true,
        htmlSize: true,
        categoryId: true,
        subcategoryId: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        subcategory: { select: { id: true, name: true, slug: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async getTemplate(templateId: string, userId: string) {
    const template = await this.prisma.invitationTemplate.findUnique({
      where: { id: templateId },
      include: {
        category: true,
        subcategory: true,
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

    return template;
  }

  async createTemplate(
    dto: CreateInvitationTemplateDto,
    context: ActorContext,
  ) {
    this.assertNimtoHtml(dto.rawHtml);
    await this.assertTemplateTaxonomy(dto.categoryId, dto.subcategoryId);

    const template = await this.prisma.invitationTemplate.create({
      data: {
        name: dto.name.trim(),
        rawHtml: dto.rawHtml,
        sourceFileName: dto.sourceFileName?.trim() || null,
        htmlSize: Buffer.byteLength(dto.rawHtml, "utf8"),
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
    return template;
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

    if (!/id=(["'])nimto-template-meta\1/i.test(rawHtml)) {
      throw new BadRequestException(
        "Template must include nimto-template-meta metadata.",
      );
    }
  }

  private async templateAccess(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const roleNames = user?.roles.map((userRole) => userRole.role.name) ?? [];
    if (roleNames.includes(SUPER_ADMIN_ROLE)) {
      return {
        viewOwn: true,
        viewAll: true,
        updateOwn: true,
        updateAll: true,
      };
    }

    const permissions = new Set(
      user?.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.key,
        ),
      ) ?? [],
    );

    return {
      viewOwn: permissions.has(PERMISSIONS.templateViewOwn),
      viewAll: permissions.has(PERMISSIONS.templateViewAll),
      updateOwn: permissions.has(PERMISSIONS.templateUpdateOwn),
      updateAll: permissions.has(PERMISSIONS.templateUpdateAll),
    };
  }

  private async record(
    context: ActorContext,
    action: string,
    entityId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    await this.audit.record({
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
}
