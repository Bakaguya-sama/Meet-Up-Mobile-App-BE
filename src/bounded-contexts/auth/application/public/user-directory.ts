/** Public read API for other contexts; never exposes credentials or preferences. */
export interface DirectoryUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export abstract class UserDirectory {
  abstract search(input: {
    actorId: string;
    query: string;
    offset: number;
    limit: number;
  }): Promise<{ items: DirectoryUser[]; total: number }>;

  /** Returns only active, non-deleted accounts. */
  abstract findActiveByIds(ids: string[]): Promise<DirectoryUser[]>;

  /** Resolves only active accounts with an enabled stable public handle. */
  abstract findActiveByPublicHandle(
    publicHandle: string,
  ): Promise<DirectoryUser | null>;
}
