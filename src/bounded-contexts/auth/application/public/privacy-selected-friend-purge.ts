/**
 * Outbound port — implemented by Auth, called by Friends when a friendship is
 * removed (unfriend / rejection purge). Keeps the contexts decoupled: Friends
 * never imports Auth internals; Auth never imports Friends internals.
 */
export abstract class PrivacySelectedFriendPurge {
  /**
   * Remove `removedId` from every user's `selected_friend_ids`.
   * Must be called within the same transaction that deletes/updates the
   * friendship row, or — when that is not possible — as a best-effort
   * background step. Idempotent; safe to retry.
   */
  abstract purge(removedId: string): Promise<void>;
}
