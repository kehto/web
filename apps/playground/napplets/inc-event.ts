interface IncEvent {
  topic: string;
  sender: string;
  payload?: unknown;
}

function isIncEvent(value: unknown): value is IncEvent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.topic === 'string' && typeof candidate.sender === 'string';
}

/** Read the payload from the canonical merged NAP-INC event callback. */
export function readIncPayload(value: unknown): unknown {
  return isIncEvent(value) ? value.payload : undefined;
}
