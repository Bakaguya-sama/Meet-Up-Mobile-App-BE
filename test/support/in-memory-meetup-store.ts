import type { MeetupStorePort } from '../../src/bounded-contexts/meetups/application/ports/persistence/meetup-store.port';
import {
  Meetup,
  type MeetupState,
} from '../../src/bounded-contexts/meetups/domain/aggregates/meetup.aggregate';
import { MeetupError } from '../../src/bounded-contexts/meetups/domain/errors/meetup.error';
import type { IntegrationEvent } from '../../src/shared-kernel/application/integration-event.contract';
import type { OutboxDestination } from '../../src/shared-kernel/application/outbox.port';
import { writeMeetupEvents } from '../../src/bounded-contexts/meetups/infrastructure/persistence/typeorm/meetup-outbox';

export class InMemoryMeetupStore implements MeetupStorePort {
  readonly rows = new Map<string, MeetupState>();
  readonly deliveries: {
    event: IntegrationEvent;
    destination: OutboxDestination;
    recipientIds?: string[];
  }[] = [];

  async insert(meetup: Meetup): Promise<void> {
    await this.persist(meetup);
  }
  async updateLocked(
    id: string,
    change: (meetup: Meetup) => void | Promise<void>,
  ) {
    const state = this.rows.get(id);
    if (!state) throw new MeetupError('MEETUP_NOT_FOUND', 'Meetup not found');
    const meetup = Meetup.reconstitute(state);
    await change(meetup);
    await this.persist(meetup);
    return meetup.snapshot();
  }
  findVisible(id: string, actorId: string) {
    const state = this.rows.get(id);
    const visible = state?.participants.some(
      (p) => p.userId === actorId && ['invited', 'accepted'].includes(p.status),
    );
    return Promise.resolve(visible ? structuredClone(state!) : null);
  }
  listVisible(input: { actorId: string; offset: number; limit: number }) {
    const visible = [...this.rows.values()].filter((state) =>
      state.participants.some(
        (p) =>
          p.userId === input.actorId &&
          ['invited', 'accepted'].includes(p.status),
      ),
    );
    return Promise.resolve({
      items: structuredClone(
        visible.slice(input.offset, input.offset + input.limit),
      ),
      total: visible.length,
    });
  }
  areAcceptedInActiveMeetup(meetupId: string, userIds: string[]) {
    const state = this.rows.get(meetupId);
    return Promise.resolve(
      !!state &&
        ['inviting', 'choosing', 'selected'].includes(state.status) &&
        userIds.every((id) =>
          state.participants.some(
            (p) => p.userId === id && p.status === 'accepted',
          ),
        ),
    );
  }
  private async persist(meetup: Meetup) {
    await writeMeetupEvents(meetup, {
      add: (event, delivery) => {
        this.deliveries.push({ event, ...delivery });
        return Promise.resolve();
      },
    });
    this.rows.set(meetup.snapshot().id, meetup.snapshot());
  }
}
