/**
 * Build a URL-safe form key from display name (matches API: lowercase a-z0-9_-).
 */
export function slugifyFormKey(name) {
  let s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!s) s = "form";
  if (s.length < 2) s = `${s}-form`.replace(/^-|-$/g, "") || "form";
  if (s.length > 100) s = s.slice(0, 100).replace(/-+$/, "");

  return s;
}

/**
 * Pick a key not present in existingKeys (e.g. admission-form, admission-form-1).
 */
export function pickUniqueFormKey(name, existingKeys) {
  const used = new Set(existingKeys);
  const base = slugifyFormKey(name);
  let key = base;
  let n = 0;
  while (used.has(key)) {
    n += 1;
    key = `${base}-${n}`;
  }
  return key;
}

/**
 * Build field key from label (API expects lowercase a-z0-9_).
 */
export function slugifyFieldKey(label) {
  let s = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!s) s = "field";
  if (s.length > 100) s = s.slice(0, 100).replace(/_+$/, "");

  return s;
}

/**
 * Pick a field key that is not used in the same form.
 */
export function pickUniqueFieldKey(label, existingKeys) {
  const used = new Set(existingKeys);
  const base = slugifyFieldKey(label);
  let key = base;
  let n = 0;
  while (used.has(key)) {
    n += 1;
    key = `${base}_${n}`;
  }
  return key;
}
