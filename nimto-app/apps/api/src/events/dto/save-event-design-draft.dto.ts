import { IsObject, IsOptional, IsString } from "class-validator";

export class SaveEventDesignDraftDto {
  @IsString()
  designVersionId!: string;

  @IsObject()
  designFieldValues!: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  featureSettings?: Record<string, unknown>;
}
