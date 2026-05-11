const { z } = require("zod");

const fieldType = z.enum(["text", "textarea", "email", "number", "password", "dropdown"]);

const passwordRuleFields = {
  passwordMinUppercase: z.number().int().min(0).max(64).optional(),
  passwordMinLowercase: z.number().int().min(0).max(64).optional(),
  passwordMinDigits: z.number().int().min(0).max(64).optional(),
  passwordMinSpecial: z.number().int().min(0).max(64).optional(),
};

const optionSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
});

const createFormSchema = z.object({
  name: z.string().trim().min(2).max(120),
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]+$/),
  isActive: z.boolean().optional(),
});

const createFieldSchema = z
  .object({
    fieldKey: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/),
    label: z.string().trim().min(1).max(120),
    type: fieldType,
    enabled: z.boolean().optional(),
    priority: z.number().int().min(1),
    required: z.boolean().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
    ...passwordRuleFields,
    options: z.array(optionSchema).optional(),
  })
  .refine(
    (value) => !(value.type === "dropdown" && (!value.options || value.options.length === 0)),
    "Dropdown requires at least one option"
  )
  .refine((value) => !(value.type !== "dropdown" && value.options?.length), "Only dropdown can have options")
  .refine(
    (value) => value.minLength === undefined || value.maxLength === undefined || value.minLength <= value.maxLength,
    "minLength must be less than or equal to maxLength"
  );

const updateFormSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    key: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]+$/).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, "Send at least one property to update");

const updateFieldSchema = z
  .object({
    fieldKey: z.string().trim().toLowerCase().regex(/^[a-z0-9_]+$/).optional(),
    label: z.string().trim().min(1).max(120).optional(),
    type: fieldType.optional(),
    enabled: z.boolean().optional(),
    priority: z.number().int().min(1).optional(),
    required: z.boolean().optional(),
    minLength: z.number().int().min(0).optional(),
    maxLength: z.number().int().min(0).optional(),
    ...passwordRuleFields,
    options: z.array(optionSchema).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, "Send at least one field to update")
  .refine(
    (value) => value.minLength === undefined || value.maxLength === undefined || value.minLength <= value.maxLength,
    "minLength must be less than or equal to maxLength"
  )
  .refine(
    (value) => !(value.type === "dropdown" && value.options !== undefined && value.options.length === 0),
    "Dropdown requires at least one option"
  )
  .refine(
    (value) => !(value.type !== undefined && value.type !== "dropdown" && value.options?.length),
    "Only dropdown can have options"
  );

function validateFormFieldDocument(field) {
  if (field.type === "dropdown") {
    if (!field.options || field.options.length === 0) {
      return "Dropdown requires at least one option";
    }
  } else if (field.options && field.options.length > 0) {
    return "Only dropdown can have options";
  }
  if (
    field.minLength !== undefined &&
    field.maxLength !== undefined &&
    field.minLength > field.maxLength
  ) {
    return "minLength must be less than or equal to maxLength";
  }
  if (field.type === "password") {
    const u = field.passwordMinUppercase ?? 0;
    const l = field.passwordMinLowercase ?? 0;
    const d = field.passwordMinDigits ?? 0;
    const s = field.passwordMinSpecial ?? 0;
    if ([u, l, d, s].some((n) => n < 0 || n > 64)) {
      return "Password rule counts must be between 0 and 64";
    }
    const sum = u + l + d + s;
    if (field.minLength != null && sum > field.minLength) {
      return "Minimum length must be at least the total of required uppercase, lowercase, digits, and special characters";
    }
  }
  return null;
}

module.exports = {
  createFormSchema,
  createFieldSchema,
  updateFormSchema,
  updateFieldSchema,
  validateFormFieldDocument,
};
