import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthenticatedRequest, JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateInviteesDto } from "./dto/create-invitees.dto";
import { SubmitRsvpDto } from "./dto/submit-rsvp.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { EventsService } from "./events.service";
import { CreateGuestRecordsDto } from "./dto/create-guest-records.dto";
import { UpdateInviteeDto } from "./dto/update-invitee.dto";
import { SaveEventDesignDraftDto } from "./dto/save-event-design-draft.dto";
import { LogShareDto } from "./dto/log-share.dto";

@Controller("events")
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get("public/:slug")
  findPublished(
    @Param("slug") slug: string,
    @Query("track") track: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.findPublished(slug, {
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      track: track !== "false",
    });
  }

  @Post("public/:slug/rsvp")
  submitRsvp(
    @Param("slug") slug: string,
    @Body() dto: SubmitRsvpDto,
  ) {
    return this.eventsService.submitRsvp(slug, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  listMine(@Req() request: AuthenticatedRequest) {
    return this.eventsService.listForUser(request.user!.sub);
  }

  @Get("design-history")
  @UseGuards(JwtAuthGuard)
  listDesignHistory(@Req() request: AuthenticatedRequest) {
    return this.eventsService.listDesignHistory(request.user!.sub);
  }

  @Get(":eventId")
  @UseGuards(JwtAuthGuard)
  findMine(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.findForUser(request.user!.sub, eventId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreateEventDto, @Req() request: AuthenticatedRequest) {
    return this.eventsService.create(
      request.user!.sub,
      dto,
      this.context(request),
    );
  }

  @Post(":eventId/duplicate")
  @UseGuards(JwtAuthGuard)
  duplicate(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.duplicate(
      request.user!.sub,
      eventId,
      this.context(request),
    );
  }

  @Post(":eventId/archive")
  @UseGuards(JwtAuthGuard)
  archive(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.setArchived(
      request.user!.sub,
      eventId,
      true,
      this.context(request),
    );
  }

  @Post(":eventId/restore")
  @UseGuards(JwtAuthGuard)
  restore(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.setArchived(
      request.user!.sub,
      eventId,
      false,
      this.context(request),
    );
  }

  @Get(":eventId/statistics")
  @UseGuards(JwtAuthGuard)
  statistics(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.statistics(request.user!.sub, eventId);
  }

  @Get(":eventId/activity")
  @UseGuards(JwtAuthGuard)
  activity(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.listActivity(request.user!.sub, eventId);
  }

  @Get(":eventId/design-revisions")
  @UseGuards(JwtAuthGuard)
  designRevisions(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.listDesignRevisions(request.user!.sub, eventId);
  }

  @Patch(":eventId/design-draft")
  @UseGuards(JwtAuthGuard)
  saveDesignDraft(
    @Param("eventId") eventId: string,
    @Body() dto: SaveEventDesignDraftDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.saveDesignDraft(request.user!.sub, eventId, dto);
  }

  @Post(":eventId/design-draft/publish")
  @UseGuards(JwtAuthGuard)
  publishDesignDraft(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.publishDesignDraft(request.user!.sub, eventId);
  }

  @Post(":eventId/design-revisions/:revisionId/restore")
  @UseGuards(JwtAuthGuard)
  restoreDesignRevision(
    @Param("eventId") eventId: string,
    @Param("revisionId") revisionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.restoreDesignRevision(
      request.user!.sub,
      eventId,
      revisionId,
    );
  }

  @Post(":eventId/share")
  @UseGuards(JwtAuthGuard)
  logEventShare(
    @Param("eventId") eventId: string,
    @Body() dto: LogShareDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.logShare(
      request.user!.sub,
      eventId,
      undefined,
      dto.channel,
    );
  }

  @Patch(":eventId")
  @UseGuards(JwtAuthGuard)
  update(
    @Param("eventId") eventId: string,
    @Body() dto: UpdateEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.update(
      request.user!.sub,
      eventId,
      dto,
      this.context(request),
    );
  }

  @Delete(":eventId")
  @UseGuards(JwtAuthGuard)
  remove(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.remove(
      request.user!.sub,
      eventId,
      this.context(request),
    );
  }

  @Get(":eventId/invitees")
  @UseGuards(JwtAuthGuard)
  listInvitees(
    @Param("eventId") eventId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.listInvitees(request.user!.sub, eventId);
  }

  @Post(":eventId/invitees")
  @UseGuards(JwtAuthGuard)
  createInvitees(
    @Param("eventId") eventId: string,
    @Body() dto: CreateInviteesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.createInvitees(
      request.user!.sub,
      eventId,
      dto,
      this.context(request),
    );
  }

  @Post(":eventId/invitees/import")
  @UseGuards(JwtAuthGuard)
  importInvitees(
    @Param("eventId") eventId: string,
    @Body() dto: CreateGuestRecordsDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.createGuestRecords(
      request.user!.sub,
      eventId,
      dto,
      this.context(request),
    );
  }

  @Patch(":eventId/invitees/:inviteeId")
  @UseGuards(JwtAuthGuard)
  updateInvitee(
    @Param("eventId") eventId: string,
    @Param("inviteeId") inviteeId: string,
    @Body() dto: UpdateInviteeDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.updateInvitee(
      request.user!.sub,
      eventId,
      inviteeId,
      dto,
      this.context(request),
    );
  }

  @Post(":eventId/invitees/:inviteeId/disable")
  @UseGuards(JwtAuthGuard)
  disableInvitee(
    @Param("eventId") eventId: string,
    @Param("inviteeId") inviteeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.setInviteeLink(
      request.user!.sub,
      eventId,
      inviteeId,
      true,
    );
  }

  @Post(":eventId/invitees/:inviteeId/enable")
  @UseGuards(JwtAuthGuard)
  enableInvitee(
    @Param("eventId") eventId: string,
    @Param("inviteeId") inviteeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.setInviteeLink(
      request.user!.sub,
      eventId,
      inviteeId,
      false,
    );
  }

  @Post(":eventId/invitees/:inviteeId/share")
  @UseGuards(JwtAuthGuard)
  logInviteeShare(
    @Param("eventId") eventId: string,
    @Param("inviteeId") inviteeId: string,
    @Body() dto: LogShareDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.logShare(
      request.user!.sub,
      eventId,
      inviteeId,
      dto.channel,
    );
  }

  @Post(":eventId/invitees/:inviteeId/regenerate")
  @UseGuards(JwtAuthGuard)
  regenerateInviteeSlug(
    @Param("eventId") eventId: string,
    @Param("inviteeId") inviteeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.regenerateInviteeSlug(
      request.user!.sub,
      eventId,
      inviteeId,
      this.context(request),
    );
  }

  @Delete(":eventId/invitees/:inviteeId")
  @UseGuards(JwtAuthGuard)
  deleteInvitee(
    @Param("eventId") eventId: string,
    @Param("inviteeId") inviteeId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.eventsService.deleteInvitee(
      request.user!.sub,
      eventId,
      inviteeId,
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
