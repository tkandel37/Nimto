import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import nodemailer, { Transporter } from "nodemailer";

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const user = config.get<string>("SMTP_USER");
    const pass = config.get<string>("SMTP_PASS");
    this.from = config.get<string>(
      "SMTP_FROM",
      '"myNimto Local" <noreply@nimto.local>',
    );
    this.transporter = nodemailer.createTransport({
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
      disableFileAccess: true,
      disableUrlAccess: true,
      ...(user && pass ? { auth: { user, pass } } : {}),
    });
  }

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
    const verifyUrl = `${this.resolveAppUrl()}/auth/verify#email=${encodeURIComponent(to)}`;
    const formattedCode = code.split("").join(" ");

    try {
      await this.transporter.sendMail({
        from: this.from,
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
      this.logger.log("Verification email sent.");
    } catch (error) {
      this.logger.error(
        "Failed to send verification email.",
        this.mailErrorSummary(error),
      );
      throw error;
    }
  }

  async sendEmailChangeVerificationEmail(to: string, code: string) {
    const formattedCode = code.split("").join(" ");

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: "Confirm your new myNimto email address",
        text: `Your myNimto email-change code is ${code}. It expires in 15 minutes. If you did not request this change, do not share the code.`,
        html: this.renderEmailShell({
          eyebrow: "Email change",
          title: "Confirm your new email address",
          intro:
            "Enter this one-time code in your myNimto profile to finish changing your account email.",
          body: `
            <div style="padding:30px 24px;border-radius:24px;background-color:#172033;text-align:center;">
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:#f6d28b;">
                Confirmation code
              </div>
              <div style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:36px;line-height:1.2;font-weight:800;letter-spacing:0.38em;color:#ffffff;">
                ${formattedCode}
              </div>
              <div style="margin-top:18px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:#d9dfeb;">
                This code expires in 15 minutes.
              </div>
            </div>
          `,
          footer:
            "Do not share this code. If you did not request an email change, your current email remains unchanged.",
        }),
      });
      this.logger.log("Email-change verification sent.");
    } catch (error) {
      this.logger.error(
        "Failed to send email-change verification.",
        this.mailErrorSummary(error),
      );
      throw error;
    }
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const resetUrl = `${this.resolveAppUrl()}/auth/reset#token=${token}`;

    try {
      await this.transporter.sendMail({
        from: this.from,
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
      this.logger.log("Password reset email sent.");
    } catch (error) {
      this.logger.error(
        "Failed to send password reset email.",
        this.mailErrorSummary(error),
      );
      throw error;
    }
  }

  async sendEmailChangeStartedNotice(to: string) {
    return this.sendSecurityNotice(
      to,
      "A change to your myNimto email was requested",
      "Email change requested",
      "A request was made to change the email address on your myNimto account. The address will not change without the code sent to the new email. If this was not you, reset your password immediately.",
    );
  }

  async sendEmailChangedNotice(to: string) {
    return this.sendSecurityNotice(
      to,
      "Your myNimto email address was changed",
      "Email address changed",
      "The email address on your myNimto account was changed and all active sessions were signed out. If this was not you, contact the account owner immediately and secure your email account.",
    );
  }

  async sendPasswordChangedNotice(to: string) {
    return this.sendSecurityNotice(
      to,
      "Your myNimto password was changed",
      "Password changed",
      "Your myNimto password was reset and all active sessions were signed out. If this was not you, secure your email account and contact the account owner immediately.",
    );
  }

  private async sendSecurityNotice(
    to: string,
    subject: string,
    title: string,
    message: string,
  ) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text: message,
        html: this.renderEmailShell({
          eyebrow: "Security notice",
          title,
          intro: message,
          body: "",
          footer:
            "myNimto will never ask you to share a password, verification code, or reset link.",
        }),
      });
      this.logger.log("Account security notice sent.");
    } catch (error) {
      this.logger.error(
        "Failed to send an account security notice.",
        this.mailErrorSummary(error),
      );
      throw error;
    }
  }

  private mailErrorSummary(error: unknown) {
    if (!error || typeof error !== "object") return "Mailer failure";
    const code =
      "code" in error && typeof error.code === "string" ? error.code : null;
    const responseCode =
      "responseCode" in error && typeof error.responseCode === "number"
        ? error.responseCode
        : null;
    return ["Mailer failure", code, responseCode]
      .filter((part) => part !== null)
      .join(" / ");
  }
}
