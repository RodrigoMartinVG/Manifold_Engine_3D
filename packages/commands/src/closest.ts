/**
 * "Did you mean…?": the declared name closest to one that does not exist.
 *
 * Closeness is measured with the EDIT DISTANCE (Levenshtein's): how many letters must be added,
 * removed or changed to go from one word to the other. "gravty" is 1 away from "gravity". It only
 * suggests if it is close (at most a third of the letters), and if the typed name is the start of
 * exactly one name, that one.
 */
export function closest(typed: string, names: readonly string[]): string | null {
  const starting = names.filter((n) => n.startsWith(typed));
  if (starting.length === 1) return starting[0]!;
  let best: string | null = null;
  let smallest = Math.max(1, Math.floor(typed.length / 3)) + 1;
  for (const n of names) {
    // Also against the last part of the name: "cubes" is close to "dojo.cubes".
    const last = n.slice(n.lastIndexOf('.') + 1);
    const d = Math.min(editDistance(typed, n), typed.includes('.') ? Infinity : editDistance(typed, last));
    if (d < smallest) {
      smallest = d;
      best = n;
    }
  }
  return best;
}

export function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const change = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + change);
    }
    previous = current;
  }
  return previous[b.length]!;
}
