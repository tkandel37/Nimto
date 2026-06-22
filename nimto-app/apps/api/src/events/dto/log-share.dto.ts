import { IsIn, IsString } from "class-validator";

export class LogShareDto {
  @IsString()
  @IsIn(["COPY", "WHATSAPP", "EMAIL", "MESSENGER", "NATIVE"])
  channel!: string;
}
