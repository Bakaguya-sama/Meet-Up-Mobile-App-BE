export const privacySettingsBodySchema = {
  type: 'object' as const,
  required: ['sharingMode', 'sharingExpiresAt', 'useApproximateLocation'],
  properties: {
    sharingMode: {
      type: 'string' as const,
      enum: ['off', 'friends', 'selected_friends', 'meetup_only'],
    },
    sharingExpiresAt: {
      type: 'string' as const,
      format: 'date-time',
      nullable: true,
      description:
        'Future timestamp with timezone; null means no time limit. Must be null when off.',
    },
    useApproximateLocation: { type: 'boolean' as const },
    nearbyFeatureEnabled: { type: 'boolean' as const, default: false },
    selectedFriendIds: {
      type: 'array' as const,
      maxItems: 100,
      uniqueItems: true,
      items: { type: 'string' as const, format: 'uuid' },
      description:
        'Required and nonempty only for selected_friends; default []. Friendship is rechecked at access time.',
    },
  },
};

export const privacySettingsSchema = {
  ...privacySettingsBodySchema,
  required: [
    ...privacySettingsBodySchema.required,
    'nearbyFeatureEnabled',
    'selectedFriendIds',
    'isLocationSharingEnabled',
    'updatedAt',
  ],
  properties: {
    ...privacySettingsBodySchema.properties,
    isLocationSharingEnabled: {
      type: 'boolean' as const,
      description: 'Effective status, accounting for expiry at server time.',
    },
    updatedAt: { type: 'string' as const, format: 'date-time', nullable: true },
  },
};
