import { IsObject, IsString } from "class-validator";

export class SaveEventDesignDraftDto {
  @IsString()
  designVersionId!: string;

  @IsObject()
  designFieldValues!: Record<string, unknown>;
}
