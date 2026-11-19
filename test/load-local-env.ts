// Jest integration tests run locally from `.env`; they never load `.env.production`.
// Override inherited shell/IDE values so DATABASE_URL and REDIS_URL are exactly
// the local values selected by the developer in this repository.
import { config } from 'dotenv';

config({ path: '.env', override: true, quiet: true });
