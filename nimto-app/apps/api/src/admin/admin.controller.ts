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
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { PermissionsGuard } from "../auth/guards/permissions.guard";
import { PERMISSIONS } from "../auth/permissions";
import { AdminService } from "./admin.service";
import { CreateRoleDto } from "./dto/create-role.dto";
import { CreateStaffDto } from "./dto/create-staff.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdateStaffDto } from "./dto/update-staff.dto";

@Controller("admin")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("summary")
  summary(@Req() request: AuthenticatedRequest) {
    return this.adminService.dashboardSummary(request.user!.sub);
  }

  @Get("permissions")
  @RequirePermissions(PERMISSIONS.permissionsView)
  listPermissions() {
    return this.adminService.listPermissions();
  }

  @Post("permissions/seed")
  @RequirePermissions(PERMISSIONS.permissionsManage)
  seedPermissions(@Req() request: AuthenticatedRequest) {
    return this.adminService
      .seedPermissionCatalog(this.context(request))
      .then(() => ({ success: true }));
  }

  @Get("roles")
  @RequirePermissions(PERMISSIONS.rolesView)
  listRoles() {
    return this.adminService.listRoles();
  }

  @Post("roles")
  @RequirePermissions(PERMISSIONS.rolesManage)
  createRole(@Body() dto: CreateRoleDto, @Req() request: AuthenticatedRequest) {
    return this.adminService.createRole(dto, this.context(request));
  }

  @Patch("roles/:roleId")
  @RequirePermissions(PERMISSIONS.rolesManage)
  updateRole(
    @Param("roleId") roleId: string,
    @Body() dto: UpdateRoleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.updateRole(roleId, dto, this.context(request));
  }

  @Delete("roles/:roleId")
  @RequirePermissions(PERMISSIONS.rolesManage)
  deleteRole(
    @Param("roleId") roleId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.deleteRole(roleId, this.context(request));
  }

  @Get("staff")
  @RequirePermissions(PERMISSIONS.staffView)
  listStaff(@Query("skip") skip?: string, @Query("take") take?: string) {
    return this.adminService.listStaff(this.pagination(skip, take));
  }

  @Get("users")
  @RequirePermissions(PERMISSIONS.staffView)
  listUsers(@Query("skip") skip?: string, @Query("take") take?: string) {
    return this.adminService.listUsers(this.pagination(skip, take));
  }

  @Post("staff")
  @RequirePermissions(PERMISSIONS.staffManage)
  createStaff(
    @Body() dto: CreateStaffDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.createStaff(dto, this.context(request));
  }

  @Patch("staff/:userId")
  @RequirePermissions(PERMISSIONS.staffManage)
  updateStaff(
    @Param("userId") userId: string,
    @Body() dto: UpdateStaffDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.updateStaff(userId, dto, this.context(request));
  }

  @Patch("users/:userId")
  @RequirePermissions(PERMISSIONS.staffManage)
  updateUser(
    @Param("userId") userId: string,
    @Body() dto: UpdateStaffDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.updateUserStatus(
      userId,
      { status: dto.status },
      this.context(request),
    );
  }

  @Delete("users/:userId")
  @RequirePermissions(PERMISSIONS.staffManage)
  deleteUser(
    @Param("userId") userId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.deleteUser(userId, this.context(request));
  }

  @Get("sessions")
  @RequirePermissions(PERMISSIONS.sessionsView)
  listSessions() {
    return this.adminService.listSessions();
  }

  @Post("sessions/:sessionId/force-logout")
  @RequirePermissions(PERMISSIONS.sessionsManage)
  forceLogout(
    @Param("sessionId") sessionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminService.forceLogout(sessionId, this.context(request));
  }

  @Get("accounts/:userId/sessions")
  @RequirePermissions(PERMISSIONS.sessionsView)
  listAccountSessions(
    @Param("userId") userId: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.adminService.listAccountSessions(
      userId,
      this.pagination(skip, take),
    );
  }

  @Get("audit-logs")
  @RequirePermissions(PERMISSIONS.auditView)
  listAuditLogs() {
    return this.adminService.listAuditLogs();
  }

  @Get("accounts/:userId/audit-logs")
  @RequirePermissions(PERMISSIONS.auditView)
  listAccountAuditLogs(
    @Param("userId") userId: string,
    @Query("skip") skip?: string,
    @Query("take") take?: string,
  ) {
    return this.adminService.listAccountAuditLogs(
      userId,
      this.pagination(skip, take),
    );
  }

  private context(request: AuthenticatedRequest) {
    return {
      actorId: request.user!.sub,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };
  }

  private pagination(skip?: string, take?: string) {
    return {
      skip: Number.parseInt(skip ?? "0", 10),
      take: Number.parseInt(take ?? "30", 10),
    };
  }
}
