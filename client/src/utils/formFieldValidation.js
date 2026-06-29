/**
 * Client-side validation for dynamic forms (no server submit).
 * Password "confirm" rows: type password, label suggests confirmation,
 * immediately after a non-confirm password field in priority order.
 * Confirm uses the same rules as the paired primary password field.
 */

function isLikelyConfirmPasswordLabel(label) {
  const s = String(label || "").toLowerCase();
  return (
    /\bconfirm\b/.test(s) ||
    /\bre-?enter\b/.test(s) ||
    /\bpassword\s+again\b/.test(s) ||
    /\bverify\s+password\b/.test(s)
  );
}

export function getPasswordConfirmPairs(fieldsSortedByPriority) {
  const pairs = [];
  let lastPlainPasswordKey = null;
  for (const f of fieldsSortedByPriority) {
    if (f.type !== "password") continue;
    if (isLikelyConfirmPasswordLabel(f.label) && lastPlainPasswordKey) {
      pairs.push({ passwordKey: lastPlainPasswordKey, confirmKey: f.fieldKey });
      lastPlainPasswordKey = null;
    } else if (!isLikelyConfirmPasswordLabel(f.label)) {
      lastPlainPasswordKey = f.fieldKey;
    }
  }
  return pairs;
}

function countUpper(value) {
  return (String(value).match(/[A-Z]/g) || []).length;
}
function countLower(value) {
  return (String(value).match(/[a-z]/g) || []).length;
}
function countDigits(value) {
  return (String(value).match(/[0-9]/g) || []).length;
}
function countSpecial(value) {
  return (String(value).match(/[^A-Za-z0-9]/g) || []).length;
}

