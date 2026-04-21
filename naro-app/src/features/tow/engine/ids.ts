let sequence = 0;

export function nextId(prefix: string): string {
  sequence += 1;
  const entropy = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${sequence}-${entropy}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function addSecondsIso(baseIso: string, seconds: number): string {
  const t = new Date(baseIso).getTime() + seconds * 1000;
  return new Date(t).toISOString();
}

export function generateOtpCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}
