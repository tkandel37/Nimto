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
  listStaff() {
    return this.adminService.listStaff();
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

  @Get("audit-logs")
  @RequirePermissions(PERMISSIONS.auditView)
  listAuditLogs() {
    return this.adminService.listAuditLogs();
  }

  private context(request: AuthenticatedRequest) {
    return {
      actorId: request.user!.sub,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
    };
  }
}
