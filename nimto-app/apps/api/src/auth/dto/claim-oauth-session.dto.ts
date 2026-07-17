import { IsString, MaxLength, MinLength } from "class-validator";

export class ClaimOAuthSessionDto {
  @IsString()
  @MinLength(32)
  @MaxLength(4096)
  bridge!: string;
}
