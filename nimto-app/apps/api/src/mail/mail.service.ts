import { Injectable, Logger } from "@nestjs/common";
import { MailerService } from "@nestjs-modules/mailer";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
  ) {}

  async sendVerificationEmail(to: string, token: string) {
    const appUrl = this.config.get<string>(
      "NEXT_PUBLIC_APP_URL",
      "http://localhost:3000",
    );
    const verifyUrl = `${appUrl}/auth/verify?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to,
        subject: "Verify your Nimto account",
        text: `Welcome to Nimto! Please verify your email address by clicking the link: ${verifyUrl}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Nimto!</h2>
            <p>Thanks for registering. Please confirm your email address by clicking the button below:</p>
            <div style="margin: 30px 0;">
              <a href="${verifyUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p><a href="${verifyUrl}">${verifyUrl}</a></p>
          </div>
        `,
      });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}`, error);
      throw error;
    }
  }
}
