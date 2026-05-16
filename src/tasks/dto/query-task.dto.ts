import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class QueryTaskDto {
  @ApiPropertyOptional({
    example: 1,
    description: 'Nomor halaman',
    minimum: 1,
    default: 1,
  })
  // page
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    example: 10,
    description: 'Jumlah data per halaman',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  // limit
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    example: 'nestjs',
    description: 'Cari task berdasarkan title atau description',
  })
  // search
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Filter berdasarkan status task',
  })
  // done
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }

    if (value === true || value === 'true') {
      return true;
    }

    if (value === false || value === 'false') {
      return false;
    }

    return value;
  })
  @IsBoolean()
  done?: boolean;
}
