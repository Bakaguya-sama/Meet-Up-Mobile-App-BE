import { Test } from '@nestjs/testing';
import {
  type ExecutionContext,
  type INestApplication,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/configure-app';
import { FindPlaceCandidatesUseCase } from '../src/bounded-contexts/recommendations/application/use-cases/find-place-candidates.use-case';
import { RecommendationsController } from '../src/bounded-contexts/recommendations/presentation/http/recommendations.controller';
import { AccessTokenGuard } from '../src/presentation/http/guards/access-token.guard';
import { RecommendationError } from '../src/bounded-contexts/recommendations/domain/recommendation.error';

describe('BE-13 candidate-only HTTP contract', () => {
  const actorId = 'aaaaaaaa-0000-4000-8000-000000000001';
  const meetupId = 'bbbbbbbb-0000-4000-8000-000000000002';
  let app: INestApplication<App>;
  const findCandidates = { execute: jest.fn() };

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [RecommendationsController],
      providers: [
        { provide: FindPlaceCandidatesUseCase, useValue: findCandidates },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            app: { apiPrefix: 'api/v1', swaggerEnabled: false },
          }),
        },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          const req = context
            .switchToHttp()
            .getRequest<Request & { user: { id: string; roles: string[] } }>();
          if (req.headers.authorization !== `Bearer ${actorId}`) {
            throw new UnauthorizedException();
          }
          req.user = { id: actorId, roles: ['user'] };
          return true;
        },
      })
      .compile();
    app = fixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => app.close());
  beforeEach(() => jest.resetAllMocks());

  it.each([
    ['MEETUP_NOT_FOUND', 404],
    ['MEETUP_FORBIDDEN', 403],
    ['MEETUP_INSUFFICIENT_PARTICIPANTS', 400],
    ['RECOMMENDATION_INSUFFICIENT_LOCATIONS', 400],
    ['PLACE_SEARCH_UNAVAILABLE', 503],
  ])('maps %s to the documented HTTP %i error', async (code, status) => {
    findCandidates.execute.mockRejectedValue(
      new RecommendationError(code, code),
    );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/meetups/${meetupId}/recommendations/candidates`)
      .set('Authorization', `Bearer ${actorId}`)
      .expect(status);

    expect(response.body).toMatchObject({ statusCode: status, code });
  });
});
