export interface AuditLogInput {
  id: string;
  actorId: string;
  action: string;
  subjectType: string;
  subjectId: string;
  metadataJson: Record<string, string | boolean>;
  createdAt: Date;
}

export interface AuditLogStorePort {
  record(input: AuditLogInput): Promise<void>;
}
