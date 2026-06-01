import { PublishStatus } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateBlogPostDto {
  @IsString()
  @MinLength(4)
  @MaxLength(160)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(220)
  excerpt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  citationSummary?: string;

  @IsString()
  @MinLength(20)
  @MaxLength(30000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  metaTitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  metaDescription?: string;

  @IsOptional()
  @IsString()
  @MaxLength(260)
  keywords?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  faq?: string;

  @IsOptional()
  @IsString()
  @MaxLength(6000)
  sources?: string;

  @IsOptional()
  @IsEnum(PublishStatus)
  status?: PublishStatus;
}
