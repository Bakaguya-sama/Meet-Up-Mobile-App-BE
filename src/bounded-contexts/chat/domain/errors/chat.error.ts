import { DomainError } from '../../../../shared-kernel/domain/domain-error';

export type ChatErrorCode =
  'CHAT_FORBIDDEN' | 'DIRECT_CHAT_FORBIDDEN' | 'INVALID_INPUT';

export class ChatError extends DomainError {
  constructor(code: ChatErrorCode, message: string) {
    super(code, message);
  }
}
