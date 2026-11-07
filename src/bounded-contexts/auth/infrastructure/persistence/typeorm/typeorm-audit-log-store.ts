import { EntityManager } from 'typeorm';
import type {
  AuditLogInput,
  AuditLogStorePort,
} from '../../../application/ports/persistence/audit-log-store.port';
import { AuditLogEntity } from './entities/audit-log.typeorm-entity';

export class TypeOrmAuditLogStore implements AuditLogStorePort {
  constructor(private readonly manager: EntityManager) {}

  async record(input: AuditLogInput): Promise<void> {
    await this.manager.insert(AuditLogEntity, input);
  }
}
