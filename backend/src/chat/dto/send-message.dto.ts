import { IsString, IsNumber, MinLength, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsNumber()
  roomId: number;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string;
}
