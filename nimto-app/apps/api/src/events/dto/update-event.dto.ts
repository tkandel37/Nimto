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
  eventDate?: string | null;

  @IsString()
  @MaxLength(180)
  @IsOptional()
  venue?: string | null;

  @IsString()
  @MaxLength(1200)
  @IsOptional()
  description?: string | null;

  @IsUrl({ require_protocol: true })
  @MaxLength(600)
  @IsOptional()
  coverImage?: string | null;

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
  rsvpDeadline?: string | null;

  @IsString()
  @MaxLength(4000)
  @IsOptional()
  organizerNotes?: string | null;

  @IsObject()
  @IsOptional()
  checklist?: Record<string, boolean>;

  @IsObject()
  @IsOptional()
  rsvpConfig?: Record<string, unknown>;
}
