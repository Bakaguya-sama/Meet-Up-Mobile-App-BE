import { DomainError } from '../../../shared-kernel/domain/domain-error';

export class DeviceTokenAccessError extends DomainError {
  constructor() {
    super('FORBIDDEN', 'Device token is not available to this account');
  }
}
