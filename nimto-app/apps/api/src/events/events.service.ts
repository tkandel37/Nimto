import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  DesignStatus,
  DesignVersionStatus,
  InvitationInvitee,
  Prisma,
  RsvpStatus,
} from "@prisma/client";
import crypto from "crypto";
import { AuditService } from "../audit/audit.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateInviteesDto } from "./dto/create-invitees.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { SubmitRsvpDto } from "./dto/submit-rsvp.dto";
import { CreateGuestRecordsDto } from "./dto/create-guest-records.dto";
import { UpdateInviteeDto } from "./dto/update-invitee.dto";
import { SaveEventDesignDraftDto } from "./dto/save-event-design-draft.dto";
import { catalogThumbnailHtml } from "../template-design/catalog-thumbnail";

type ActorContext = {
  actorId: string;
  ipAddress?: string;
  userAgent?: string;
};

type NormalizedRsvpField = {
  id: string;
  key: string;
  label: string;
  type:
    | "single_choice"
    | "multiple_choice"
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "email"
    | "phone";
  required: boolean;
  enabled: boolean;
  builtIn?: boolean;
  options?: string[];
  placeholder?: string | null;
};

type NormalizedRsvpConfig = {
  note: string;
  closedMessage: string;
  fields: NormalizedRsvpField[];
};

