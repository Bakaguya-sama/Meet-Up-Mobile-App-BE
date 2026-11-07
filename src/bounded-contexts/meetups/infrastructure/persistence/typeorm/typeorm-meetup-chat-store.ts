import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type {
  MeetupChatMessage,
  MeetupChatStore,
} from '../../../application/ports/meetup-chat-store.port';
import { MeetupChatMessageEntity } from './entities/meetup-chat-message.typeorm-entity';

@Injectable()
export class TypeOrmMeetupChatStore implements MeetupChatStore {
  constructor(private readonly dataSource: DataSource) {}

  async append(message: MeetupChatMessage): Promise<void> {
    await this.dataSource
      .getRepository(MeetupChatMessageEntity)
      .insert(message);
  }

  async list(input: { meetupId: string; before?: Date; limit: number }) {
    const query = this.dataSource
      .getRepository(MeetupChatMessageEntity)
      .createQueryBuilder('message')
      .where('message.meetupId = :meetupId', { meetupId: input.meetupId });
    if (input.before) {
      query.andWhere('message.sentAt < :before', { before: input.before });
    }
    const rows = await query
      .orderBy('message.sentAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(input.limit)
      .getMany();
    return rows.reverse();
  }
}
