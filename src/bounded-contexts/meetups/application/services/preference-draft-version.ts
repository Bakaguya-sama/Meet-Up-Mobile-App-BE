import { createHash } from 'node:crypto';
import type { MeetupState } from '../../domain/aggregates/meetup.aggregate';

export const draftVersion = (data: unknown): string =>
  createHash('sha256').update(JSON.stringify(data)).digest('hex');
/** Any meetup edit conservatively invalidates an outstanding draft. */
export function memberDraftVersion(
  meetup: MeetupState,
  actorId: string,
): string {
  const member = meetup.participants.find((p) => p.userId === actorId);
  return draftVersion({
    updatedAt: meetup.updatedAt,
    status: member?.status,
    budgetVnd: member?.budgetVnd ?? null,
    preferences: [...(member?.preferences ?? [])].sort(
      (a, b) => a.activityTagId - b.activityTagId,
    ),
  });
}