const publicEventSelect = {
  id: true,
  title: true,
  type: true,
  eventDate: true,
  venue: true,
  description: true,
  slug: true,
  coverImage: true,
  isPublished: true,
  archivedAt: true,
  firstOpenedAt: true,
  lastOpenedAt: true,
  rsvpDeadline: true,
  designFieldValues: true,
  featureSettings: true,
  rsvpConfig: true,
  user: { select: { name: true } },
  designVersion: {
    select: {
      rawHtml: true,
      featureConfig: true,
      design: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.EventSelect;

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

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
        featureSettings: true,
        draftFeatureSettings: true,
        rsvpConfig: true,
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
        featureSettings: true,
        draftFeatureSettings: true,
        rsvpConfig: true,
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
            featureConfig: true,
          },
        },
        draftDesignVersion: {
          select: {
            id: true,
            versionNumber: true,
            rawHtml: true,
            scanResult: true,
            featureConfig: true,
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
            thumbnailHtml: true,
          },
        },
      },
    });

    return history.map((item) => ({
      ...item,
      lastUsedVersion: {
        ...item.lastUsedVersion,
        thumbnailHtml:
          item.lastUsedVersion.thumbnailHtml ??
          catalogThumbnailHtml(item.design.slug),
      },
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
    if (dto.isPublished) {
      await this.assertPublishableInvitation({
        eventDate: dto.eventDate ? new Date(dto.eventDate) : null,
        venue: dto.venue,
        designVersionId: designData.designVersionId,
        designFieldValues: designData.designFieldValues,
      });
    }
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
          featureSettings: {},
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
        skipped.push({
          name: name || "Empty row",
          reason: "Duplicate or empty",
        });
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
        email:
          dto.email !== undefined
            ? dto.email.trim().toLowerCase() || null
            : undefined,
        phone: dto.phone !== undefined ? dto.phone.trim() || null : undefined,
        groupName:
          dto.groupName !== undefined
            ? dto.groupName.trim() || null
            : undefined,
        organizerNotes:
          dto.organizerNotes !== undefined
            ? dto.organizerNotes.trim() || null
            : undefined,
        rsvpStatus: dto.rsvpStatus,
        partySize:
          dto.rsvpStatus === RsvpStatus.DECLINED ? null : dto.partySize,
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
    if (inviteeId && !invitee)
      throw new NotFoundException("Invitee not found.");
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
    const event = await this.assertOwner(userId, eventId);
    const designData = await this.designEventData(dto, [
      event.designVersionId,
      event.draftDesignVersionId,
    ]);
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        draftDesignVersionId: designData.designVersionId,
        draftDesignFieldValues: designData.designFieldValues,
        draftFeatureSettings: designData.featureSettings,
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
    await this.assertPublishableInvitation({
      eventDate: event.eventDate,
      venue: event.venue,
      designVersionId: event.draftDesignVersionId,
      designFieldValues: fieldValues,
    });
    const updated = await this.prisma.event.update({
      where: { id: eventId },
      data: {
        designVersionId: event.draftDesignVersionId,
        designFieldValues: fieldValues,
        featureSettings:
          (event.draftFeatureSettings as Prisma.InputJsonObject | null) ??
          (event.featureSettings as Prisma.InputJsonObject | null) ??
          {},
        isPublished: true,
      },
    });
    await this.prisma.eventDesignRevision.create({
      data: {
        eventId,
        designVersionId: event.draftDesignVersionId,
        fieldValues,
        featureSettings:
          (event.draftFeatureSettings as Prisma.InputJsonObject | null) ??
          (event.featureSettings as Prisma.InputJsonObject | null) ??
          {},
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
    const event = await this.assertOwner(userId, eventId);
    const revision = await this.prisma.eventDesignRevision.findFirst({
      where: { id: revisionId, eventId },
    });
    if (!revision) throw new NotFoundException("Design revision not found.");
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        draftDesignVersionId: revision.designVersionId,
        draftDesignFieldValues: revision.fieldValues as Prisma.InputJsonValue,
        draftFeatureSettings:
          (revision.featureSettings as Prisma.InputJsonValue | null) ??
          (event.featureSettings as Prisma.InputJsonValue | null) ??
          {},
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
    const changesPublishedInvitation =
      dto.isPublished === true ||
      (existing.isPublished &&
        dto.isPublished !== false &&
        (dto.eventDate !== undefined ||
          dto.venue !== undefined ||
          dto.designVersionId !== undefined ||
          dto.designFieldValues !== undefined));
    if (changesPublishedInvitation) {
      await this.assertPublishableInvitation({
        eventDate:
          dto.eventDate !== undefined
            ? dto.eventDate
              ? new Date(dto.eventDate)
              : null
            : existing.eventDate,
        venue:
          dto.venue !== undefined ? dto.venue?.trim() || null : existing.venue,
        designVersionId: designData.designVersionId ?? existing.designVersionId,
        designFieldValues:
          designData.designFieldValues ?? existing.designFieldValues,
      });
    }
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
          featureSettings:
            (source.featureSettings as Prisma.InputJsonValue | null) ??
            undefined,
          draftFeatureSettings:
            (source.draftFeatureSettings as Prisma.InputJsonValue | null) ??
            (source.featureSettings as Prisma.InputJsonValue | null) ??
            undefined,
          rsvpConfig:
            (source.rsvpConfig as Prisma.InputJsonValue | null) ?? undefined,
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
          rsvpAnswers:
            (invitee.rsvpAnswers as Prisma.InputJsonValue | null) ?? undefined,
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
        metadata: {
          sourceEventId: source.id,
          invitees: source.invitees.length,
        },
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
            respondedAt: true,
          },
        },
        rsvpResponses: {
          select: {
            status: true,
            guestCount: true,
            answers: true,
            submittedAt: true,
          },
        },
      },
    });
    if (!event) {
      throw new NotFoundException("Event not found.");
    }

    return {
      totalInvitees: event.invitees.length,
      totalResponses:
        event.invitees.filter((item) => item.rsvpStatus !== RsvpStatus.PENDING)
          .length + event.rsvpResponses.length,
      invitationOpens: event.openCount,
      openedInvitees: event.invitees.filter((item) => item.openCount > 0)
        .length,
      unopenedInvitees: event.invitees.filter((item) => item.openCount === 0)
        .length,
      pending: event.invitees.filter(
        (item) => item.rsvpStatus === RsvpStatus.PENDING,
      ).length,
      attending:
        event.invitees.filter(
          (item) => item.rsvpStatus === RsvpStatus.ATTENDING,
        ).length +
        event.rsvpResponses.filter(
          (item) => item.status === RsvpStatus.ATTENDING,
        ).length,
      declined:
        event.invitees.filter((item) => item.rsvpStatus === RsvpStatus.DECLINED)
          .length +
        event.rsvpResponses.filter(
          (item) => item.status === RsvpStatus.DECLINED,
        ).length,
      expectedGuests:
        event.invitees.reduce(
          (total, item) =>
            item.rsvpStatus === RsvpStatus.ATTENDING
              ? total + (item.partySize ?? 1)
              : total,
          0,
        ) +
        event.rsvpResponses.reduce(
          (total, item) =>
            item.status === RsvpStatus.ATTENDING
              ? total + (item.guestCount ?? 1)
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
      publicResponses: event.rsvpResponses.length,
      lastResponseAt:
        [
          ...event.invitees
            .map((item) => item.respondedAt?.toISOString() ?? null)
            .filter((item): item is string => Boolean(item)),
          ...event.rsvpResponses.map((item) => item.submittedAt.toISOString()),
        ]
          .sort()
          .at(-1) ?? null,
      mealTotals: Object.entries(
        event.rsvpResponses.reduce<Record<string, number>>(
          (totals, item) => {
            const meal = this.answerText(item.answers, "meal_preference");
            if (item.status === RsvpStatus.ATTENDING && meal) {
              totals[meal] = (totals[meal] ?? 0) + (item.guestCount ?? 1);
            }
            return totals;
          },
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
        ),
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

  async listRsvpResponses(userId: string, eventId: string) {
    await this.assertOwner(userId, eventId);
    return this.prisma.eventRsvpResponse.findMany({
      where: { eventId },
      orderBy: { submittedAt: "desc" },
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
      select: publicEventSelect,
    });

    if (!event || !event.isPublished || event.archivedAt) {
      const invitee = await this.prisma.invitationInvitee.findUnique({
        where: { slug },
        include: {
          event: {
            select: publicEventSelect,
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

      const trackingCutoff = new Date(Date.now() - 60_000);
      if (
        context?.track !== false &&
        (!invitee.lastOpenedAt || invitee.lastOpenedAt < trackingCutoff)
      ) {
        const openedAt = new Date();
        const tracked = await this.prisma.$transaction(async (transaction) => {
          const inviteeUpdate = await transaction.invitationInvitee.updateMany({
            where: {
              id: invitee.id,
              OR: [
                { lastOpenedAt: null },
                { lastOpenedAt: { lt: trackingCutoff } },
              ],
            },
            data: {
              openCount: { increment: 1 },
              firstOpenedAt: invitee.firstOpenedAt ?? openedAt,
              lastOpenedAt: openedAt,
            },
          });
          if (!inviteeUpdate.count) return false;

          await transaction.event.update({
            where: { id: invitee.eventId },
            data: {
              openCount: { increment: 1 },
              firstOpenedAt: invitee.event.firstOpenedAt ?? openedAt,
              lastOpenedAt: openedAt,
            },
          });
          return true;
        });
        if (tracked && !invitee.firstOpenedAt) {
          await this.activity(
            invitee.eventId,
            "INVITATION_OPENED",
            `${invitee.name} opened the invitation`,
            invitee.id,
          );
        }
      }

      return {
        ...this.toPublicEvent(invitee.event),
        inviteeName: invitee.name,
        inviteeSlug: invitee.slug,
        rsvpStatus: invitee.rsvpStatus,
        partySize: invitee.partySize,
        mealPreference: invitee.mealPreference,
        rsvpMessage: invitee.rsvpMessage,
      };
    }

    const trackingCutoff = new Date(Date.now() - 60_000);
    if (
      context?.track !== false &&
      (!event.lastOpenedAt || event.lastOpenedAt < trackingCutoff)
    ) {
      const openedAt = new Date();
      await this.prisma.event.updateMany({
        where: {
          id: event.id,
          OR: [
            { lastOpenedAt: null },
            { lastOpenedAt: { lt: trackingCutoff } },
          ],
        },
        data: {
          openCount: { increment: 1 },
          firstOpenedAt: event.firstOpenedAt ?? openedAt,
          lastOpenedAt: openedAt,
        },
      });
    }
    return this.toPublicEvent(event);
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
            rsvpConfig: true,
          },
        },
      },
    });
    if (!invitee) {
      const event = await this.prisma.event.findUnique({
        where: { slug },
        select: {
          id: true,
          isPublished: true,
          archivedAt: true,
          rsvpDeadline: true,
          featureSettings: true,
          rsvpConfig: true,
        },
      });
      const featureSettings =
        (event?.featureSettings as { rsvp?: { enabled?: boolean } } | null) ??
        {};
      if (
        !event?.isPublished ||
        event.archivedAt ||
        featureSettings.rsvp?.enabled !== true
      ) {
        throw new NotFoundException("Invitation RSVP is not available.");
      }
      if (event.rsvpDeadline && event.rsvpDeadline < new Date()) {
        throw new BadRequestException("The RSVP deadline has passed.");
      }

      const config = this.normalizeRsvpConfig(event.rsvpConfig);
      const answers = this.normalizeSubmittedRsvpAnswers(
        dto,
        config,
        undefined,
      );
      this.validateRsvpSubmission(config, answers, true);
      const guestCountValue = Number(
        answers.number_of_guests ?? dto.partySize ?? 1,
      );
      const response = await this.prisma.eventRsvpResponse.create({
        data: {
          eventId: event.id,
          status: dto.status,
          guestCount:
            dto.status === RsvpStatus.ATTENDING
              ? Math.max(
                  1,
                  Math.min(
                    20,
                    Number.isFinite(guestCountValue) ? guestCountValue : 1,
                  ),
                )
              : null,
          answers: answers as Prisma.InputJsonObject,
        },
      });
      await this.activity(
        event.id,
        "RSVP_UPDATED",
        `Public RSVP marked ${dto.status.toLowerCase()}`,
        undefined,
        { responseId: response.id },
      );
      return response;
    }
    if (
      !invitee.event.isPublished ||
      invitee.event.archivedAt ||
      invitee.linkDisabledAt ||
      (invitee.linkExpiresAt && invitee.linkExpiresAt < new Date())
    ) {
      throw new NotFoundException("Personalized invitation not found.");
    }
    if (invitee.event.rsvpDeadline && invitee.event.rsvpDeadline < new Date()) {
      throw new BadRequestException("The RSVP deadline has passed.");
    }

    const config = this.normalizeRsvpConfig(invitee.event.rsvpConfig);
    const answers = this.normalizeSubmittedRsvpAnswers(
      dto,
      config,
      invitee.name,
    );
    this.validateRsvpSubmission(config, answers, false);

    const updated = await this.prisma.invitationInvitee.update({
      where: { id: invitee.id },
      data: {
        rsvpStatus: dto.status,
        partySize:
          dto.status === RsvpStatus.ATTENDING
            ? (this.answerNumber(answers, "number_of_guests") ??
              dto.partySize ??
              1)
            : null,
        mealPreference:
          dto.status === RsvpStatus.ATTENDING
            ? (this.answerText(answers, "meal_preference") ??
              dto.mealPreference?.trim() ??
              null)
            : null,
        rsvpMessage:
          this.answerText(answers, "message") ?? dto.message?.trim() ?? null,
        email:
          this.answerText(answers, "email_address") ?? invitee.email ?? null,
        phone:
          this.answerText(answers, "phone_number") ?? invitee.phone ?? null,
        rsvpAnswers: answers as Prisma.InputJsonObject,
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

  private toPublicEvent<
    T extends {
      id: string;
      isPublished: boolean;
      archivedAt: Date | null;
      firstOpenedAt: Date | null;
      lastOpenedAt: Date | null;
    },
  >(event: T) {
    const {
      id: _id,
      isPublished: _isPublished,
      archivedAt: _archivedAt,
      firstOpenedAt: _firstOpenedAt,
      lastOpenedAt: _lastOpenedAt,
      ...safeEvent
    } = event;
    return safeEvent;
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
      venue: dto.venue !== undefined ? dto.venue?.trim() || null : undefined,
      description:
        dto.description !== undefined
          ? dto.description?.trim() || null
          : undefined,
      coverImage:
        dto.coverImage !== undefined
          ? dto.coverImage?.trim() || null
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
          ? dto.organizerNotes?.trim() || null
          : undefined,
      checklist:
        "checklist" in dto && dto.checklist !== undefined
          ? (dto.checklist as Prisma.InputJsonObject)
          : undefined,
      rsvpConfig:
        "rsvpConfig" in dto && dto.rsvpConfig !== undefined
          ? (this.normalizeRsvpConfig(dto.rsvpConfig) as Prisma.InputJsonObject)
          : undefined,
    };
  }

  private normalizeRsvpConfig(
    config?: Record<string, unknown> | Prisma.JsonValue | null,
  ): NormalizedRsvpConfig {
    const source =
      config && typeof config === "object" && !Array.isArray(config)
        ? (config as Record<string, unknown>)
        : {};
    const providedFields = Array.isArray(source.fields)
      ? source.fields.slice(0, 50)
      : [];
    const defaults: NormalizedRsvpField[] = [
      {
        id: "attendance_status",
        key: "attendance_status",
        label: "Will you attend?",
        type: "single_choice",
        required: true,
        enabled: true,
        builtIn: true,
        options: ["Attending", "Cannot attend"],
      },
      {
        id: "full_name",
        key: "full_name",
        label: "Full name",
        type: "text",
        required: true,
        enabled: true,
        builtIn: true,
      },
      {
        id: "phone_number",
        key: "phone_number",
        label: "Phone number",
        type: "phone",
        required: false,
        enabled: true,
        builtIn: true,
      },
      {
        id: "email_address",
        key: "email_address",
        label: "Email address",
        type: "email",
        required: false,
        enabled: true,
        builtIn: true,
      },
      {
        id: "number_of_guests",
        key: "number_of_guests",
        label: "How many people are coming?",
        type: "number",
        required: false,
        enabled: true,
        builtIn: true,
      },
      {
        id: "meal_preference",
        key: "meal_preference",
        label: "Meal preference",
        type: "text",
        required: false,
        enabled: false,
        builtIn: true,
      },
      {
        id: "message",
        key: "message",
        label: "Message",
        type: "textarea",
        required: false,
        enabled: false,
        builtIn: true,
      },
    ];

    const merged = defaults.map((field) => {
      const provided = providedFields.find(
        (item) =>
          item &&
          typeof item === "object" &&
          (item as Record<string, unknown>).key === field.key,
      ) as Record<string, unknown> | undefined;
      const type = this.normalizeRsvpFieldType(provided?.type ?? field.type);
      return {
        ...field,
        label:
          typeof provided?.label === "string" && provided.label.trim()
            ? provided.label.trim().slice(0, 120)
            : field.label,
        required:
          typeof provided?.required === "boolean"
            ? provided.required
            : field.required,
        enabled:
          typeof provided?.enabled === "boolean"
            ? provided.enabled
            : field.enabled,
        type,
        options:
          type === "single_choice" || type === "multiple_choice"
            ? this.normalizeChoiceOptions(
                provided?.options,
                field.options?.length ? field.options : ["Option 1"],
              )
            : undefined,
      };
    });

    const custom = providedFields.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const field = item as Record<string, unknown>;
      if (
        typeof field.key !== "string" ||
        defaults.some((base) => base.key === field.key)
      ) {
        return [];
      }
      const key = this.slugify(field.key).replace(/-/g, "_");
      if (!key) return [];
      const type = this.normalizeRsvpFieldType(field.type);
      return [
        {
          id:
            typeof field.id === "string" && field.id.trim()
              ? field.id
              : `custom_${index + 1}_${key}`,
          key,
          label:
            typeof field.label === "string" && field.label.trim()
              ? field.label.trim().slice(0, 120)
              : this.labelizeRsvpKey(key),
          type,
          required: Boolean(field.required),
          enabled: field.enabled !== false,
          builtIn: false,
          options:
            type === "single_choice" || type === "multiple_choice"
              ? this.normalizeChoiceOptions(field.options, ["Option 1"])
              : undefined,
          placeholder:
            typeof field.placeholder === "string"
              ? field.placeholder.slice(0, 180)
              : null,
        } satisfies NormalizedRsvpField,
      ];
    });

    const fields = [...merged, ...custom];
    const providedOrder = new Map(
      providedFields.flatMap((item, index) => {
        if (!item || typeof item !== "object") return [];
        const key = (item as Record<string, unknown>).key;
        return typeof key === "string" ? [[key, index] as const] : [];
      }),
    );
    const fallbackOrder = new Map(
      fields.map((field, index) => [field.key, providedFields.length + index]),
    );
    fields.sort(
      (left, right) =>
        (providedOrder.get(left.key) ?? fallbackOrder.get(left.key) ?? 0) -
        (providedOrder.get(right.key) ?? fallbackOrder.get(right.key) ?? 0),
    );

    return {
      note: typeof source.note === "string" ? source.note.slice(0, 800) : "",
      closedMessage:
        typeof source.closedMessage === "string" && source.closedMessage.trim()
          ? source.closedMessage.slice(0, 800)
          : "Sorry, RSVP is closed for this event.",
      fields,
    };
  }

  private normalizeRsvpFieldType(value: unknown): NormalizedRsvpField["type"] {
    switch (value) {
      case "single_choice":
      case "multiple_choice":
      case "textarea":
      case "number":
      case "date":
      case "email":
      case "phone":
        return value;
      default:
        return "text";
    }
  }

  private normalizeChoiceOptions(value: unknown, fallback: string[] = []) {
    const options = Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim().slice(0, 120))
          .filter(Boolean)
          .slice(0, 30)
      : [];
    return options.length ? options : fallback;
  }

  private labelizeRsvpKey(value: string) {
    return value
      .replace(/_/g, " ")
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  private normalizeSubmittedRsvpAnswers(
    dto: SubmitRsvpDto,
    config: NormalizedRsvpConfig,
    inviteeName?: string,
  ) {
    const rawAnswers =
      dto.answers && typeof dto.answers === "object" ? dto.answers : {};
    const answers: Record<string, string | number | string[]> = {
      attendance_status:
        dto.status === RsvpStatus.ATTENDING ? "Attending" : "Cannot attend",
    };

    for (const field of config.fields) {
      if (!field.enabled || field.key === "attendance_status") continue;
      const rawValue = rawAnswers[field.key];
      if (field.key === "full_name" && inviteeName) {
        answers[field.key] = inviteeName;
        continue;
      }
      if (field.type === "number") {
        const value =
          typeof rawValue === "number"
            ? rawValue
            : Number(String(rawValue ?? "").trim() || "0");
        if (Number.isFinite(value) && value > 0) {
          answers[field.key] = Math.min(
            value,
            field.key === "number_of_guests" ? 20 : 1_000_000,
          );
        }
        continue;
      }
      if (field.type === "multiple_choice") {
        const values = Array.isArray(rawValue)
          ? rawValue
              .map((value) => String(value).trim())
              .filter((value) => field.options?.includes(value))
              .slice(0, 20)
          : [];
        if (values.length) answers[field.key] = values;
        continue;
      }
      const text = String(rawValue ?? "")
        .trim()
        .slice(0, 800);
      if (text) answers[field.key] = text;
    }

    if (!answers.number_of_guests && dto.partySize) {
      answers.number_of_guests = dto.partySize;
    }
    if (!answers.meal_preference && dto.mealPreference?.trim()) {
      answers.meal_preference = dto.mealPreference.trim();
    }
    if (!answers.message && dto.message?.trim()) {
      answers.message = dto.message.trim();
    }

    return answers;
  }

  private validateRsvpSubmission(
    config: NormalizedRsvpConfig,
    answers: Record<string, string | number | string[]>,
    requireName: boolean,
  ) {
    const attending =
      String(answers.attendance_status ?? "").toLowerCase() === "attending";
    for (const field of config.fields) {
      if (!field.enabled) continue;
      if (
        !attending &&
        ["number_of_guests", "meal_preference"].includes(field.key)
      ) {
        continue;
      }
      if (
        requireName &&
        field.key === "full_name" &&
        field.required &&
        !String(answers.full_name ?? "").trim()
      ) {
        throw new BadRequestException(`${field.label} is required.`);
      }
      if (
        field.required &&
        field.key !== "full_name" &&
        field.key !== "number_of_guests" &&
        (Array.isArray(answers[field.key])
          ? (answers[field.key] as string[]).length === 0
          : !String(answers[field.key] ?? "").trim())
      ) {
        throw new BadRequestException(`${field.label} is required.`);
      }
      if (
        field.key === "number_of_guests" &&
        field.required &&
        !this.answerNumber(answers, "number_of_guests")
      ) {
        throw new BadRequestException(`${field.label} is required.`);
      }
      if (field.type === "single_choice" && field.options?.length) {
        const value = this.answerText(answers, field.key);
        if (value && !field.options.includes(value)) {
          throw new BadRequestException(
            `${field.label} has an invalid option.`,
          );
        }
      }
      if (field.type === "multiple_choice" && field.options?.length) {
        const values = Array.isArray(answers[field.key])
          ? (answers[field.key] as string[])
          : [];
        if (values.some((value) => !field.options?.includes(value))) {
          throw new BadRequestException(
            `${field.label} has an invalid option.`,
          );
        }
      }
    }
  }

  private answerText(
    answers: Prisma.JsonValue | Record<string, unknown>,
    key: string,
  ) {
    const value =
      answers && typeof answers === "object" && !Array.isArray(answers)
        ? (answers as Record<string, unknown>)[key]
        : undefined;
    return typeof value === "string" && value.trim() ? value.trim() : null;
  }

  private answerNumber(
    answers: Record<string, string | number> | Prisma.JsonValue,
    key: string,
  ) {
    const value =
      answers && typeof answers === "object" && !Array.isArray(answers)
        ? (answers as Record<string, unknown>)[key]
        : undefined;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return null;
  }

  private async designEventData(
    dto: CreateEventDto | UpdateEventDto | SaveEventDesignDraftDto,
    allowedExistingVersionIds: (string | null | undefined)[] = [],
  ): Promise<{
    designVersionId?: string;
    designId?: string;
    designFieldValues?: Prisma.InputJsonObject;
    featureSettings?: Prisma.InputJsonObject;
  }> {
    if (!dto.designVersionId && dto.designFieldValues === undefined) {
      return {};
    }
    if (!dto.designVersionId) {
      throw new BadRequestException(
        "Design version is required for design fields.",
      );
    }

    const version = await this.prisma.designVersion.findUnique({
      where: { id: dto.designVersionId },
      include: { design: true },
    });
    if (!version) {
      throw new BadRequestException("Select a valid design version.");
    }
    const isCurrentActive =
      version.status === DesignVersionStatus.CURRENT &&
      version.design.status === DesignStatus.ACTIVE;
    const isAttachedVersion = allowedExistingVersionIds.some(
      (versionId) => versionId === version.id,
    );
    if (!isCurrentActive && !isAttachedVersion) {
      throw new BadRequestException("Select a current active design version.");
    }

    return {
      designVersionId: version.id,
      designId: version.designId,
      designFieldValues: this.normalizeDesignFieldValues(
        version.scanResult,
        dto.designFieldValues ?? {},
      ),
      featureSettings:
        "featureSettings" in dto && dto.featureSettings !== undefined
          ? this.normalizeFeatureSettings(
              version.featureConfig,
              version.scanResult,
              dto.featureSettings,
            )
          : undefined,
    };
  }

  private normalizeFeatureSettings(
    featureConfigValue: Prisma.JsonValue,
    scanResultValue: Prisma.JsonValue,
    input: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    const featureConfig = this.jsonRecord(featureConfigValue);
    const scanResult = this.jsonRecord(scanResultValue);
    const available = (key: string) =>
      this.jsonRecord(featureConfig[key]).available === true;
    const toggle = (key: string) => ({
      enabled: available(key) && this.jsonRecord(input[key]).enabled === true,
    });
    const result: Record<string, Prisma.InputJsonValue> = {
      countdown: toggle("countdown"),
      rsvp: toggle("rsvp"),
      openingAnimation: toggle("openingAnimation"),
    };

    const music = this.jsonRecord(input.music);
    const musicUrl = this.boundedString(music.url, "Music URL", 2_048);
    if (musicUrl && !this.allowedUrl(musicUrl, ["https:"])) {
      throw new BadRequestException("Music URL must use HTTPS.");
    }
    result.music = {
      enabled: available("music") && music.enabled === true,
      url: available("music") ? musicUrl : "",
    };

    const additionalInfo = this.jsonRecord(input.additionalInfo);
    result.additionalInfo = {
      enabled: available("additionalInfo") && additionalInfo.enabled === true,
      text: available("additionalInfo")
        ? this.boundedString(
            additionalInfo.text,
            "Additional information",
            1_200,
          )
        : "",
    };

    const linkableKeys = new Set(
      (Array.isArray(scanResult.linkableFieldKeys)
        ? scanResult.linkableFieldKeys
        : []
      ).filter((key): key is string => typeof key === "string"),
    );
    const links =
      available("links") && Array.isArray(input.links) ? input.links : [];
    if (links.length > 50) {
      throw new BadRequestException("Too many invitation field links.");
    }
    const usedLinkKeys = new Set<string>();
    result.links = links.map((item) => {
      const link = this.jsonRecord(item);
      const fieldKey = this.boundedString(link.fieldKey, "Linked field", 120);
      const url = this.boundedString(link.url, "Field link URL", 2_048);
      if (!linkableKeys.has(fieldKey)) {
        throw new BadRequestException(
          `The invitation field "${fieldKey}" cannot be linked.`,
        );
      }
      if (usedLinkKeys.has(fieldKey)) {
        throw new BadRequestException(
          `The invitation field "${fieldKey}" has more than one link.`,
        );
      }
      if (url && !this.allowedUrl(url, ["https:", "mailto:", "tel:"])) {
        throw new BadRequestException(
          "Field links must use HTTPS, mailto, or tel.",
        );
      }
      usedLinkKeys.add(fieldKey);
      return {
        fieldKey,
        url,
        hoverText:
          this.boundedString(link.hoverText, "Link hover text", 120) ||
          "Follow link",
      };
    });

    const styleSlots = Array.isArray(scanResult.styleSlots)
      ? scanResult.styleSlots
      : [];
    const styleKeys = new Set(
      styleSlots
        .map((slot) => this.jsonRecord(slot).key)
        .filter((key): key is string => typeof key === "string"),
    );
    const themeInput = this.jsonRecord(input.theme);
    const theme: Record<string, Prisma.InputJsonValue> = {};
    if (available("theme")) {
      for (const [key, rawValue] of Object.entries(themeInput)) {
        if (!styleKeys.has(key)) {
          throw new BadRequestException(`The theme value "${key}" is invalid.`);
        }
        const value = this.boundedString(rawValue, "Theme value", 160);
        if (/[;{}<>]|url\s*\(|@import/i.test(value)) {
          throw new BadRequestException("Theme values contain unsafe CSS.");
        }
        theme[key] = value;
      }
    }
    result.theme = theme;

    const sharePreview = this.jsonRecord(input.sharePreview);
    const imageUrl = this.boundedString(
      sharePreview.imageUrl,
      "Share preview image URL",
      2_048,
    );
    if (imageUrl && !this.allowedUrl(imageUrl, ["https:"])) {
      throw new BadRequestException("Share preview image URL must use HTTPS.");
    }
    result.sharePreview = available("sharePreview")
      ? {
          title: this.boundedString(
            sharePreview.title,
            "Share preview title",
            120,
          ),
          description: this.boundedString(
            sharePreview.description,
            "Share preview description",
            240,
          ),
          imageUrl,
        }
      : { title: "", description: "", imageUrl: "" };

    return result as Prisma.InputJsonObject;
  }

  private jsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private boundedString(value: unknown, label: string, maxLength: number) {
    if (value === undefined || value === null) return "";
    if (typeof value !== "string") {
      throw new BadRequestException(`${label} must be text.`);
    }
    const normalized = value.trim();
    if (normalized.length > maxLength) {
      throw new BadRequestException(
        `${label} must be ${maxLength} characters or fewer.`,
      );
    }
    return normalized;
  }

  private allowedUrl(value: string, protocols: string[]) {
    if (!value) return false;
    try {
      return protocols.includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }

  private normalizeDesignFieldValues(
    scanResult: Prisma.JsonValue,
    input: Record<string, unknown>,
  ) {
    const fields =
      scanResult && typeof scanResult === "object" && !Array.isArray(scanResult)
        ? (scanResult as { fields?: unknown }).fields
        : undefined;
    const editableKeys = new Set(
      (Array.isArray(fields) ? fields : [])
        .filter(
          (field): field is Record<string, unknown> =>
            Boolean(field) &&
            typeof field === "object" &&
            !Array.isArray(field),
        )
        .filter(
          (field) =>
            field.editableByUser !== false &&
            field.locked !== true &&
            field.paid !== true,
        )
        .map((field) => field.key)
        .filter(
          (key): key is string => typeof key === "string" && Boolean(key),
        ),
    );
    const normalized: Record<string, Prisma.InputJsonValue> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!editableKeys.has(key)) {
        throw new BadRequestException(
          `The invitation field "${key}" cannot be edited.`,
        );
      }
      if (
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        throw new BadRequestException(
          `The invitation field "${key}" has an invalid value.`,
        );
      }
      if (typeof value === "string" && value.length > 4_000) {
        throw new BadRequestException(
          `The invitation field "${key}" is too long.`,
        );
      }
      if (typeof value === "number" && !Number.isFinite(value)) {
        throw new BadRequestException(
          `The invitation field "${key}" has an invalid number.`,
        );
      }
      normalized[key] = value;
    }
    return normalized as Prisma.InputJsonObject;
  }

  private async assertPublishableInvitation({
    eventDate,
    venue,
    designVersionId,
    designFieldValues,
  }: {
    eventDate: Date | null | undefined;
    venue: string | null | undefined;
    designVersionId: string | null | undefined;
    designFieldValues: unknown;
  }) {
    if (!eventDate || !venue?.trim()) {
      throw new BadRequestException(
        "Add the event date and venue before publishing.",
      );
    }
    if (!designVersionId) {
      throw new BadRequestException(
        "Select an invitation design before publishing.",
      );
    }
    const version = await this.prisma.designVersion.findUnique({
      where: { id: designVersionId },
      select: { scanResult: true },
    });
    if (!version) {
      throw new BadRequestException("Select a valid invitation design.");
    }
    const scanResult = this.jsonRecord(version.scanResult);
    const values = this.jsonRecord(designFieldValues);
    const missing = (Array.isArray(scanResult.fields) ? scanResult.fields : [])
      .map((field) => this.jsonRecord(field))
      .filter(
        (field) =>
          field.required === true &&
          field.editableByUser !== false &&
          field.locked !== true &&
          field.paid !== true,
      )
      .filter((field) => {
        const key = typeof field.key === "string" ? field.key : "";
        const value = values[key];
        const defaultValue = field.defaultValue;
        return (
          !String(value ?? "").trim() && !String(defaultValue ?? "").trim()
        );
      })
      .map((field) =>
        typeof field.label === "string"
          ? field.label
          : String(field.key ?? "Invitation field"),
      );
    if (missing.length) {
      throw new BadRequestException(
        `Complete the required invitation fields: ${missing.join(", ")}.`,
      );
    }
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

  private async uniqueInviteeSlug(_eventSlug: string, _name: string) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = `invite-${crypto.randomBytes(24).toString("base64url")}`;
      if (!(await this.slugExists(candidate))) {
        return candidate;
      }
    }

    throw new Error("Could not generate a unique invitation link.");
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
    void work.catch(() => {
      this.logger.error(`Failed to complete ${label}.`);
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
