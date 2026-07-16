import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @MinLength(64)
  @MaxLength(128)
  token!: string;

  @IsString()
  @MinLength(12, { message: "Password must be at least 12 characters." })
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/, {
    message:
      "Password must include uppercase, lowercase, number, and symbol characters.",
  })
  password!: string;
}
