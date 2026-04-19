function randomDelay(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min));
}

export function mockDelay<T>(value: T, min = 200, max = 500): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), randomDelay(min, max));
  });
}
