import { DomainError } from '../../../shared-kernel/domain/domain-error';

export class RecommendationError extends DomainError {
  constructor(code: string, message: string) {
    super(code, message);
  }
}
