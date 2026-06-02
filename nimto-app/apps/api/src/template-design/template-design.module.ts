import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { TemplateDesignController } from "./template-design.controller";
import { TemplateDesignService } from "./template-design.service";

@Module({
  imports: [AuditModule, PrismaModule],
  controllers: [TemplateDesignController],
  providers: [TemplateDesignService],
})
export class TemplateDesignModule {}
