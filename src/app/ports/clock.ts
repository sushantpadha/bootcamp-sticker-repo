// Abstraction over Date.now() so flash scheduling and createdAt/lastUsedAt
// can be controlled in tests.
export interface Clock {
  now(): number; // milliseconds since epoch
}
