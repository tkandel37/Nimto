import { AnimationComponentType, DesignCatalogStatus } from "@prisma/client";
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from "class-validator";

export class CreateAnimationComponentDto {
  @IsEnum(AnimationComponentType)
  type!: AnimationComponentType;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @IsString()
  @MinLength(40)
  @MaxLength(500000)
  rawHtml!: string;

  @IsOptional()
  @IsString()
  @MaxLength(180)
  sourceFileName?: string;

  @IsOptional()
  @IsEnum(DesignCatalogStatus)
  status?: DesignCatalogStatus;
}
