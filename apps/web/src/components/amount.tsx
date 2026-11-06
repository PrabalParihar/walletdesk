"use client";

import NumberFlow from "@number-flow/react";

/**
 * A number that rolls to its new value instead of jumping, so a quote visibly reacts to the input that changed it.
 * NumberFlow skips the animation when the user prefers reduced motion.
 */
export function Amount({ value, digits = 4, className }: { value: number; digits?: number; className?: string }) {
  return (
    <NumberFlow
      value={Number.isFinite(value) ? value : 0}
      format={{ maximumFractionDigits: digits, useGrouping: true }}
      className={className}
      willChange
    />
  );
}
