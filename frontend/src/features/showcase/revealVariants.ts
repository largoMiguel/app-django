/** Clases de entrada por scroll — combinar siempre con `animate`. */
export const reveal = {
  up: "animate animate-up",
  down: "animate animate-down",
  left: "animate animate-left",
  right: "animate animate-right",
  scale: "animate animate-scale",
  fade: "animate animate-fade",
  clip: "animate animate-clip",
} as const;

const CYCLE = [reveal.up, reveal.left, reveal.right, reveal.scale] as const;

export function revealCycle(index: number): string {
  return CYCLE[index % CYCLE.length];
}

export function revealAlternate(index: number, even = reveal.left, odd = reveal.right): string {
  return index % 2 === 0 ? even : odd;
}

const USE_CASE_ANIMS = [reveal.up, reveal.scale, reveal.right] as const;

export function revealUseCase(index: number): string {
  return USE_CASE_ANIMS[index % USE_CASE_ANIMS.length];
}
