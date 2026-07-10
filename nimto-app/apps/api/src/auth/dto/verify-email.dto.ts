import { IsEmail, Matches } from "class-validator";

export class VerifyEmailDto {
  @IsEmail({}, { message: "Please provide a valid email address." })
  email!: string;

  @Matches(/^\d{6}$/, {
    message: "Verification code must be a 6-digit number.",
  })
  code!: string;
}
