import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { AuthUser } from './decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Register user baru' })
  @ApiResponse({ status: 201, description: 'User berhasil register' })
  @ApiResponse({ status: 409, description: 'Email sudah terdaftar' })
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({
    status: 201,
    description: 'Login berhasil dan mendapat access token + refresh token',
  })
  @ApiResponse({ status: 401, description: 'Email atau password salah' })
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refresh access token menggunakan refresh token' })
  @ApiResponse({
    status: 201,
    description: 'Token berhasil diperbarui',
  })
  @ApiResponse({ status: 401, description: 'Refresh token tidak valid' })
  @UseGuards(JwtRefreshGuard)
  @Post('refresh')
  refresh(@CurrentUser() user: AuthUser) {
    return this.authService.refreshToken(user);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout user dan hapus refresh token' })
  @ApiResponse({ status: 201, description: 'Logout berhasil' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@CurrentUser() user: AuthUser) {
    return this.authService.logout(user.id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ambil data user yang sedang login' })
  @ApiResponse({ status: 200, description: 'Data user login' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}
