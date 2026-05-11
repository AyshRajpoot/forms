/**
 * Finds integers in [1, maxUsed) that no field uses (gaps after deletes / missing slots).
 * @param {Array<{ priority?: number }>} fieldRows
 * @returns {string | null} One-line hint, or null if no gaps.
 */
export function getFreePrioritySlotsMessage(fieldRows) {
  const nums = fieldRows
    .map((f) => Number(f?.priority))
    .filter((n) => Number.isFinite(n) && n >= 1);
  if (nums.length === 0) return null;

  const used = new Set(nums);
  const max = Math.max(...nums);
  const gaps = [];
  for (let i = 1; i < max; i += 1) {
    if (!used.has(i)) gaps.push(i);
  }
  if (gaps.length === 0) return null;

  gaps.sort((a, b) => a - b);
  const parts = [];
  let start = gaps[0];
  let prev = gaps[0];
  for (let i = 1; i < gaps.length; i += 1) {
    const g = gaps[i];
    if (g === prev + 1) {
      prev = g;
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}–${prev}`);
    start = prev = g;
  }
  parts.push(start === prev ? String(start) : `${start}–${prev}`);

  const list = parts.join(", ");
  return `Empty priority slots (you can use one): ${list}.`;
}
