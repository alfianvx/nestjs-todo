import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({
    example: 'Belajar Swagger',
    description: 'Judul task',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Status selesai atau belum',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
