/**
 * Mock helper — geliştirmede API çağrısı taklidi için.
 *
 * Gerçek backend gelince feature api.ts dosyaları mock delay yerine
 * gerçek fetch çağırır; feature hook imzaları değişmez.
 */

export const IS_MOCK_AUTH = process.env.EXPO_PUBLIC_MOCK_AUTH === "true";

function randomDelay(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function mockDelay<T>(value: T, min = 200, max = 500): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), randomDelay(min, max));
  });
}
