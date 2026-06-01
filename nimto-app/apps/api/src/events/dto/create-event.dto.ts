import { EventType } from "@prisma/client";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateEventDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

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
}
