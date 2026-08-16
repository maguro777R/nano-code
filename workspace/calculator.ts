export function add(a: number, b: number): number {
  return a + b;
}

export function calculateOnePlusOne(): number {
  return add(1, 1);
}

// Convenience default export
export default calculateOnePlusOne;
