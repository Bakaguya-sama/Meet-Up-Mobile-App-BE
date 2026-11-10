import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRecommendationTrafficWeatherContext1792160000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE recommendation_runs
      ADD COLUMN routing_preference_requested varchar(30) NOT NULL DEFAULT 'TRAFFIC_UNAWARE',
      ADD COLUMN routing_preference_effective varchar(30) NOT NULL DEFAULT 'TRAFFIC_UNAWARE',
      ADD COLUMN weather_policy_requested varchar(30) NOT NULL DEFAULT 'OFF',
      ADD COLUMN weather_policy_effective varchar(30) NOT NULL DEFAULT 'OFF',
      ADD COLUMN weather_policy_version varchar(100) NOT NULL DEFAULT 'weather-policy-v1',
      ADD CONSTRAINT chk_recommendation_runs_routing_preference CHECK (routing_preference_requested IN ('TRAFFIC_UNAWARE','TRAFFIC_AWARE') AND routing_preference_effective IN ('TRAFFIC_UNAWARE','TRAFFIC_AWARE')),
      ADD CONSTRAINT chk_recommendation_runs_weather_policy CHECK (weather_policy_requested IN ('OFF','WARN_ONLY','FILTER_OUTDOOR') AND weather_policy_effective IN ('OFF','WARN_ONLY','FILTER_OUTDOOR'))`);
    await queryRunner.query(
      'ALTER TABLE recommendation_candidates ADD COLUMN weather_evidence jsonb',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_places ADD COLUMN weather_evidence jsonb',
    );
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE recommendation_places DROP COLUMN weather_evidence',
    );
    await queryRunner.query(
      'ALTER TABLE recommendation_candidates DROP COLUMN weather_evidence',
    );
    await queryRunner.query(
      `ALTER TABLE recommendation_runs DROP CONSTRAINT chk_recommendation_runs_weather_policy, DROP CONSTRAINT chk_recommendation_runs_routing_preference, DROP COLUMN weather_policy_version, DROP COLUMN weather_policy_effective, DROP COLUMN weather_policy_requested, DROP COLUMN routing_preference_effective, DROP COLUMN routing_preference_requested`,
    );
  }
}
