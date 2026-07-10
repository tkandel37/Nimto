import { RsvpStatus } from "@prisma/client";
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class SubmitRsvpDto {
  @IsEnum(RsvpStatus)
  status!: RsvpStatus;

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
  message?: string;

  @IsObject()
  @IsOptional()
  answers?: Record<string, unknown>;
}
