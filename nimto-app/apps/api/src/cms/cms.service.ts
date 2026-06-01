import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, PublishStatus } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PERMISSIONS, SUPER_ADMIN_ROLE } from "../auth/permissions";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBlogPostDto } from "./dto/create-blog-post.dto";
import { UpdateBlogPostDto } from "./dto/update-blog-post.dto";
import { UpsertPageContentDto } from "./dto/upsert-page-content.dto";

type ActorContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

const pageKeys = ["landing", "about", "features"] as const;

@Injectable()
export class CmsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listPublicPages() {
    return this.prisma.pageContent.findMany({
      where: { key: { in: [...pageKeys] } },
      orderBy: { key: "asc" },
    });
  }

  async getPublicPage(key: string) {
    const page = await this.prisma.pageContent.findUnique({ where: { key } });
    if (!page) {
      return this.defaultPage(key);
    }
    return page;
  }

  listAdminPages() {
    return this.prisma.pageContent.findMany({ orderBy: { key: "asc" } });
  }

  async upsertPage(
    key: string,
    dto: UpsertPageContentDto,
    context: ActorContext,
  ) {
    await this.assertContentManager(context.actorId);
    const page = await this.prisma.pageContent.upsert({
      where: { key },
      update: {
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        body: dto.body?.trim() || null,
        metadata:
          (dto.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        publishedAt: new Date(),
      },
      create: {
        key,
        title: dto.title.trim(),
        subtitle: dto.subtitle?.trim() || null,
        body: dto.body?.trim() || null,
        metadata: dto.metadata as Prisma.InputJsonValue | undefined,
        publishedAt: new Date(),
      },
    });

    await this.record(context, "content.updated", "PageContent", page.id, {
      key: page.key,
    });
    return page;
  }

  listPublicPosts() {
    return this.prisma.blogPost.findMany({
      where: { status: PublishStatus.PUBLISHED },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async getPublicPost(slug: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { slug },
      include: { author: { select: { id: true, name: true } } },
    });
    if (!post || post.status !== PublishStatus.PUBLISHED) {
      throw new NotFoundException("Blog post not found.");
    }
    return post;
  }

  async listAdminPosts(actorId: string) {
    const access = await this.blogAccess(actorId);
    return this.prisma.blogPost.findMany({
      where: access.canManageAll ? undefined : { authorId: actorId },
      orderBy: { updatedAt: "desc" },
      include: { author: { select: { id: true, name: true, email: true } } },
    });
  }

  async createPost(dto: CreateBlogPostDto, context: ActorContext) {
    await this.assertBlogManager(context.actorId);
    const published = dto.status === PublishStatus.PUBLISHED;
    const post = await this.prisma.blogPost.create({
      data: {
        authorId: context.actorId,
        title: dto.title.trim(),
        slug: await this.uniqueSlug(dto.title),
        excerpt: dto.excerpt?.trim() || null,
        content: dto.content.trim(),
        metaTitle: dto.metaTitle?.trim() || null,
        metaDescription: dto.metaDescription?.trim() || null,
        keywords: dto.keywords?.trim() || null,
        status: dto.status ?? PublishStatus.DRAFT,
        publishedAt: published ? new Date() : null,
      },
    });

    await this.record(context, "blog.created", "BlogPost", post.id, {
      title: post.title,
      status: post.status,
    });
    return post;
  }

  async updatePost(
    postId: string,
    dto: UpdateBlogPostDto,
    context: ActorContext,
  ) {
    const existing = await this.assertCanEditPost(postId, context.actorId);
    const status = dto.status ?? existing.status;
    const post = await this.prisma.blogPost.update({
      where: { id: postId },
      data: {
        title: dto.title?.trim(),
        excerpt:
          dto.excerpt !== undefined ? dto.excerpt.trim() || null : undefined,
        content: dto.content?.trim(),
        metaTitle:
          dto.metaTitle !== undefined
            ? dto.metaTitle.trim() || null
            : undefined,
        metaDescription:
          dto.metaDescription !== undefined
            ? dto.metaDescription.trim() || null
            : undefined,
        keywords:
          dto.keywords !== undefined ? dto.keywords.trim() || null : undefined,
        status,
        publishedAt:
          status === PublishStatus.PUBLISHED && !existing.publishedAt
            ? new Date()
            : status === PublishStatus.DRAFT
              ? null
              : undefined,
      },
    });

    await this.record(context, "blog.updated", "BlogPost", post.id, {
      title: post.title,
      status: post.status,
    });
    return post;
  }

  async deletePost(postId: string, context: ActorContext) {
    const existing = await this.assertCanEditPost(postId, context.actorId);
    await this.prisma.blogPost.delete({ where: { id: postId } });
    await this.record(context, "blog.deleted", "BlogPost", postId, {
      title: existing.title,
    });
    return { success: true };
  }

  private async assertContentManager(actorId: string) {
    const access = await this.access(actorId);
    if (!access.permissions.has(PERMISSIONS.contentManage)) {
      throw new ForbiddenException("You cannot manage website content.");
    }
  }

  private async assertBlogManager(actorId: string) {
    const access = await this.blogAccess(actorId);
    if (!access.canManageAll && !access.canManageOwn) {
      throw new ForbiddenException("You cannot manage blog posts.");
    }
  }

  private async assertCanEditPost(postId: string, actorId: string) {
    const post = await this.prisma.blogPost.findUnique({
      where: { id: postId },
    });
    if (!post) {
      throw new NotFoundException("Blog post not found.");
    }

    const access = await this.blogAccess(actorId);
    if (
      !access.canManageAll &&
      !(access.canManageOwn && post.authorId === actorId)
    ) {
      throw new ForbiddenException("You can only manage your own blog posts.");
    }
    return post;
  }

  private async blogAccess(actorId: string) {
    const access = await this.access(actorId);
    return {
      canManageAll:
        access.isSuperAdmin ||
        access.permissions.has(PERMISSIONS.blogManageAll),
      canManageOwn:
        access.isSuperAdmin ||
        access.permissions.has(PERMISSIONS.blogManageOwn),
    };
  }

  private async access(actorId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: actorId },
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

    const isSuperAdmin =
      user?.roles.some((userRole) => userRole.role.name === SUPER_ADMIN_ROLE) ??
      false;
    const permissions = new Set(
      user?.roles.flatMap((userRole) =>
        userRole.role.permissions.map(
          (rolePermission) => rolePermission.permission.key,
        ),
      ) ?? [],
    );
    if (isSuperAdmin) {
      permissions.add(PERMISSIONS.contentManage);
      permissions.add(PERMISSIONS.blogManageAll);
      permissions.add(PERMISSIONS.blogManageOwn);
    }

    return { isSuperAdmin, permissions };
  }

  private defaultPage(key: string) {
    const defaults: Record<
      string,
      { title: string; subtitle: string; body: string }
    > = {
      landing: {
        title: "Digital invitations made simple",
        subtitle:
          "Create, personalize, and share event invitations from one clean workspace.",
        body: "myNimto helps hosts prepare digital invitations for weddings, birthdays, engagements, and community events.",
      },
      about: {
        title: "About myNimto",
        subtitle: "A practical invitation platform built for modern events.",
        body: "We are building myNimto to make invitation creation, guest personalization, and sharing easier for families and event teams.",
      },
      features: {
        title: "Features",
        subtitle: "Everything needed to create and manage digital invitations.",
        body: "Design selection, guest names, PDF export, map links, QR options, countdowns, and multilingual content are part of the product roadmap.",
      },
    };

    return {
      id: key,
      key,
      ...(defaults[key] ?? defaults.landing),
      metadata: null,
      publishedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private async uniqueSlug(title: string) {
    const base = this.slugify(title);
    let candidate = base;
    let suffix = 2;

    while (
      await this.prisma.blogPost.findUnique({ where: { slug: candidate } })
    ) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || `blog-${Date.now()}`;
  }

  private record(
    context: ActorContext,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Prisma.InputJsonValue,
  ) {
    return this.audit.record({
      actorId: context.actorId,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}
