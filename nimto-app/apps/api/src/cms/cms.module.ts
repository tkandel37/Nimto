import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CmsController } from "./cms.controller";
import { CmsService } from "./cms.service";

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [CmsController],
  providers: [CmsService],
})
export class CmsModule {}
