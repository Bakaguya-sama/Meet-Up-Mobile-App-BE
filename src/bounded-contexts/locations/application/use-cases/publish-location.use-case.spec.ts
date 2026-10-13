import type { LocationPort } from '../ports/location.port';
import { LocationAccessService } from '../services/location-access.service';
import { PublishLocationUseCase } from './publish-location.use-case';

describe('PublishLocationUseCase', () => {
  const input = {
    ownerId: 'owner-id',
    latitude: 10.776923,
    longitude: 106.700947,
    accuracy: 12,
    recordedAt: '2026-10-12T00:00:00.000Z',
  };
  let access: jest.Mocked<Pick<LocationAccessService, 'requirePublish'>>;
  let requirePublish: jest.Mock;
  let save: jest.Mock;
  let locations: jest.Mocked<LocationPort>;
  let useCase: PublishLocationUseCase;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(input.recordedAt));
    requirePublish = jest.fn().mockResolvedValue(undefined);
    access = { requirePublish };
    save = jest.fn().mockResolvedValue(undefined);
    locations = {
      save,
      get: jest.fn(),
      remove: jest.fn(),
    };
    useCase = new PublishLocationUseCase(
      access as LocationAccessService,
      locations,
    );
  });

  afterEach(() => jest.useRealTimers());

  it('checks current publish consent before storing a five-minute sample', async () => {
    await expect(useCase.execute(input)).resolves.toEqual({
      accepted: true,
      expiresInSeconds: 300,
    });
    expect(requirePublish).toHaveBeenCalledWith('owner-id', undefined);
    expect(save).toHaveBeenCalledWith('owner-id', {
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      recordedAt: new Date(input.recordedAt),
    });
  });

  it('rejects stale data before it can be persisted', async () => {
    await expect(
      useCase.execute({
        ...input,
        recordedAt: '2026-10-11T23:55:00.000Z',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_LOCATION_SAMPLE' });
    expect(requirePublish).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('never writes when privacy denies publishing', async () => {
    requirePublish.mockRejectedValue({ code: 'LOCATION_ACCESS_DENIED' });
    await expect(useCase.execute(input)).rejects.toMatchObject({
      code: 'LOCATION_ACCESS_DENIED',
    });
    expect(save).not.toHaveBeenCalled();
  });
});
