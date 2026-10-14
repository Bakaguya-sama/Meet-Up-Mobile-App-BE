import {
  EVENT_ERROR_CODES,
  isIntegrationEvent,
} from './integration-event.contract';

const eventId = 'a6d1f34d-09e9-49b5-bf30-3cb989dbd95c';

describe('integration event contract', () => {
  it('accepts a versioned event with an idempotency key', () => {
    expect(
      isIntegrationEvent({
        eventId,
        eventName: 'MeetupMemberChanged.v1',
        occurredAt: '2026-10-12T00:00:00.000Z',
        meetupId: '3cac3fec-7fb1-4ef4-8a4e-77f0177e510d',
        userId: '483379b5-6fbf-46b2-bab9-d67fbe1c5cbf',
        membershipStatus: 'accepted',
      }),
    ).toBe(true);
  });

  it('rejects unversioned events and sensitive location data', () => {
    expect(
      isIntegrationEvent({
        eventId,
        eventName: 'LocationUpdated',
        occurredAt: '2026-10-12T00:00:00.000Z',
        ownerId: '483379b5-6fbf-46b2-bab9-d67fbe1c5cbf',
        location: { visibility: 'approximate' },
      }),
    ).toBe(false);
    expect(
      isIntegrationEvent({
        eventId,
        eventName: 'LocationUpdated.v1',
        occurredAt: '2026-10-12T00:00:00.000Z',
        ownerId: '483379b5-6fbf-46b2-bab9-d67fbe1c5cbf',
        location: {
          visibility: 'exact',
          latitude: 10.7626,
          deviceToken: 'must-not-leak',
        },
      }),
    ).toBe(false);
  });

  it('publishes the agreed error-code vocabulary', () => {
    expect(EVENT_ERROR_CODES.EVENT_ALREADY_PROCESSED).toBe(
      'EVENT_ALREADY_PROCESSED',
    );
  });
});
