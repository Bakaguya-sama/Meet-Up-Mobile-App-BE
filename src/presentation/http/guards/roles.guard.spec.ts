import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  const handler = () => undefined;
  const controller = class Controller {};
  const context = (
    roles: readonly ('user' | 'admin')[] = [],
  ): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => controller,
      switchToHttp: () => ({ getRequest: () => ({ user: { roles } }) }),
    }) as unknown as ExecutionContext;

  it('allows public endpoints without an authenticated principal', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === IS_PUBLIC_KEY),
    };
    expect(new RolesGuard(reflector as never).canActivate(context())).toBe(
      true,
    );
  });

  it('requires at least one declared role', () => {
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => {
        if (key === IS_PUBLIC_KEY) return false;
        return key === ROLES_KEY ? ['admin'] : undefined;
      }),
    };
    const guard = new RolesGuard(reflector as never);

    expect(guard.canActivate(context(['user']))).toBe(false);
    expect(guard.canActivate(context(['admin']))).toBe(true);
  });
});
