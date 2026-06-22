import { EventType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsObject,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";

export class UpdateEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  @IsOptional()
  title?: string;

  @IsEnum(EventType)
  @IsOptional()
  type?: EventType;

  @IsDateString()
  @IsOptional()
  eventDate?: string;

  @IsString()
  @MaxLength(180)
  @IsOptional()
  venue?: string;

  @IsString()
  @MaxLength(1200)
  @IsOptional()
  description?: string;

  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  @IsOptional()
  coverImage?: string;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;

  @IsString()
  @IsOptional()
  designVersionId?: string;

  @IsObject()
  @IsOptional()
  designFieldValues?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  rsvpDeadline?: string;

  @IsString()
  @MaxLength(4000)
  @IsOptional()
  organizerNotes?: string;

  @IsObject()
  @IsOptional()
  checklist?: Record<string, boolean>;
}