function joinNatural(parts) {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

/** One-line hint for password fields (no per-character counters). */
export function getPasswordRequirementHint(ruleField) {
  if (!ruleField || ruleField.type !== "password") return "";
  const needU = ruleField.passwordMinUppercase ?? 0;
  const needL = ruleField.passwordMinLowercase ?? 0;
  const needD = ruleField.passwordMinDigits ?? 0;
  const needS = ruleField.passwordMinSpecial ?? 0;
  const minL = ruleField.minLength;
  const maxL = ruleField.maxLength;

  const bits = [];
  if (needU > 0) bits.push(needU === 1 ? "an uppercase letter" : `${needU} uppercase letters`);
  if (needL > 0) bits.push(needL === 1 ? "a lowercase letter" : `${needL} lowercase letters`);
  if (needD > 0) bits.push(needD === 1 ? "a number" : `${needD} numbers`);
  if (needS > 0) bits.push(needS === 1 ? "a special character" : `${needS} special characters`);

  let len = "";
  if (minL != null && maxL != null) len = `${minL}–${maxL} characters`;
  else if (minL != null) len = `at least ${minL} characters`;
  else if (maxL != null) len = `up to ${maxL} characters`;

  if (bits.length === 0 && !len) return "Choose a secure password.";

  const need = bits.length ? `Include ${joinNatural(bits)}.` : "";
  const lenPart = len ? `Use ${len}.` : "";
  return [lenPart, need].filter(Boolean).join(" ");
}

/** First human-readable error for submit validation, or null. */
export function passwordRuleViolations(ruleField, value) {
  if (!ruleField || ruleField.type !== "password") return null;
  const v = String(value ?? "");
  const needU = ruleField.passwordMinUppercase ?? 0;
  const needL = ruleField.passwordMinLowercase ?? 0;
  const needD = ruleField.passwordMinDigits ?? 0;
  const needS = ruleField.passwordMinSpecial ?? 0;
  const u = countUpper(v);
  const l = countLower(v);
  const d = countDigits(v);
  const s = countSpecial(v);
  if (u < needU) {
    return needU === 1 ? "Add an uppercase letter (A–Z)." : `Add ${needU - u} more uppercase letter(s).`;
  }
  if (l < needL) {
    return needL === 1 ? "Add a lowercase letter (a–z)." : `Add ${needL - l} more lowercase letter(s).`;
  }
  if (d < needD) {
    return needD === 1 ? "Add a number (0–9)." : `Add ${needD - d} more digit(s).`;
  }
  if (s < needS) {
    return needS === 1 ? "Add a special character (not a letter or digit)." : `Add ${needS - s} more special character(s).`;
  }
  if (ruleField.minLength != null && v.length < ruleField.minLength) {
    return `Use at least ${ruleField.minLength} characters.`;
  }
  if (ruleField.maxLength != null && v.length > ruleField.maxLength) {
    return `Use at most ${ruleField.maxLength} characters.`;
  }
  return null;
}

/**
 * Live errors for password + confirm fields only (for onChange updates).
 * @returns {Record<string, string>}
 */
export function computeLivePasswordErrors(fields, values) {
  const sorted = [...fields].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const pairs = getPasswordConfirmPairs(sorted);
  const confirmToPrimaryKey = new Map(pairs.map((p) => [p.confirmKey, p.passwordKey]));
  const fieldByKey = new Map(sorted.map((f) => [f.fieldKey, f]));
  /** @type {Record<string, string>} */
  const errors = {};

  for (const f of sorted) {
    if (f.type !== "password") continue;
    const key = f.fieldKey;
    const raw = values[key];
    const value = raw === undefined || raw === null ? "" : String(raw);
    const trimmed = value.trim();
    const ruleSource = confirmToPrimaryKey.has(key) ? fieldByKey.get(confirmToPrimaryKey.get(key)) : f;
    if (!ruleSource) continue;

    if (f.required && trimmed === "") {
      errors[key] = "This field is required.";
      continue;
    }
    if (!f.required && trimmed === "") continue;

    const pwErr = passwordRuleViolations(ruleSource, value);
    if (pwErr) errors[key] = pwErr;
  }

  for (const { passwordKey, confirmKey } of pairs) {
    const p = String(values[passwordKey] ?? "");
    const c = String(values[confirmKey] ?? "");
    if (c.length > 0 && p !== c) {
      errors[confirmKey] = "Passwords do not match.";
    }
  }

  return errors;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function textFieldHasOnlyLettersAndSpaces(value) {
  return !/[^\p{L}\s]/u.test(String(value ?? ""));
}

function alphanumericHasOnlyLettersDigitsAndSpaces(value) {
  return !/[^A-Za-z0-9\s]/.test(String(value ?? ""));
}

function isAllowedDocumentFile(file) {
  const allowedMimes = new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
  const mime = String(file?.type || "").toLowerCase();
  if (allowedMimes.has(mime)) return true;
  return /\.(pdf|doc|docx)$/i.test(String(file?.name || ""));
}

/** Shown under every `type: "text"` field so users know the rule before typing. */
export const TEXT_FIELD_LETTERS_ONLY_HINT =
  "Only letters and spaces. Numbers (0–9) and special characters (e.g. @, #, !) are not allowed.";

/**
 * If the value has content but breaks the letters-only rule, return a short error for live + submit validation.
 * @returns {string | null}
 */
export function getTextFieldLettersOnlyErrorIfInvalid(value) {
  const s = String(value ?? "");
  if (s.trim() === "") return null;
  if (textFieldHasOnlyLettersAndSpaces(s)) return null;
  return "Remove numbers and special characters — only letters and spaces are allowed here.";
}

export function validateFormFieldValues(fields, values) {
  /** @type {Record<string, string>} */
  const errors = {};
  const sorted = [...fields].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const pairs = getPasswordConfirmPairs(sorted);
  const confirmToPrimaryKey = new Map(pairs.map((p) => [p.confirmKey, p.passwordKey]));
  const fieldByKey = new Map(sorted.map((f) => [f.fieldKey, f]));

  for (const f of sorted) {
    const key = f.fieldKey;
    const raw = values[key];
    const value = raw === undefined || raw === null ? "" : String(raw);
    const trimmed = value.trim();

    if (f.type === "image") {
      const file = raw instanceof File ? raw : null;
      if (f.required && !file) {
        errors[key] = "Please upload an image.";
        continue;
      }
      if (!file) continue;
      if (!String(file.type || "").startsWith("image/")) {
        errors[key] = "Upload a valid image file.";
        continue;
      }
      continue;
    }

    if (f.type === "file") {
      const file = raw instanceof File ? raw : null;
      if (f.required && !file) {
        errors[key] = "Please upload a file.";
        continue;
      }
      if (!file) continue;
      if (!isAllowedDocumentFile(file)) {
        errors[key] = "Upload only PDF or Word files (.pdf, .doc, .docx).";
        continue;
      }
      continue;
    }

    if (f.type === "dropdown") {
      if (f.required && value === "") {
        errors[key] = "This field is required.";
      }
      continue;
    }

    if (f.required && trimmed === "") {
      errors[key] = "This field is required.";
      continue;
    }

    if (f.type === "number") {
      if (trimmed === "") continue;
      const n = Number(trimmed);
      if (!Number.isFinite(n)) {
        errors[key] = "Enter a valid number.";
      }
      continue;
    }

    if (f.type === "email" && trimmed !== "" && !EMAIL_RE.test(trimmed)) {
      errors[key] = "Enter a valid email address.";
      continue;
    }

    if (f.type === "password") {
      const ruleSource = confirmToPrimaryKey.has(key) ? fieldByKey.get(confirmToPrimaryKey.get(key)) : f;
      if (!ruleSource) continue;
      if (!f.required && trimmed === "") continue;
      const pwErr = passwordRuleViolations(ruleSource, value);
      if (pwErr) errors[key] = pwErr;
      continue;
    }

    if (f.type === "text") {
      const textFmt = getTextFieldLettersOnlyErrorIfInvalid(value);
      if (textFmt) {
        errors[key] = textFmt;
        continue;
      }
    }

    if (f.type === "alphanumeric") {
      if (trimmed !== "" && !alphanumericHasOnlyLettersDigitsAndSpaces(value)) {
        errors[key] = "Use only letters, numbers, and spaces.";
        continue;
      }
    }

    if (["text", "alphanumeric", "textarea", "email"].includes(f.type)) {
      const len = value.length;
      if (f.minLength != null && len > 0 && len < f.minLength) {
        errors[key] = `At least ${f.minLength} characters.`;
      }
      if (f.maxLength != null && len > f.maxLength) {
        errors[key] = `At most ${f.maxLength} characters.`;
      }
    }
  }

  for (const { passwordKey, confirmKey } of pairs) {
    const p = String(values[passwordKey] ?? "");
    const c = String(values[confirmKey] ?? "");
    if (p !== c) {
      errors[confirmKey] = "Passwords do not match.";
    }
  }

  const ok = Object.keys(errors).length === 0;
  return { errors, ok };
}
