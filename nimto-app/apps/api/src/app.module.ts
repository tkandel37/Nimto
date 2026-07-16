import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { minutes, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { PrismaModule } from "./prisma/prisma.module";
import { MailModule } from "./mail/mail.module";
import { AuditModule } from "./audit/audit.module";
import { AdminModule } from "./admin/admin.module";
import { EventsModule } from "./events/events.module";
import { CmsModule } from "./cms/cms.module";
import { TemplateDesignModule } from "./template-design/template-design.module";
import { validateEnvironment } from "./config/environment";
import { SecurityThrottlerGuard } from "./security/security-throttler.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: minutes(1),
        limit: 180,
        blockDuration: minutes(1),
      },
    ]),
    PrismaModule,
    AuthModule,
    MailModule,
    AuditModule,
    AdminModule,
    EventsModule,
    CmsModule,
    TemplateDesignModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: SecurityThrottlerGuard,
    },
  ],
})
export class AppModule {}
