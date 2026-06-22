import { RsvpStatus } from "@prisma/client";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateInviteeDto {
  @IsString()
  @MaxLength(120)
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  phone?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  groupName?: string;

  @IsString()
  @MaxLength(800)
  @IsOptional()
  organizerNotes?: string;

  @IsEnum(RsvpStatus)
  @IsOptional()
  rsvpStatus?: RsvpStatus;

  @IsInt()
  @Min(1)
  @Max(20)
  @IsOptional()
  partySize?: number;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  mealPreference?: string;

  @IsString()
  @MaxLength(800)
  @IsOptional()
  rsvpMessage?: string;

  @IsDateString()
  @IsOptional()
  linkExpiresAt?: string;
}
