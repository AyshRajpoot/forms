function validateByType(field, rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    if (field.required) return "This field is required";
    return null;
  }

  const value = rawValue;

  if (field.type === "email") {
    if (typeof value !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Invalid email format";
    }
  }

  if (field.type === "number") {
    const num = Number(value);
    if (Number.isNaN(num)) return "Value must be a number";
  }

  if (["text", "textarea", "email", "password"].includes(field.type)) {
    if (typeof value !== "string") return "Value must be a string";
    if (field.minLength !== undefined && value.length < field.minLength) return `Minimum length is ${field.minLength}`;
    if (field.maxLength !== undefined && value.length > field.maxLength) return `Maximum length is ${field.maxLength}`;
  }

  const normalizedKey = String(field.fieldKey || "").toLowerCase();
  const normalizedLabel = String(field.label || "").toLowerCase();
  const looksLikeNameField =
    field.type === "text" &&
    (normalizedKey.includes("name") || normalizedLabel.includes("name"));
  if (looksLikeNameField) {
    if (typeof value !== "string" || !/^[a-zA-Z\s'-]+$/.test(value.trim())) {
      return "This is not a valid name";
    }
  }

  if (field.type === "dropdown") {
    const allowedValues = (field.options || []).map((x) => x.value);
    if (!allowedValues.includes(value)) return "Selected option is invalid";
  }

  return null;
}

function validateSubmission(fields, payload) {
  const body = payload || {};
  const errors = {};
  const allowedKeys = new Set(fields.map((field) => field.fieldKey));

  for (const key of Object.keys(body)) {
    if (!allowedKeys.has(key)) errors[key] = "Unknown field is not allowed";
  }

  for (const field of fields) {
    const message = validateByType(field, body[field.fieldKey]);
    if (message) errors[field.fieldKey] = message;
  }

  // Cross-field validation: password and confirm password must match.
  const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const isConfirmPasswordField = (field) => {
    const key = normalize(field.fieldKey);
    const label = normalize(field.label);
    return (
      field.type === "password" &&
      ((key.includes("confirm") && key.includes("password")) ||
        (label.includes("confirm") && label.includes("password")))
    );
  };

  const isMainPasswordField = (field) => {
    const key = normalize(field.fieldKey);
    const label = normalize(field.label);
    const looksLikePassword = key.includes("password") || label.includes("password");
    return field.type === "password" && looksLikePassword && !isConfirmPasswordField(field);
  };

  const passwordField = fields.find(isMainPasswordField);
  const confirmPasswordField = fields.find(isConfirmPasswordField);

  if (passwordField && confirmPasswordField) {
    const passwordValue = body[passwordField.fieldKey];
    const confirmValue = body[confirmPasswordField.fieldKey];
    if (
      passwordValue !== undefined &&
      confirmValue !== undefined &&
      passwordValue !== confirmValue
    ) {
      errors[confirmPasswordField.fieldKey] = "Confirm password must match password";
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

module.exports = { validateSubmission };
