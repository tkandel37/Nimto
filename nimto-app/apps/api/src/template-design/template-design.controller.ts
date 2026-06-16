import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AnimationComponentType } from "@prisma/client";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { JwtAuthGuard, AuthenticatedRequest } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { PERMISSIONS } from "../auth/permissions";
import { CreateDesignCategoryDto } from "./dto/create-design-category.dto";
import { CreateAnimationComponentDto } from "./dto/create-animation-component.dto";
import { CreateDesignSubcategoryDto } from "./dto/create-design-subcategory.dto";
import { CreateInvitationTemplateDto } from "./dto/create-invitation-template.dto";
import { UpdateDesignCategoryDto } from "./dto/update-design-category.dto";
import { UpdateDesignSubcategoryDto } from "./dto/update-design-subcategory.dto";
import { UpdateInvitationTemplateDto } from "./dto/update-invitation-template.dto";
import { TemplateDesignService } from "./template-design.service";

@Controller("template-design")
export class TemplateDesignController {
  constructor(private readonly templateDesign: TemplateDesignService) {}

  @Get("public/categories")
  listPublicCategories() {
    return this.templateDesign.listPublicCategories();
  }

  @Get("public/designs")
  listPublicDesigns(
    @Query("categoryId") categoryId?: string,
    @Query("subcategoryId") subcategoryId?: string,
    @Query("search") search?: string,
  ) {
    return this.templateDesign.listPublicDesigns({
      categoryId,
      subcategoryId,
      search,
    });
  }

  @Get("public/animations")
  listPublicAnimations(@Query("type") type?: AnimationComponentType) {
    return this.templateDesign.listPublicAnimationComponents(type);
  }

  @Get("animations")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.templateViewAll)
  listAnimations(@Query("type") type?: AnimationComponentType) {
    return this.templateDesign.listAnimationComponents(type);
  }

  @Post("animations")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.templateCreate)
  createAnimation(
    @Body() dto: CreateAnimationComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.createAnimationComponent(
      dto,
      this.context(request),
    );
  }

  @Get("templates")
  @UseGuards(JwtAuthGuard)
  listTemplates(@Req() request: AuthenticatedRequest) {
    return this.templateDesign.listTemplates(request.user!.sub);
  }

  @Get("templates/:templateId")
  @UseGuards(JwtAuthGuard)
  getTemplate(
    @Param("templateId") templateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.getTemplate(templateId, request.user!.sub);
  }

  @Get("designs")
  @UseGuards(JwtAuthGuard)
  listDesigns(@Req() request: AuthenticatedRequest) {
    return this.templateDesign.listDesigns(request.user!.sub);
  }

  @Post("templates")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.templateCreate)
  createTemplate(
    @Body() dto: CreateInvitationTemplateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.createTemplate(dto, this.context(request));
  }

  @Post("templates/:templateId/duplicate")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.templateDuplicate)
  duplicateTemplate(
    @Param("templateId") templateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.duplicateTemplate(
      templateId,
      this.context(request),
    );
  }

  @Patch("templates/:templateId")
  @UseGuards(JwtAuthGuard)
  updateTemplate(
    @Param("templateId") templateId: string,
    @Body() dto: UpdateInvitationTemplateDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.updateTemplate(
      templateId,
      dto,
      this.context(request),
    );
  }

  @Post("templates/:templateId/rescan")
  @UseGuards(JwtAuthGuard)
  rescanTemplate(
    @Param("templateId") templateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.rescanTemplate(
      templateId,
      this.context(request),
    );
  }

  @Post("templates/:templateId/publish")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.templatePublish)
  publishTemplate(
    @Param("templateId") templateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.publishTemplate(
      templateId,
      this.context(request),
    );
  }

  @Post("templates/:templateId/unpublish")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.templateUnpublish)
  unpublishTemplate(
    @Param("templateId") templateId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.unpublishTemplate(
      templateId,
      this.context(request),
    );
  }

  @Get("categories")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.categoryView)
  listCategories() {
    return this.templateDesign.listCategories();
  }

  @Post("categories")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.categoryManage)
  createCategory(
    @Body() dto: CreateDesignCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.createCategory(dto, this.context(request));
  }

  @Patch("categories/:categoryId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.categoryManage)
  updateCategory(
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateDesignCategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.updateCategory(
      categoryId,
      dto,
      this.context(request),
    );
  }

  @Get("subcategories")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.subcategoryView)
  listSubcategories(@Query("categoryId") categoryId?: string) {
    return this.templateDesign.listSubcategories(categoryId);
  }

  @Post("categories/:categoryId/subcategories")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.subcategoryManage)
  createSubcategory(
    @Param("categoryId") categoryId: string,
    @Body() dto: CreateDesignSubcategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.createSubcategory(
      categoryId,
      dto,
      this.context(request),
    );
  }

  @Patch("subcategories/:subcategoryId")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.subcategoryManage)
  updateSubcategory(
    @Param("subcategoryId") subcategoryId: string,
    @Body() dto: UpdateDesignSubcategoryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.templateDesign.updateSubcategory(
      subcategoryId,
      dto,
      this.context(request),
    );
  }

  private context(request: AuthenticatedRequest) {
    return {
      actorId: request.user!.sub,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };
  }
}
