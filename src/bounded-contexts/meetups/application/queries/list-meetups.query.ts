import { toMeetupSummary } from '../dto/meetup-response.dto';
import type { MeetupStorePort } from '../ports/persistence/meetup-store.port';

export class ListMeetupsQuery {
  constructor(private readonly store: MeetupStorePort) {}
  async execute(actorId: string, offset: number, limit: number) {
    const result = await this.store.listVisible({
      actorId: actorId.toLowerCase(),
      offset,
      limit,
    });
    return {
      items: result.items.map(toMeetupSummary),
      total: result.total,
      offset,
      limit,
    };
  }
}
