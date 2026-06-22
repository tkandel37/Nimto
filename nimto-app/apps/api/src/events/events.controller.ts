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
