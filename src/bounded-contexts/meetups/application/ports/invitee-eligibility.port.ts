export const INVITEE_ELIGIBILITY = Symbol('INVITEE_ELIGIBILITY');
export interface InviteeEligibilityPort {
  /** Accepted friends with active accounts only. Must use batched public APIs. */
  eligibleIds(organizerId: string, userIds: string[]): Promise<string[]>;
}
