import { DomainError } from '../../../../shared-kernel/domain/domain-error';

export class AdminError extends DomainError {
  constructor(code: 'ADMIN_SELF_LOCK', message: string) {
    super(code, message);
  }
}
