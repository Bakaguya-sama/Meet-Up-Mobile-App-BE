import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

      await manager
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

      const saved = await manager.getRepository(FavoritePlaceEntity).findOneBy({
        userId,
        canonicalCandidateKey: candidate.canonicalCandidateKey,
      });
      return saved ? this.toFavorite(saved) : null;
    });
  }

  async list(userId: string): Promise<FavoritePlace[]> {
    const rows = await this.dataSource.getRepository(FavoritePlaceEntity).find({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
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
