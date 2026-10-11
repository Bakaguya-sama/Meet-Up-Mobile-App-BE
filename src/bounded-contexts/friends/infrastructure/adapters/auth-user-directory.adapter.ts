import { Injectable } from '@nestjs/common';
import { UserDirectory } from '../../../auth/application/public/user-directory';
import type { FriendUserDirectoryPort } from '../../application/ports/user-directory.port';

@Injectable()
export class AuthUserDirectoryAdapter implements FriendUserDirectoryPort {
  constructor(private readonly users: UserDirectory) {}

  search(input: {
    actorId: string;
    query: string;
    offset: number;
    limit: number;
  }) {
    return this.users.search(input);
  }

  findActiveByIds(ids: string[]) {
    return this.users.findActiveByIds(ids);
  }
}
