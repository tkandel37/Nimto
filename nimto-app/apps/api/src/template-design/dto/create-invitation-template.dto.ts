import {
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateInvitationTemplateDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(80)
  @MaxLength(1000000)
  rawHtml!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  sourceFileName?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  subcategoryId?: string;

  @IsOptional()
  @IsObject()
  featureConfig?: Record<string, unknown>;
}
