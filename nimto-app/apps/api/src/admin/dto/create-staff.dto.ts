import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsString,
  MinLength,
} from "class-validator";

export class CreateStaffDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  roleIds!: string[];
}
