const bcrypt = require("bcryptjs");

const PASSWORD_HASH_ROUNDS = 12;

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function isConfirmPasswordField(field) {
  const key = normalize(field.fieldKey);
  const label = normalize(field.label);
  return (
    (key.includes("confirm") && key.includes("password")) ||
    (label.includes("confirm") && label.includes("password"))
  );
}

function isPasswordLikeField(field) {
  const key = normalize(field.fieldKey);
  const label = normalize(field.label);
  return field.type === "password" || key.includes("password") || label.includes("password");
}

function isBcryptHash(value) {
  return typeof value === "string" && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
}

async function secureSubmissionPayload(fields, payload) {
  const input = payload && typeof payload === "object" ? payload : {};
  const secured = {};

  for (const field of fields) {
    if (!Object.prototype.hasOwnProperty.call(input, field.fieldKey)) {
      continue;
    }

    const value = input[field.fieldKey];
    if (isPasswordLikeField(field) && typeof value === "string" && value !== "" && !isBcryptHash(value)) {
      secured[field.fieldKey] = await bcrypt.hash(value, PASSWORD_HASH_ROUNDS);
      continue;
    }

    secured[field.fieldKey] = value;
  }

  return secured;
}

async function comparePasswordWithHash(plainText, hash) {
  if (typeof plainText !== "string" || typeof hash !== "string") {
    return false;
  }
  return bcrypt.compare(plainText, hash);
}

module.exports = {
  isConfirmPasswordField,
  isPasswordLikeField,
  isBcryptHash,
  secureSubmissionPayload,
  comparePasswordWithHash,
};
