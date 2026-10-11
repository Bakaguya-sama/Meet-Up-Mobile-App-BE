import { Injectable } from '@nestjs/common';
import { PrivacySelectedFriendPurge } from '../../application/public/privacy-selected-friend-purge';
import { RemoveSelectedFriendUseCase } from '../../application/use-cases/remove-selected-friend.use-case';

/** Wires the cross-context purge port to the real use-case. */
@Injectable()
export class PrivacyPurgeAdapter extends PrivacySelectedFriendPurge {
  constructor(private readonly remove: RemoveSelectedFriendUseCase) {
    super();
  }

  removeFromOwnerSelection(
    ownerId: string,
    selectedFriendId: string,
  ): Promise<void> {
    return this.remove.execute({ ownerId, selectedFriendId });
  }
}
