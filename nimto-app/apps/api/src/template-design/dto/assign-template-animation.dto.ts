import { IsString, MaxLength, MinLength } from "class-validator";

export class AssignTemplateAnimationDto {
  @IsString()
  @MinLength(1)
  animationComponentId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  slotKey!: string;
}
