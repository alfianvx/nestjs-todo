import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '../role/role.enum';

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  role: Role;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
