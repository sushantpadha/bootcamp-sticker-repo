// Abstraction over crypto.randomUUID() so entity IDs can be controlled in tests.
export interface IdGenerator {
  uuid(): string;
}
