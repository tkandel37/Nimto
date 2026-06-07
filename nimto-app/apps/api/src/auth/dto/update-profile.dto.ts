import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsEmail()
  @MaxLength(180)
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  phone?: string;
}
