import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

import * as bcrypt from 'bcrypt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Role } from './role/role.enum';

describe('AuthService', () => {
  // Group tests for AuthService.

  let service: AuthService;
  // Instance of the service resolved from the testing module.

  // Manual mocks for dependencies. We keep only the methods AuthService actually calls.
  const usersMock = {
    findByEmail: jest.fn(), // used in register/login
    create: jest.fn(), // used in register
    updateHashedRefreshToken: jest.fn(), // used in generateAuthResponse
    removeHashedRefreshToken: jest.fn(), // used in logout
  } as unknown as Partial<UsersService>;

  const jwtMock = {
    signAsync: jest.fn(), // used to produce access & refresh tokens
  } as unknown as Partial<JwtService>;

  const configMock = {
    getOrThrow: jest.fn(), // to fetch required secrets
    get: jest.fn(), // to fetch optional expirations
  } as unknown as Partial<ConfigService>;

  beforeEach(async () => {
    // Build a TestingModule that provides the AuthService and replaces its dependencies
    // with the mocks we defined above. This mirrors how Nest's DI works but in-memory
    // so tests are isolated and fast.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: usersMock, // inject the manual users mock
        },
        {
          provide: JwtService,
          useValue: jwtMock, // inject the manual jwt mock
        },
        {
          provide: ConfigService,
          useValue: configMock, // inject the manual config mock
        },
      ],
    }).compile();

    // Resolve the AuthService instance from the testing module DI container.
    service = module.get<AuthService>(AuthService);

    // Reset mock call history/state between tests to avoid cross-test interference.
    jest.clearAllMocks();

    // Provide reasonable defaults for config lookups used by generateTokens.
    configMock.getOrThrow = jest.fn((key: string) => {
      if (key === 'JWT_SECRET') return 'test-jwt-secret';
      if (key === 'REFRESH_TOKEN_SECRET') return 'test-refresh-secret';
      throw new Error(`Unexpected key ${key}`);
    });

    configMock.get = jest.fn((key: string) => {
      if (key === 'JWT_EXPIRES_IN') return '15m';
      if (key === 'REFRESH_TOKEN_EXPIRES_IN') return '7d';
      return undefined;
    });
  });

  describe('register', () => {
    it('should register a new user and generate auth response', async () => {
      // Arrange - input DTO for registration
      const dto = { email: 'a@a.com', password: 'plain', name: 'Alice' };

      // No existing user
      usersMock.findByEmail = jest.fn().mockResolvedValue(null);

      // Stub bcrypt.hash (mocked module) to return a deterministic hashed password
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pass');

      // When users.create is called, return a created user object
      const createdUser = {
        id: 1,
        email: dto.email,
        name: dto.name,
        role: Role.USER,
      };
      usersMock.create = jest.fn().mockResolvedValue(createdUser);

      // Spy on generateAuthResponse so we don't need to exercise token generation here
      const authResponse = {
        accessToken: 'at',
        refreshToken: 'rt',
        tokenType: 'Bearer',
        user: createdUser,
      };
      const genSpy = jest
        .spyOn(service, 'generateAuthResponse' as any)
        .mockResolvedValue(authResponse as any);

      // Act - call register
      const result = await service.register(dto as any);

      // Assert - ensure password was hashed and user created with hashed password
      expect(bcrypt.hash as jest.Mock).toHaveBeenCalledWith(dto.password, 10);
      expect(usersMock.create).toHaveBeenCalledWith({
        email: dto.email,
        password: 'hashed-pass',
        name: dto.name,
      });

      // Ensure generateAuthResponse was called with the token user payload
      expect(genSpy).toHaveBeenCalledWith({
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
      });

      // And the register method returns what generateAuthResponse returned
      expect(result).toEqual(authResponse);

      // Cleanup mocks: reset to clear call history and implementations
      (bcrypt.hash as jest.Mock).mockReset();
      genSpy.mockRestore();
    });

    it('should throw ConflictException if user already exists', async () => {
      const dto = { email: 'a@a.com', password: 'p', name: 'A' };

      // Simulate existing user
      usersMock.findByEmail = jest
        .fn()
        .mockResolvedValue({ id: 1, email: dto.email });

      await expect(service.register(dto as any)).rejects.toThrow(
        ConflictException,
      );

      // Create should not be called when user exists
      expect(usersMock.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login and generate auth response when credentials valid', async () => {
      const dto = { email: 'u@u.com', password: 'plain' };

      // Simulate existing user with hashed password
      const user = {
        id: 2,
        email: dto.email,
        password: 'stored-hash',
        name: null,
        role: Role.USER,
      };
      usersMock.findByEmail = jest.fn().mockResolvedValue(user);

      // Mock bcrypt.compare (mocked module) to return true for valid password
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      // Stub generateAuthResponse
      const authResponse = {
        accessToken: 'a',
        refreshToken: 'r',
        tokenType: 'Bearer',
        user,
      };
      const genSpy = jest
        .spyOn(service, 'generateAuthResponse' as any)
        .mockResolvedValue(authResponse as any);

      const result = await service.login(dto as any);

      expect(bcrypt.compare as jest.Mock).toHaveBeenCalledWith(
        dto.password,
        user.password,
      );
      expect(genSpy).toHaveBeenCalledWith({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

      expect(result).toEqual(authResponse);

      // Cleanup mocks
      (bcrypt.compare as jest.Mock).mockReset();
      genSpy.mockRestore();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      const dto = { email: 'no@one.com', password: 'x' };
      usersMock.findByEmail = jest.fn().mockResolvedValue(null);

      await expect(service.login(dto as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password invalid', async () => {
      const dto = { email: 'u@u.com', password: 'bad' };
      const user = {
        id: 3,
        email: dto.email,
        password: 'stored',
        name: null,
        role: Role.USER,
      };
      usersMock.findByEmail = jest.fn().mockResolvedValue(user);

      // Mock bcrypt.compare to return false (invalid password)
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login(dto as any)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshToken & logout', () => {
    it('should refresh token by delegating to generateAuthResponse', async () => {
      const tokenUser = { id: 5, email: 't@t.com', name: 'T', role: Role.USER };

      const authResponse = {
        accessToken: 'ax',
        refreshToken: 'rx',
        tokenType: 'Bearer',
        user: tokenUser,
      };
      const genSpy = jest
        .spyOn(service, 'generateAuthResponse' as any)
        .mockResolvedValue(authResponse as any);

      const result = await service.refreshToken(tokenUser as any);

      expect(genSpy).toHaveBeenCalledWith(tokenUser);
      expect(result).toEqual(authResponse);

      genSpy.mockRestore();
    });

    it('should logout and remove hashed refresh token', async () => {
      usersMock.removeHashedRefreshToken = jest
        .fn()
        .mockResolvedValue(undefined);

      const result = await service.logout(10);

      expect(usersMock.removeHashedRefreshToken).toHaveBeenCalledWith(10);
      expect(result).toEqual({ loggedOut: true });
    });
  });

  describe('generateAuthResponse', () => {
    it('should generate tokens, hash refresh token and update user', async () => {
      // Provide a token user shape
      const tokenUser = { id: 7, email: 'g@g.com', name: 'G', role: Role.USER };

      // Mock jwt.signAsync to return different tokens for access & refresh
      (jwtMock.signAsync as jest.Mock).mockResolvedValueOnce('access-token');
      (jwtMock.signAsync as jest.Mock).mockResolvedValueOnce('refresh-token');

      // Mock bcrypt.hash to hash the refresh token
      // Mock bcrypt.hash to return a hashed refresh token
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-refresh');

      // Mock users.updateHashedRefreshToken to resolve
      usersMock.updateHashedRefreshToken = jest
        .fn()
        .mockResolvedValue(undefined);

      // Call generateAuthResponse (public) and assert behavior
      const result = await service.generateAuthResponse(tokenUser as any);

      // The returned object should include tokens, tokenType and user
      expect(result).toMatchObject({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        user: tokenUser,
      });

      // jwt.signAsync should have been called twice (access + refresh)
      expect(jwtMock.signAsync).toHaveBeenCalledTimes(2);

      // bcrypt.hash should be used to hash the refresh token before storing
      expect(bcrypt.hash as jest.Mock).toHaveBeenCalledWith(
        'refresh-token',
        10,
      );

      // Ensure the hashed refresh token was saved for the user
      expect(usersMock.updateHashedRefreshToken).toHaveBeenCalledWith(
        tokenUser.id,
        'hashed-refresh',
      );

      // Cleanup bcrypt mock
      (bcrypt.hash as jest.Mock).mockReset();
    });
  });
});
