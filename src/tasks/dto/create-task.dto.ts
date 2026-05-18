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
    example: 'learning by doing',
    description: 'Deskripsi task',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  done?: boolean;
}
