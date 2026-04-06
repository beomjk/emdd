function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

const DEFAULT_THRESHOLD = 3;

/**
 * Suggest the closest match from candidates.
 * Returns null if input is an exact match or nothing is within threshold.
 */
export function suggest(
  input: string,
  candidates: readonly string[],
  threshold = DEFAULT_THRESHOLD,
): string | null {
  const lower = input.toLowerCase();

  if (candidates.some(c => c.toLowerCase() === lower)) return null;

  let best: string | null = null;
  let bestDist = threshold + 1;

  for (const c of candidates) {
    const dist = levenshtein(lower, c.toLowerCase());
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }

  return bestDist <= threshold ? best : null;
}
