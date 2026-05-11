import { getPasswordRequirementHint } from "../utils/formFieldValidation";

/**
 * Single-line hint, or the same slot shows a specific validation error.
 * ruleField: field that defines rules (primary password, even for confirm input).
 */
export function PasswordHint({ ruleField, error }) {
  if (!ruleField || ruleField.type !== "password") return null;

  if (error) {
    return (
      <p className="password-hint password-hint-error" role="alert">
        {error}
      </p>
    );
  }

  const hint = getPasswordRequirementHint(ruleField);
  if (!hint) return null;

  return (
    <p className="password-hint password-hint-muted" aria-live="polite">
      {hint}
    </p>
  );
}
