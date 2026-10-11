import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser } from '../../../shared-kernel/application/authenticated-user';

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, context: ExecutionContext) => {
    const user = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>().user;
    return field ? user[field] : user;
  },
);
