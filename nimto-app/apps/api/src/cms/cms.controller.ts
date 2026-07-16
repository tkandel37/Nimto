import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CmsService } from "./cms.service";
import { CreateBlogPostDto } from "./dto/create-blog-post.dto";
import { UpdateBlogPostDto } from "./dto/update-blog-post.dto";
import { UpsertPageContentDto } from "./dto/upsert-page-content.dto";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { PERMISSIONS } from "../auth/permissions";

@Controller("cms")
export class CmsController {
  constructor(private readonly cmsService: CmsService) {}

  @Get("public/pages")
  listPublicPages() {
    return this.cmsService.listPublicPages();
  }

  @Get("public/pages/:key")
  getPublicPage(@Param("key") key: string) {
    return this.cmsService.getPublicPage(key);
  }

  @Get("public/blog")
  listPublicPosts() {
    return this.cmsService.listPublicPosts();
  }

  @Get("public/blog/:slug")
  getPublicPost(@Param("slug") slug: string) {
    return this.cmsService.getPublicPost(slug);
  }

  @Get("admin/pages")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.contentManage)
  listAdminPages() {
    return this.cmsService.listAdminPages();
  }

  @Patch("admin/pages/:key")
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions(PERMISSIONS.contentManage)
  upsertPage(
    @Param("key") key: string,
    @Body() dto: UpsertPageContentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cmsService.upsertPage(key, dto, this.context(request));
  }

  @Get("admin/blog")
  @UseGuards(JwtAuthGuard)
  listAdminPosts(@Req() request: AuthenticatedRequest) {
    return this.cmsService.listAdminPosts(request.user!.sub);
  }

  @Post("admin/blog")
  @UseGuards(JwtAuthGuard)
  createPost(
    @Body() dto: CreateBlogPostDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cmsService.createPost(dto, this.context(request));
  }

  @Patch("admin/blog/:postId")
  @UseGuards(JwtAuthGuard)
  updatePost(
    @Param("postId") postId: string,
    @Body() dto: UpdateBlogPostDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cmsService.updatePost(postId, dto, this.context(request));
  }

  @Delete("admin/blog/:postId")
  @UseGuards(JwtAuthGuard)
  deletePost(
    @Param("postId") postId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.cmsService.deletePost(postId, this.context(request));
  }

  private context(request: AuthenticatedRequest) {
    return {
      actorId: request.user!.sub,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };
  }
}
