/**
 * Outbound port — implemented by Auth, called by Friends when a friendship is
 * removed (unfriend purge). Keeps the contexts decoupled: Friends
 * never imports Auth internals; Auth never imports Friends internals.
 */
export abstract class PrivacySelectedFriendPurge {
  /**
   * Remove one former friend only from the specified owner's selected audience.
   * Idempotent and safe to retry.
   */
  abstract removeFromOwnerSelection(
    ownerId: string,
    selectedFriendId: string,
  ): Promise<void>;
}
