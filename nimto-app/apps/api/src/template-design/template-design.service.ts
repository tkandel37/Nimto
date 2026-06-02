import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DesignCatalogStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateDesignCategoryDto } from "./dto/create-design-category.dto";
import { CreateDesignSubcategoryDto } from "./dto/create-design-subcategory.dto";
import { UpdateDesignCategoryDto } from "./dto/update-design-category.dto";
import { UpdateDesignSubcategoryDto } from "./dto/update-design-subcategory.dto";

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
