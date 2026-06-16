import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DesignStatus,
  DesignVersionStatus,
  InvitationInvitee,
  Prisma,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateInviteesDto } from "./dto/create-invitees.dto";
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
        _count: { select: { invitees: true } },
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

    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "event.created",
        entityType: "Event",
        entityId: event.id,
        metadata: { title: event.title, slug: event.slug },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "event create audit",
    );

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

    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "event.updated",
        entityType: "Event",
        entityId: event.id,
        metadata: { title: event.title, isPublished: event.isPublished },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "event update audit",
    );

    return event;
  }

  async remove(userId: string, eventId: string, context: ActorContext) {
    const existing = await this.assertOwner(userId, eventId);
    await this.prisma.event.delete({ where: { id: eventId } });

    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "event.deleted",
        entityType: "Event",
        entityId: eventId,
        metadata: { title: existing.title, slug: existing.slug },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "event delete audit",
    );

    return { success: true };
  }

  async listInvitees(userId: string, eventId: string) {
    await this.assertOwner(userId, eventId);
    return this.prisma.invitationInvitee.findMany({
      where: { eventId },
      orderBy: { createdAt: "asc" },
    });
  }

  async createInvitees(
    userId: string,
    eventId: string,
    dto: CreateInviteesDto,
    context: ActorContext,
  ) {
    const event = await this.assertOwner(userId, eventId);
    const names = this.normalizedInviteeNames(dto.names);
    if (!names.length) {
      throw new BadRequestException("Add at least one invitee name.");
    }

    const existingNames = new Set(
      (
        await this.prisma.invitationInvitee.findMany({
          where: { eventId },
          select: { name: true },
        })
      ).map((invitee) => invitee.name.toLowerCase()),
    );
    const created: InvitationInvitee[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const name of names) {
      if (existingNames.has(name.toLowerCase())) {
        skipped.push({ name, reason: "Duplicate" });
        continue;
      }

      const invitee = await this.prisma.invitationInvitee.create({
        data: {
          eventId,
          name,
          slug: await this.uniqueInviteeSlug(event.slug, name),
        },
      });
      existingNames.add(name.toLowerCase());
      created.push(invitee);
    }

    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "eventInvitees.created",
        entityType: "Event",
        entityId: eventId,
        metadata: {
          created: created.length,
          skipped: skipped.length,
          title: event.title,
        },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "invitee create audit",
    );

    return { created, skipped };
  }

  async regenerateInviteeSlug(
    userId: string,
    eventId: string,
    inviteeId: string,
    context: ActorContext,
  ) {
    const event = await this.assertOwner(userId, eventId);
    const invitee = await this.prisma.invitationInvitee.findFirst({
      where: { id: inviteeId, eventId },
    });
    if (!invitee) {
      throw new NotFoundException("Invitee not found.");
    }

    const updated = await this.prisma.invitationInvitee.update({
      where: { id: invitee.id },
      data: { slug: await this.uniqueInviteeSlug(event.slug, invitee.name) },
    });

    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "eventInvitee.slugRegenerated",
        entityType: "InvitationInvitee",
        entityId: invitee.id,
        metadata: { eventId },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "invitee slug audit",
    );

    return updated;
  }

  async deleteInvitee(
    userId: string,
    eventId: string,
    inviteeId: string,
    context: ActorContext,
  ) {
    await this.assertOwner(userId, eventId);
    const invitee = await this.prisma.invitationInvitee.findFirst({
      where: { id: inviteeId, eventId },
    });
    if (!invitee) {
      throw new NotFoundException("Invitee not found.");
    }

    await this.prisma.invitationInvitee.delete({ where: { id: invitee.id } });
    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "eventInvitee.deleted",
        entityType: "InvitationInvitee",
        entityId: invitee.id,
        metadata: { eventId, name: invitee.name },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "invitee delete audit",
    );

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
      const invitee = await this.prisma.invitationInvitee.findUnique({
        where: { slug },
        include: {
          event: {
            include: {
              user: { select: { id: true, name: true } },
              designVersion: {
                include: {
                  design: { select: { id: true, name: true, slug: true } },
                },
              },
            },
          },
        },
      });
      if (!invitee?.event.isPublished) {
        throw new NotFoundException("Invitation not found.");
      }

      return {
        ...invitee.event,
        inviteeName: invitee.name,
        inviteeSlug: invitee.slug,
      };
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

    while (await this.slugExists(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private async uniqueInviteeSlug(eventSlug: string, name: string) {
    const base = this.slugify(`${eventSlug}-${name}`);
    let candidate = base;
    let suffix = 2;

    while (await this.slugExists(candidate)) {
      candidate = `${base}-${suffix}`;
      suffix += 1;
    }

    return candidate;
  }

  private async slugExists(slug: string) {
    const [event, invitee] = await Promise.all([
      this.prisma.event.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.invitationInvitee.findUnique({
        where: { slug },
        select: { id: true },
      }),
    ]);
    return Boolean(event || invitee);
  }

  private normalizedInviteeNames(names: string[]) {
    const seen = new Set<string>();
    return names
      .map((name) => name.trim().replace(/\s+/g, " "))
      .filter(Boolean)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private slugify(value: string) {
    const slug = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return slug || `event-${Date.now()}`;
  }

  private runAfterResponse(work: Promise<unknown>, label: string) {
    void work.catch((error) => {
      console.error(`Failed to complete ${label}`, error);
    });
  }
}
