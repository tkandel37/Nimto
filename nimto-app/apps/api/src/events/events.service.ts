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
  RsvpStatus,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateInviteesDto } from "./dto/create-invitees.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { SubmitRsvpDto } from "./dto/submit-rsvp.dto";
import { CreateGuestRecordsDto } from "./dto/create-guest-records.dto";
import { UpdateInviteeDto } from "./dto/update-invitee.dto";
import { SaveEventDesignDraftDto } from "./dto/save-event-design-draft.dto";

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
      select: {
        id: true,
        title: true,
        type: true,
        eventDate: true,
        venue: true,
        slug: true,
        isPublished: true,
        archivedAt: true,
        openCount: true,
        firstOpenedAt: true,
        lastOpenedAt: true,
        rsvpDeadline: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { invitees: true } },
        designVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            design: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        },
      },
    });
  }

  async findForUser(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      select: {
        id: true,
        title: true,
        type: true,
        eventDate: true,
        venue: true,
        description: true,
        coverImage: true,
        slug: true,
        isPublished: true,
        archivedAt: true,
        openCount: true,
        firstOpenedAt: true,
        lastOpenedAt: true,
        rsvpDeadline: true,
        organizerNotes: true,
        checklist: true,
        designFieldValues: true,
        draftDesignVersionId: true,
        draftDesignFieldValues: true,
        draftSavedAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { invitees: true } },
        designVersion: {
          select: {
            id: true,
            versionNumber: true,
            status: true,
            design: {
              select: { id: true, name: true, slug: true, status: true },
            },
            rawHtml: true,
            scanResult: true,
          },
        },
        draftDesignVersion: {
          select: {
            id: true,
            versionNumber: true,
            rawHtml: true,
            scanResult: true,
            design: {
              select: { id: true, name: true, slug: true, status: true },
            },
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException("Event not found.");
    }

    return event;
  }

  async listDesignHistory(userId: string) {
    const history = await this.prisma.userDesignUsage.findMany({
      where: { userId },
      orderBy: { lastUsedAt: "desc" },
      include: {
        design: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            category: { select: { id: true, name: true, slug: true } },
            subcategory: { select: { id: true, name: true, slug: true } },
            versions: {
              orderBy: { versionNumber: "desc" },
              select: {
                id: true,
                versionNumber: true,
                status: true,
                _count: { select: { publishedEvents: { where: { userId } } } },
              },
            },
          },
        },
        lastUsedVersion: {
          select: {
            id: true,
            versionNumber: true,
            name: true,
            rawHtml: true,
          },
        },
      },
    });

    return history.map((item) => ({
      ...item,
      design: {
        ...item.design,
        activeEventCount: item.design.versions.reduce(
          (count, version) => count + version._count.publishedEvents,
          0,
        ),
        versions: item.design.versions
          .filter((version) => version.status === DesignVersionStatus.CURRENT)
          .map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
          })),
      },
    }));
  }

  async create(userId: string, dto: CreateEventDto, context: ActorContext) {
    const designData = await this.designEventData(dto);
    const slug = await this.uniqueSlug(dto.title);
    const event = await this.prisma.$transaction(async (transaction) => {
      const createdEvent = await transaction.event.create({
        data: {
          title: dto.title.trim(),
          type: dto.type,
          eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
          venue: dto.venue?.trim() || undefined,
          description: dto.description?.trim() || undefined,
          coverImage: dto.coverImage?.trim() || undefined,
          isPublished: dto.isPublished,
          designVersionId: designData.designVersionId,
          designFieldValues: designData.designFieldValues,
          draftDesignVersionId: designData.designVersionId,
          draftDesignFieldValues: designData.designFieldValues,
          draftSavedAt: designData.designVersionId ? new Date() : undefined,
          userId,
          slug,
        },
      });

      if (designData.designVersionId && designData.designId) {
        await transaction.userDesignUsage.upsert({
          where: {
            userId_designId: {
              userId,
              designId: designData.designId,
            },
          },
          create: {
            userId,
            designId: designData.designId,
            lastUsedVersionId: designData.designVersionId,
          },
          update: {
            lastUsedVersionId: designData.designVersionId,
            lastUsedAt: new Date(),
            usageCount: { increment: 1 },
          },
        });
      }

      return createdEvent;
    });

    if (designData.designVersionId) {
      await this.prisma.eventDesignRevision.create({
        data: {
          eventId: event.id,
          designVersionId: designData.designVersionId,
          fieldValues: designData.designFieldValues ?? {},
          label: "Initial invitation",
        },
      });
    }

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

  async createGuestRecords(
    userId: string,
    eventId: string,
    dto: CreateGuestRecordsDto,
    context: ActorContext,
  ) {
    const event = await this.assertOwner(userId, eventId);
    const existing = new Set(
      (
        await this.prisma.invitationInvitee.findMany({
          where: { eventId },
          select: { name: true },
        })
      ).map((item) => item.name.toLowerCase()),
    );
    const created: InvitationInvitee[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const record of dto.guests) {
      const name = record.name.trim().replace(/\s+/g, " ");
      if (!name || existing.has(name.toLowerCase())) {
        skipped.push({ name: name || "Empty row", reason: "Duplicate or empty" });
        continue;
      }
      const invitee = await this.prisma.invitationInvitee.create({
        data: {
          eventId,
          name,
          email: record.email?.trim().toLowerCase() || null,
          phone: record.phone?.trim() || null,
          groupName: record.groupName?.trim() || null,
          mealPreference: record.mealPreference?.trim() || null,
          slug: await this.uniqueInviteeSlug(event.slug, name),
        },
      });
      existing.add(name.toLowerCase());
      created.push(invitee);
    }
    await this.activity(
      eventId,
      "GUESTS_IMPORTED",
      `${created.length} guest records imported`,
      undefined,
      { skipped: skipped.length },
    );
    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "eventInvitees.imported",
        entityType: "Event",
        entityId: eventId,
        metadata: { created: created.length, skipped: skipped.length },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "guest import audit",
    );
    return { created, skipped };
  }

  async updateInvitee(
    userId: string,
    eventId: string,
    inviteeId: string,
    dto: UpdateInviteeDto,
    context: ActorContext,
  ) {
    await this.assertOwner(userId, eventId);
    const invitee = await this.prisma.invitationInvitee.findFirst({
      where: { id: inviteeId, eventId },
    });
    if (!invitee) throw new NotFoundException("Invitee not found.");
    const updated = await this.prisma.invitationInvitee.update({
      where: { id: inviteeId },
      data: {
        name: dto.name?.trim(),
        email: dto.email !== undefined ? dto.email.trim().toLowerCase() || null : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
        groupName:
          dto.groupName !== undefined ? dto.groupName.trim() || null : undefined,
        organizerNotes:
          dto.organizerNotes !== undefined
            ? dto.organizerNotes.trim() || null
            : undefined,
        rsvpStatus: dto.rsvpStatus,
        partySize:
          dto.rsvpStatus === RsvpStatus.DECLINED
            ? null
            : dto.partySize,
        mealPreference:
          dto.mealPreference !== undefined
            ? dto.mealPreference.trim() || null
            : undefined,
        rsvpMessage:
          dto.rsvpMessage !== undefined
            ? dto.rsvpMessage.trim() || null
            : undefined,
        respondedAt: dto.rsvpStatus ? new Date() : undefined,
        linkExpiresAt:
          dto.linkExpiresAt !== undefined
            ? dto.linkExpiresAt
              ? new Date(dto.linkExpiresAt)
              : null
            : undefined,
      },
    });
    await this.activity(
      eventId,
      "GUEST_UPDATED",
      `${updated.name}'s guest details were updated`,
      inviteeId,
      { rsvpStatus: updated.rsvpStatus },
    );
    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "eventInvitee.updated",
        entityType: "InvitationInvitee",
        entityId: inviteeId,
        metadata: { eventId, name: updated.name },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "guest update audit",
    );
    return updated;
  }

  async setInviteeLink(
    userId: string,
    eventId: string,
    inviteeId: string,
    disabled: boolean,
  ) {
    await this.assertOwner(userId, eventId);
    const invitee = await this.prisma.invitationInvitee.findFirst({
      where: { id: inviteeId, eventId },
    });
    if (!invitee) throw new NotFoundException("Invitee not found.");
    const updated = await this.prisma.invitationInvitee.update({
      where: { id: inviteeId },
      data: { linkDisabledAt: disabled ? new Date() : null },
    });
    await this.activity(
      eventId,
      disabled ? "LINK_DISABLED" : "LINK_ENABLED",
      `${invitee.name}'s link was ${disabled ? "disabled" : "enabled"}`,
      inviteeId,
    );
    return updated;
  }

  async logShare(
    userId: string,
    eventId: string,
    inviteeId: string | undefined,
    channel: string,
  ) {
    await this.assertOwner(userId, eventId);
    const invitee = inviteeId
      ? await this.prisma.invitationInvitee.findFirst({
          where: { id: inviteeId, eventId },
        })
      : null;
    if (inviteeId && !invitee) throw new NotFoundException("Invitee not found.");
    if (invitee) {
      await this.prisma.invitationInvitee.update({
        where: { id: invitee.id },
        data: { lastSharedAt: new Date(), lastShareChannel: channel },
      });
    }
    await this.activity(
      eventId,
      "INVITATION_SHARED",
      `${invitee?.name ?? "Main invitation"} shared via ${channel.toLowerCase()}`,
      invitee?.id,
      { channel },
    );
    return { success: true };
  }

  async listActivity(userId: string, eventId: string) {
    await this.assertOwner(userId, eventId);
    return this.prisma.eventActivity.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { invitee: { select: { id: true, name: true } } },
    });
  }

  async listDesignRevisions(userId: string, eventId: string) {
    await this.assertOwner(userId, eventId);
    return this.prisma.eventDesignRevision.findMany({
      where: { eventId },
      orderBy: { createdAt: "desc" },
      include: {
        designVersion: {
          select: {
            id: true,
            versionNumber: true,
            design: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async saveDesignDraft(
    userId: string,
    eventId: string,
    dto: SaveEventDesignDraftDto,
  ) {
    await this.assertOwner(userId, eventId);
    const designData = await this.designEventData(dto);
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        draftDesignVersionId: designData.designVersionId,
        draftDesignFieldValues: designData.designFieldValues,
        draftSavedAt: new Date(),
      },
    });
  }

  async publishDesignDraft(userId: string, eventId: string) {
    const event = await this.assertOwner(userId, eventId);
    if (!event.draftDesignVersionId) {
      throw new BadRequestException("Save a design draft before publishing.");
    }
    const fieldValues =
      (event.draftDesignFieldValues as Prisma.InputJsonValue | null) ?? {};
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        designVersionId: event.draftDesignVersionId,
        designFieldValues: fieldValues,
        isPublished: true,
      },
    });
    await this.prisma.eventDesignRevision.create({
      data: {
        eventId,
        designVersionId: event.draftDesignVersionId,
        fieldValues,
        label: `Published ${new Date().toLocaleDateString("en")}`,
      },
    });
    await this.activity(
      eventId,
      "DESIGN_PUBLISHED",
      "A new invitation design revision was published",
    );
    return updated;
  }

  async restoreDesignRevision(
    userId: string,
    eventId: string,
    revisionId: string,
  ) {
    await this.assertOwner(userId, eventId);
    const revision = await this.prisma.eventDesignRevision.findFirst({
      where: { id: revisionId, eventId },
    });
    if (!revision) throw new NotFoundException("Design revision not found.");
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        draftDesignVersionId: revision.designVersionId,
        draftDesignFieldValues: revision.fieldValues as Prisma.InputJsonValue,
        draftSavedAt: new Date(),
      },
    });
  }

  async update(
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
    context: ActorContext,
  ) {
    const existing = await this.assertOwner(userId, eventId);
    const designData = await this.designEventData(dto);
    const event = await this.prisma.$transaction(async (transaction) => {
      const updatedEvent = await transaction.event.update({
        where: { id: eventId },
        data: {
          ...this.eventData(dto),
          designVersionId: designData.designVersionId,
          designFieldValues: designData.designFieldValues,
        },
      });

      if (
        designData.designVersionId &&
        designData.designId &&
        designData.designId !== existing.designVersion?.designId
      ) {
        await transaction.userDesignUsage.upsert({
          where: {
            userId_designId: {
              userId,
              designId: designData.designId,
            },
          },
          create: {
            userId,
            designId: designData.designId,
            lastUsedVersionId: designData.designVersionId,
          },
          update: {
            lastUsedVersionId: designData.designVersionId,
            lastUsedAt: new Date(),
            usageCount: { increment: 1 },
          },
        });
      }

      return updatedEvent;
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

  async duplicate(userId: string, eventId: string, context: ActorContext) {
    const source = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      include: { invitees: { orderBy: { createdAt: "asc" } } },
    });
    if (!source) {
      throw new NotFoundException("Event not found.");
    }

    const title = `${source.title} Copy`;
    const slug = await this.uniqueSlug(title);
    const duplicate = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.event.create({
        data: {
          title,
          type: source.type,
          eventDate: source.eventDate,
          venue: source.venue,
          description: source.description,
          coverImage: source.coverImage,
          rsvpDeadline: source.rsvpDeadline,
          organizerNotes: source.organizerNotes,
          checklist: source.checklist as Prisma.InputJsonValue | undefined,
          slug,
          isPublished: false,
          designVersionId: source.designVersionId,
          designFieldValues:
            (source.designFieldValues as Prisma.InputJsonValue | null) ??
            undefined,
          draftDesignVersionId:
            source.draftDesignVersionId ?? source.designVersionId,
          draftDesignFieldValues:
            (source.draftDesignFieldValues as Prisma.InputJsonValue | null) ??
            (source.designFieldValues as Prisma.InputJsonValue | null) ??
            undefined,
          userId,
        },
      });

      if (source.designVersionId) {
        const version = await transaction.designVersion.findUnique({
          where: { id: source.designVersionId },
          select: { designId: true },
        });
        if (version) {
          await transaction.userDesignUsage.upsert({
            where: { userId_designId: { userId, designId: version.designId } },
            create: {
              userId,
              designId: version.designId,
              lastUsedVersionId: source.designVersionId,
            },
            update: {
              lastUsedVersionId: source.designVersionId,
              lastUsedAt: new Date(),
              usageCount: { increment: 1 },
            },
          });
        }
      }

      return created;
    });

    for (const invitee of source.invitees) {
      await this.prisma.invitationInvitee.create({
        data: {
          eventId: duplicate.id,
          name: invitee.name,
          email: invitee.email,
          phone: invitee.phone,
          groupName: invitee.groupName,
          organizerNotes: invitee.organizerNotes,
          mealPreference: invitee.mealPreference,
          slug: await this.uniqueInviteeSlug(duplicate.slug, invitee.name),
        },
      });
    }

    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: "event.duplicated",
        entityType: "Event",
        entityId: duplicate.id,
        metadata: { sourceEventId: source.id, invitees: source.invitees.length },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "event duplicate audit",
    );

    return duplicate;
  }

  async setArchived(
    userId: string,
    eventId: string,
    archived: boolean,
    context: ActorContext,
  ) {
    const existing = await this.assertOwner(userId, eventId);
    const event = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        archivedAt: archived ? new Date() : null,
        isPublished: archived ? false : existing.isPublished,
      },
    });

    this.runAfterResponse(
      this.audit.record({
        actorId: context.actorId,
        action: archived ? "event.archived" : "event.restored",
        entityType: "Event",
        entityId: event.id,
        metadata: { title: event.title },
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
      "event archive audit",
    );
    return event;
  }

  async statistics(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      select: {
        openCount: true,
        invitees: {
          select: {
            openCount: true,
            rsvpStatus: true,
            partySize: true,
            mealPreference: true,
          },
        },
      },
    });
    if (!event) {
      throw new NotFoundException("Event not found.");
    }

    return {
      totalInvitees: event.invitees.length,
      invitationOpens: event.openCount,
      openedInvitees: event.invitees.filter((item) => item.openCount > 0).length,
      unopenedInvitees: event.invitees.filter((item) => item.openCount === 0).length,
      pending: event.invitees.filter(
        (item) => item.rsvpStatus === RsvpStatus.PENDING,
      ).length,
      attending: event.invitees.filter(
        (item) => item.rsvpStatus === RsvpStatus.ATTENDING,
      ).length,
      declined: event.invitees.filter(
        (item) => item.rsvpStatus === RsvpStatus.DECLINED,
      ).length,
      expectedGuests: event.invitees.reduce(
        (total, item) =>
          item.rsvpStatus === RsvpStatus.ATTENDING
            ? total + (item.partySize ?? 1)
            : total,
        0,
      ),
      responseRate: event.invitees.length
        ? Math.round(
            (event.invitees.filter(
              (item) => item.rsvpStatus !== RsvpStatus.PENDING,
            ).length /
              event.invitees.length) *
              100,
          )
        : 0,
      mealTotals: Object.entries(
        event.invitees.reduce<Record<string, number>>((totals, item) => {
          if (
            item.rsvpStatus === RsvpStatus.ATTENDING &&
            item.mealPreference
          ) {
            totals[item.mealPreference] =
              (totals[item.mealPreference] ?? 0) + (item.partySize ?? 1);
          }
          return totals;
        }, {}),
      ).map(([meal, count]) => ({ meal, count })),
    };
  }

  async listInvitees(userId: string, eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: { id: eventId, userId },
      select: {
        invitees: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!event) {
      throw new NotFoundException("Event not found.");
    }

    return event.invitees;
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
    await this.activity(
      eventId,
      "GUESTS_ADDED",
      `${created.length} personalized guest links created`,
      undefined,
      { skipped: skipped.length },
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

  async findPublished(
    slug: string,
    context?: { ipAddress?: string; userAgent?: string; track?: boolean },
  ) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        user: { select: { id: true, name: true } },
        designVersion: {
          include: { design: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    if (!event || !event.isPublished || event.archivedAt) {
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
      if (
        !invitee?.event.isPublished ||
        invitee.event.archivedAt ||
        invitee.linkDisabledAt ||
        (invitee.linkExpiresAt && invitee.linkExpiresAt < new Date())
      ) {
        throw new NotFoundException("Invitation not found.");
      }

      if (context?.track !== false) {
        const openedAt = new Date();
        await this.prisma.$transaction([
          this.prisma.event.update({
            where: { id: invitee.eventId },
            data: {
              openCount: { increment: 1 },
              firstOpenedAt: invitee.event.firstOpenedAt ?? openedAt,
              lastOpenedAt: openedAt,
            },
          }),
          this.prisma.invitationInvitee.update({
            where: { id: invitee.id },
            data: {
              openCount: { increment: 1 },
              firstOpenedAt: invitee.firstOpenedAt ?? openedAt,
              lastOpenedAt: openedAt,
            },
          }),
        ]);
        await this.activity(
          invitee.eventId,
          "INVITATION_OPENED",
          `${invitee.name} opened the invitation`,
          invitee.id,
        );
      }

      return {
        ...invitee.event,
        inviteeName: invitee.name,
        inviteeSlug: invitee.slug,
        rsvpStatus: invitee.rsvpStatus,
        partySize: invitee.partySize,
        mealPreference: invitee.mealPreference,
        rsvpMessage: invitee.rsvpMessage,
      };
    }

    if (context?.track !== false) {
      const openedAt = new Date();
      await this.prisma.event.update({
        where: { id: event.id },
        data: {
          openCount: { increment: 1 },
          firstOpenedAt: event.firstOpenedAt ?? openedAt,
          lastOpenedAt: openedAt,
        },
      });
    }
    return event;
  }

  async submitRsvp(slug: string, dto: SubmitRsvpDto) {
    const invitee = await this.prisma.invitationInvitee.findUnique({
      where: { slug },
      include: {
        event: {
          select: {
            isPublished: true,
            archivedAt: true,
            rsvpDeadline: true,
          },
        },
      },
    });
    if (
      !invitee?.event.isPublished ||
      invitee.event.archivedAt ||
      invitee.linkDisabledAt ||
      (invitee.linkExpiresAt && invitee.linkExpiresAt < new Date())
    ) {
      throw new NotFoundException("Personalized invitation not found.");
    }
    if (
      invitee.event.rsvpDeadline &&
      invitee.event.rsvpDeadline < new Date()
    ) {
      throw new BadRequestException("The RSVP deadline has passed.");
    }

    const updated = await this.prisma.invitationInvitee.update({
      where: { id: invitee.id },
      data: {
        rsvpStatus: dto.status,
        partySize:
          dto.status === RsvpStatus.ATTENDING ? (dto.partySize ?? 1) : null,
        mealPreference:
          dto.status === RsvpStatus.ATTENDING
            ? dto.mealPreference?.trim() || null
            : null,
        rsvpMessage: dto.message?.trim() || null,
        respondedAt: new Date(),
      },
    });
    await this.activity(
      invitee.eventId,
      "RSVP_UPDATED",
      `${invitee.name} responded ${dto.status.toLowerCase()}`,
      invitee.id,
      { partySize: updated.partySize, mealPreference: updated.mealPreference },
    );
    return updated;
  }

  private eventData(dto: CreateEventDto | UpdateEventDto) {
    return {
      title: dto.title?.trim(),
      type: dto.type,
      eventDate:
        dto.eventDate !== undefined
          ? dto.eventDate
            ? new Date(dto.eventDate)
            : null
          : undefined,
      venue:
        dto.venue !== undefined ? dto.venue.trim() || null : undefined,
      description:
        dto.description !== undefined
          ? dto.description.trim() || null
          : undefined,
      coverImage:
        dto.coverImage !== undefined
          ? dto.coverImage.trim() || null
          : undefined,
      isPublished: dto.isPublished,
      rsvpDeadline:
        "rsvpDeadline" in dto && dto.rsvpDeadline !== undefined
          ? dto.rsvpDeadline
            ? new Date(dto.rsvpDeadline)
            : null
          : undefined,
      organizerNotes:
        "organizerNotes" in dto && dto.organizerNotes !== undefined
          ? dto.organizerNotes.trim() || null
          : undefined,
      checklist:
        "checklist" in dto && dto.checklist !== undefined
          ? (dto.checklist as Prisma.InputJsonObject)
          : undefined,
    };
  }

  private async designEventData(
    dto: CreateEventDto | UpdateEventDto,
  ): Promise<{
    designVersionId?: string;
    designId?: string;
    designFieldValues?: Prisma.InputJsonObject;
  }> {
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
      designId: version.designId,
      designFieldValues: (dto.designFieldValues ?? {}) as Prisma.InputJsonObject,
    };
  }

  private async assertOwner(userId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: {
        designVersion: { select: { designId: true } },
      },
    });
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

  private activity(
    eventId: string,
    type: string,
    summary: string,
    inviteeId?: string,
    metadata?: Prisma.InputJsonObject,
  ) {
    return this.prisma.eventActivity.create({
      data: { eventId, inviteeId, type, summary, metadata },
    });
  }
}
