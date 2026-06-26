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

  private resolveAppUrl() {
    const configuredUrl =
      this.config.get<string>("FRONTEND_URL") ??
      this.config.get<string>("NEXT_PUBLIC_APP_URL") ??
      "http://localhost:3000";

    return configuredUrl.split(",")[0]!.trim().replace(/\/$/, "");
  }

  private renderEmailShell({
    eyebrow,
    title,
    intro,
    body,
    footer,
  }: {
    eyebrow: string;
    title: string;
    intro: string;
    body: string;
    footer: string;
  }) {
    return `
      <div style="margin:0;padding:24px;background-color:#f5f3ee;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:640px;margin:0 auto;border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 18px 0;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#9b6b1f;">
              myNimto
            </td>
          </tr>
          <tr>
            <td style="border-radius:28px;overflow:hidden;background:linear-gradient(135deg,#fff8ea 0%,#f7fcf8 52%,#fff5f7 100%);border:1px solid #eadfcb;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
                <tr>
                  <td style="padding:36px 36px 22px 36px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="display:inline-block;padding:8px 14px;border-radius:999px;background-color:#ffffff;color:#16745e;font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;border:1px solid rgba(22,116,94,0.12);">
                      ${eyebrow}
                    </div>
                    <h1 style="margin:20px 0 14px 0;font-size:34px;line-height:1.1;color:#172033;font-weight:800;">
                      ${title}
                    </h1>
                    <p style="margin:0;font-size:16px;line-height:1.75;color:#4a5567;">
                      ${intro}
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 36px 28px 36px;">
                    ${body}
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 36px 36px 36px;font-family:Arial,Helvetica,sans-serif;">
                    <div style="padding:18px 20px;border-radius:18px;background-color:#ffffff;border:1px solid #eadfcb;font-size:13px;line-height:1.7;color:#5e6876;">
                      ${footer}
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  async sendVerificationEmail(to: string, code: string) {
    const verifyUrl = `${this.resolveAppUrl()}/auth/verify?email=${encodeURIComponent(to)}`;
    const formattedCode = code.split("").join(" ");

    try {
      await this.mailerService.sendMail({
        to,
        subject: "Your myNimto verification code",
        text: `Your myNimto verification code is ${code}. It expires in 15 minutes. Enter it at ${verifyUrl}`,
        html: this.renderEmailShell({
          eyebrow: "Email verification",
          title: "Confirm your email with this one-time code",
          intro:
            "Use the verification code below to finish creating your myNimto account.",
          body: `
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td style="padding:30px 24px;border-radius:24px;background-color:#172033;text-align:center;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#f6d28b;">
                    Verification code
                  </div>
                  <div style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.2;font-weight:800;letter-spacing:0.38em;color:#ffffff;">
                    ${formattedCode}
                  </div>
                  <div style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#d9dfeb;">
                    This code expires in 15 minutes.
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding-top:22px;">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                    <tr>
                      <td style="border-radius:999px;background-color:#16745e;">
                        <a href="${verifyUrl}" style="display:inline-block;padding:14px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                          Open verification page
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          `,
          footer:
            "Do not share this code with anyone. If you did not start creating a myNimto account, you can safely ignore this email.",
        }),
      });
      this.logger.log(`Verification email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${to}`, error);
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${this.resolveAppUrl()}/auth/reset?token=${token}`;

    try {
      await this.mailerService.sendMail({
        to,
        subject: "Reset your myNimto password",
        text: `We received a request to reset your myNimto password. Use this link to choose a new password: ${resetUrl}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset your password</h2>
            <p>We received a request to reset your myNimto password.</p>
            <p>If you made this request, click the button below to choose a new password:</p>
            <div style="margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset password</a>
            </div>
            <p>This link expires in 1 hour.</p>
            <p>If you did not request this, you can ignore this email.</p>
            <p><a href="${resetUrl}">${resetUrl}</a></p>
          </div>
        `,
      });
      this.logger.log(`Password reset email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${to}`, error);
      throw error;
    }
  }
}
