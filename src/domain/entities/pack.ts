export interface Pack {
  id: string;
  name: string;
  createdAt: number;
}

export interface CreatePackInput {
  id: string;          // caller wires IdGenerator.uuid()
  name: string;
  createdAt: number;   // caller wires Clock.now()
}

// Pure entity factory. Enforces non-empty name invariant.
export function createPack(input: CreatePackInput): Pack {
  if (input.name.length === 0) throw new Error('Pack.name must be non-empty');
  return {
    id: input.id,
    name: input.name,
    createdAt: input.createdAt,
  };
}
