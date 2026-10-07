const ALLOWED_ENVIRONMENTS = ['development', 'test'];

/** The development seed creates well-known credentials, so it only runs in development or test environments. */
export function assertSeedAllowed(environment: NodeJS.ProcessEnv): string {
  const nodeEnv = (environment.NODE_ENV ?? '').trim().toLowerCase();
  if (!ALLOWED_ENVIRONMENTS.includes(nodeEnv)) {
    throw new Error(`The development seed only runs with NODE_ENV=development or NODE_ENV=test; refusing NODE_ENV=${nodeEnv || '(unset)'}.`);
  }
  const seedPassword = environment.SEED_USER_PASSWORD;
  if (!seedPassword) throw new Error('SEED_USER_PASSWORD must be set before running the development seed.');
  return seedPassword;
}
