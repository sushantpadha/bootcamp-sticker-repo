import type { IdGenerator } from '../../app/ports/idGenerator';

export class CryptoIdGenerator implements IdGenerator {
  uuid(): string {
    return crypto.randomUUID();
  }
}
