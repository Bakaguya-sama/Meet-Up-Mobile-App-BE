export interface OAuthIdentityState {
  id: string;
  userAccountId: string;
  provider: 'google';
  providerAccountId: string;
  providerEmail: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class OAuthIdentity {
  constructor(private readonly state: OAuthIdentityState) {}

  snapshot(): OAuthIdentityState {
    return { ...this.state };
  }
}
