import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from './role/role.enum';

type TokenUser = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);

    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      name: registerDto.name,
    });

    return this.generateAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
  }

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    if (!user) {
      throw new UnauthorizedException('Email or password invalid');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    return this.generateAuthResponse({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role as Role,
    });
  }

  async refreshToken(user: TokenUser) {
    return this.generateAuthResponse(user);
  }

  async logout(userId: number) {
    await this.usersService.removeHashedRefreshToken(userId);

    return {
      loggedOut: true,
    };
  }

  async generateAuthResponse(user: TokenUser) {
    const tokens = await this.generateTokens(user);

    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);

    await this.usersService.updateHashedRefreshToken(
      user.id,
      hashedRefreshToken,
    );

    return {
      ...tokens,
      tokenType: 'Bearer',
      user,
    };
  }

  private async generateTokens(user: TokenUser) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET') as any,
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') ?? '15m',
      } as any),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>(
          'REFRESH_TOKEN_SECRET',
        ) as any,
        expiresIn: (this.configService.get<string>(
          'REFRESH_TOKEN_EXPIRES_IN',
        ) ?? '7d') as any,
      } as any),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
