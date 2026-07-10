import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { MailerModule } from "@nestjs-modules/mailer";
import { MailService } from "./mail.service";

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const user = config.get<string>("SMTP_USER");
        const pass = config.get<string>("SMTP_PASS");

        return {
          transport: {
            host: config.get<string>("SMTP_HOST", "smtp.ethereal.email"),
            port: Number(config.get<string>("SMTP_PORT", "587")),
            secure: config.get<string>("SMTP_SECURE", "false") === "true",
            connectionTimeout: Number(
              config.get<string>("SMTP_CONNECTION_TIMEOUT_MS", "10000"),
            ),
            greetingTimeout: Number(
              config.get<string>("SMTP_GREETING_TIMEOUT_MS", "10000"),
            ),
            socketTimeout: Number(
              config.get<string>("SMTP_SOCKET_TIMEOUT_MS", "15000"),
            ),
            ...(user && pass ? { auth: { user, pass } } : {}),
          },
          defaults: {
            from: config.get<string>(
              "SMTP_FROM",
              '"myNimto Local" <noreply@nimto.local>',
            ),
          },
        };
      },
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
