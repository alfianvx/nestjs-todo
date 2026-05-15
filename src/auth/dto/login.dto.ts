import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@mail.com',
    description: 'Email user',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password user',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  password: string;
}
