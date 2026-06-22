import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

class GuestRecordDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @MaxLength(40)
  @IsOptional()
  phone?: string;

  @IsString()
  @MaxLength(80)
  @IsOptional()
  groupName?: string;

  @IsString()
  @MaxLength(120)
  @IsOptional()
  mealPreference?: string;
}

export class CreateGuestRecordsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => GuestRecordDto)
  guests!: GuestRecordDto[];
}
