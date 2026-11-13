import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import type {
  FavoritePlace,
  FavoritePlaceStore,
} from '../../../application/ports/favorite-place-store.port';
import { RecommendationCandidateEntity } from './entities/recommendation-candidate.typeorm-entity';
import { FavoritePlaceEntity } from './entities/favorite-place.typeorm-entity';

@Injectable()
export class TypeOrmFavoritePlaceStore implements FavoritePlaceStore {
  constructor(private readonly dataSource: DataSource) {}

  async add(userId: string, placeId: string): Promise<FavoritePlace | null> {
    return this.dataSource.transaction(async (manager) => {
      const candidate = await manager
        .getRepository(RecommendationCandidateEntity)
        .createQueryBuilder('candidate')
        .where(
          'candidate.providerPlaceId = :placeId OR candidate.canonicalCandidateKey = :placeId',
          { placeId },
        )
        .orderBy('candidate.createdAt', 'DESC')
        .getOne();
      if (!candidate) return null;
      const insert = await manager
        .createQueryBuilder()
        .insert()
        .into(FavoritePlaceEntity)
        .values({
          id: randomUUID(),
          userId,
          provider: candidate.provider,
          providerPlaceId: candidate.providerPlaceId,
          canonicalCandidateKey: candidate.canonicalCandidateKey,
          placeName: candidate.name,
          createdAt: new Date(),
        })
        .onConflict('(user_id, canonical_candidate_key) DO NOTHING')
        .execute();
      // A first favorite is a durable feedback signal.  Keep it in this same
      // transaction so a failed feedback write rolls back the favorite too.
      if (insert.identifiers.length > 0) {
        const participants = await manager.query<Array<{ id: string }>>(
          `SELECT participant.id
             FROM meetup_participants participant
             INNER JOIN recommendation_runs run ON run.meetup_id = participant.meetup_id
            WHERE run.id = $1 AND participant.user_id = $2
              AND participant.status = 'accepted'`,
          [candidate.runId, userId.toLowerCase()],
        );
        if (participants[0]) {
          const eventId = randomUUID();
          const occurredAt = new Date();
          const payload = {
            eventId,
            runId: candidate.runId,
            meetupParticipantId: participants[0].id,
            eventType: 'FAVORITE_ADDED',
            canonicalCandidateKey: candidate.canonicalCandidateKey,
            occurredAt: occurredAt.toISOString(),
          };
          await manager.query(
            `INSERT INTO recommendation_feedback_events
              (event_id, run_id, meetup_participant_id, event_type,
               canonical_candidate_key, payload_hash, occurred_at, metadata, created_at)
             VALUES ($1, $2, $3, 'FAVORITE_ADDED', $4, $5, $6, '{}'::jsonb, NOW())`,
            [
              eventId,
              candidate.runId,
              participants[0].id,
              candidate.canonicalCandidateKey,
              createHash('sha256')
                .update(JSON.stringify(payload))
                .digest('hex'),
              occurredAt,
            ],
          );
        }
      }
      const saved = await manager.getRepository(FavoritePlaceEntity).findOneBy({
        userId,
        canonicalCandidateKey: candidate.canonicalCandidateKey,
      });
      return saved ? this.toFavorite(saved) : null;
    });
  }

  async list(userId: string): Promise<FavoritePlace[]> {
    const rows = await this.dataSource
      .getRepository(FavoritePlaceEntity)
      .find({ where: { userId }, order: { createdAt: 'DESC', id: 'DESC' } });
    return rows.map((row) => this.toFavorite(row));
  }

  async remove(userId: string, placeId: string): Promise<void> {
    await this.dataSource
      .getRepository(FavoritePlaceEntity)
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere(
        '(provider_place_id = :placeId OR canonical_candidate_key = :placeId)',
        { placeId },
      )
      .execute();
  }

  private toFavorite(row: FavoritePlaceEntity): FavoritePlace {
    return {
      id: row.id,
      provider: row.provider,
      providerPlaceId: row.providerPlaceId,
      canonicalCandidateKey: row.canonicalCandidateKey,
      placeName: row.placeName,
      createdAt: row.createdAt,
    };
  }
}
