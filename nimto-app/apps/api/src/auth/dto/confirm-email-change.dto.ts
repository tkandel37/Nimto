import { IsEmail, Matches, MaxLength } from "class-validator";

export class ConfirmEmailChangeDto {
  @IsEmail()
  @MaxLength(180)
  email!: string;

  @Matches(/^\d{6}$/, {
    message: "Verification code must be a 6-digit number.",
  })
  code!: string;
}
