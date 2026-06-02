import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DesignStatus, DesignVersionStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { UpdateEventDto } from "./dto/update-event.dto";

type ActorContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.event.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        designVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            design: { select: { id: true, name: true, slug: true, status: true } },
          },
        },
      },
    });
  }

  async create(userId: string, dto: CreateEventDto, context: ActorContext) {
    const designData = await this.designEventData(dto);
    const event = await this.prisma.event.create({
      data: {
        title: dto.title.trim(),
        type: dto.type,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        venue: dto.venue?.trim() || undefined,
        description: dto.description?.trim() || undefined,
        coverImage: dto.coverImage?.trim() || undefined,
        isPublished: dto.isPublished,
        ...designData,
        userId,
        slug: await this.uniqueSlug(dto.title),
      },
    });

    await this.audit.record({
      actorId: context.actorId,
      action: "event.created",
      entityType: "Event",
      entityId: event.id,
      metadata: { title: event.title, slug: event.slug },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return event;
  }

  async update(
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
    context: ActorContext,
  ) {
    await this.assertOwner(userId, eventId);
    const designData = await this.designEventData(dto);
    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: { ...this.eventData(dto), ...designData },
    });

    await this.audit.record({
      actorId: context.actorId,
      action: "event.updated",
      entityType: "Event",
      entityId: event.id,
      metadata: { title: event.title, isPublished: event.isPublished },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return event;
  }

  async remove(userId: string, eventId: string, context: ActorContext) {
    const existing = await this.assertOwner(userId, eventId);
    await this.prisma.event.delete({ where: { id: eventId } });

    await this.audit.record({
      actorId: context.actorId,
      action: "event.deleted",
      entityType: "Event",
      entityId: eventId,
      metadata: { title: existing.title, slug: existing.slug },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return { success: true };
  }

  async findPublished(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        user: { select: { id: true, name: true } },
        designVersion: {
          include: { design: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    if (!event || !event.isPublished) {
      throw new NotFoundException("Invitation not found.");
    }

    return event;
  }

  private eventData(dto: CreateEventDto | UpdateEventDto) {
    return {
      title: dto.title?.trim(),
      type: dto.type,
      eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
      venue: dto.venue?.trim() || undefined,
      description: dto.description?.trim() || undefined,
      coverImage: dto.coverImage?.trim() || undefined,
      isPublished: dto.isPublished,
    };
  }

  private async designEventData(dto: CreateEventDto | UpdateEventDto) {
    if (!dto.designVersionId && dto.designFieldValues === undefined) {
      return {};
    }
    if (!dto.designVersionId) {
      throw new BadRequestException("Design version is required for design fields.");
    }

    const version = await this.prisma.designVersion.findUnique({
      where: { id: dto.designVersionId },
      include: { design: true },
    });
    if (
      !version ||
      version.status !== DesignVersionStatus.CURRENT ||
      version.design.status !== DesignStatus.ACTIVE
    ) {
      throw new BadRequestException("Select a current active design version.");
    }

    return {
      designVersionId: version.id,
      designFieldValues: (dto.designFieldValues ?? {}) as Prisma.InputJsonObject,
    };
  }

  private async assertOwner(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException("Event not found.");
    }

    if (event.userId !== userId) {
      throw new ForbiddenException("You cannot manage this event.");
    }

    return event;
  }

  private async uniqueSlug(title: string) {
    const base = this.slugify(title);
    let candidate = base;
    let suffix = 2;

    while (await this.prisma.event.findUnique({ where: { slug: candidate } })) {
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

    return slug || `event-${Date.now()}`;
  }
}
