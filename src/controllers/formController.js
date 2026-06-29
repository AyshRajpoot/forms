const Form = require("../models/Form");
const FormField = require("../models/FormField");
const Submission = require("../models/Submission");

async function getActiveFields(req, res, next) {
  const { formKey } = req.params;
  try {
    const form = await Form.findOne({ key: formKey, isActive: true }).lean();
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    const fields = await FormField.find({ formId: form._id, enabled: true })
      .sort({ priority: 1 })
      .select("-createdAt -updatedAt -__v -formId")
      .lean();

    return res.status(200).json({
      form: {
        id: form._id,
        key: form.key,
        name: form.name,
      },
      fields,
    });
  } catch (error) {
    return next(error);
  }
}

async function submitFormResponse(req, res, next) {
  const { formKey } = req.params;
  const values = { ...(req.body || {}) };
  const uploadedFiles = Array.isArray(req.files) ? req.files : [];

  try {
    const form = await Form.findOne({ key: formKey, isActive: true });
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    const fields = await FormField.find({ formId: form._id, enabled: true }).sort({ priority: 1 });

    const errors = {};
    const filesByField = new Map(uploadedFiles.map((file) => [file.fieldname, file]));

    // Helper functions for validation
    const countUpper = (v) => (String(v).match(/[A-Z]/g) || []).length;
    const countLower = (v) => (String(v).match(/[a-z]/g) || []).length;
    const countDigits = (v) => (String(v).match(/[0-9]/g) || []).length;
    const countSpecial = (v) => (String(v).match(/[^A-Za-z0-9]/g) || []).length;
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const textFieldHasOnlyLettersAndSpaces = (v) => !/[^\p{L}\s]/u.test(String(v ?? ""));
    const alphanumericHasOnlyLettersDigitsAndSpaces = (v) => !/[^A-Za-z0-9\s]/.test(String(v ?? ""));
    const allowedDocMimes = new Set([
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]);
    const hasAllowedDocExtension = (name) => /\.(pdf|doc|docx)$/i.test(String(name || ""));

    // Find password confirm pairs
    const isLikelyConfirmPasswordLabel = (label) => {
      const s = String(label || "").toLowerCase();
      return (
        /\bconfirm\b/.test(s) ||
        /\bre-?enter\b/.test(s) ||
        /\bpassword\s+again\b/.test(s) ||
        /\bverify\s+password\b/.test(s)
      );
    };

    const confirmToPrimaryKey = new Map();
    let lastPlainPasswordKey = null;
    for (const f of fields) {
      if (f.type !== "password") continue;
      if (isLikelyConfirmPasswordLabel(f.label) && lastPlainPasswordKey) {
        confirmToPrimaryKey.set(f.fieldKey, lastPlainPasswordKey);
        lastPlainPasswordKey = null;
      } else if (!isLikelyConfirmPasswordLabel(f.label)) {
        lastPlainPasswordKey = f.fieldKey;
      }
    }

    for (const f of fields) {
      const key = f.fieldKey;
      const raw = values[key];
      const value = raw === undefined || raw === null ? "" : String(raw);
      const trimmed = value.trim();

      if (f.type === "image") {
        const file = filesByField.get(key);
        if (f.required && !file) {
          errors[key] = "Please upload an image.";
          continue;
        }
        if (!file) continue;
        if (!String(file.mimetype || "").startsWith("image/")) {
          errors[key] = "Upload a valid image file.";
        }
        continue;
      }

      if (f.type === "file") {
        const file = filesByField.get(key);
        if (f.required && !file) {
          errors[key] = "Please upload a file.";
          continue;
        }
        if (!file) continue;
        const mime = String(file.mimetype || "").toLowerCase();
        if (!allowedDocMimes.has(mime) && !hasAllowedDocExtension(file.originalname)) {
          errors[key] = "Upload only PDF or Word files (.pdf, .doc, .docx).";
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
        const ruleSource = confirmToPrimaryKey.has(key) ? fields.find(field => field.fieldKey === confirmToPrimaryKey.get(key)) : f;
        if (!ruleSource) continue;
        if (!f.required && trimmed === "") continue;

        const needU = ruleSource.passwordMinUppercase ?? 0;
        const needL = ruleSource.passwordMinLowercase ?? 0;
        const needD = ruleSource.passwordMinDigits ?? 0;
        const needS = ruleSource.passwordMinSpecial ?? 0;
        const u = countUpper(value);
        const l = countLower(value);
        const d = countDigits(value);
        const s = countSpecial(value);

        if (u < needU) {
          errors[key] = needU === 1 ? "Add an uppercase letter (A–Z)." : `Add ${needU - u} more uppercase letter(s).`;
        } else if (l < needL) {
          errors[key] = needL === 1 ? "Add a lowercase letter (a–z)." : `Add ${needL - l} more lowercase letter(s).`;
        } else if (d < needD) {
          errors[key] = needD === 1 ? "Add a number (0–9)." : `Add ${needD - d} more digit(s).`;
        } else if (s < needS) {
          errors[key] = needS === 1 ? "Add a special character (not a letter or digit)." : `Add ${needS - s} more special character(s).`;
        } else if (ruleSource.minLength != null && value.length < ruleSource.minLength) {
          errors[key] = `Use at least ${ruleSource.minLength} characters.`;
        } else if (ruleSource.maxLength != null && value.length > ruleSource.maxLength) {
          errors[key] = `Use at most ${ruleSource.maxLength} characters.`;
        }
        continue;
      }

      if (f.type === "text") {
        if (trimmed !== "" && !textFieldHasOnlyLettersAndSpaces(value)) {
          errors[key] = "Remove numbers and special characters — only letters and spaces are allowed here.";
          continue;
        }
      }

      if (f.type === "alphanumeric") {
        if (trimmed !== "" && !alphanumericHasOnlyLettersDigitsAndSpaces(value)) {
          errors[key] = "Use only letters, numbers, and spaces.";
          continue;
        }
      }

      if (["text", "textarea", "email", "alphanumeric"].includes(f.type)) {
        const len = value.length;
        if (f.minLength != null && len > 0 && len < f.minLength) {
          errors[key] = `At least ${f.minLength} characters.`;
        }
        if (f.maxLength != null && len > f.maxLength) {
          errors[key] = `At most ${f.maxLength} characters.`;
        }
      }
    }

    // Password matches check
    for (const [confirmKey, passwordKey] of confirmToPrimaryKey.entries()) {
      const p = String(values[passwordKey] ?? "");
      const c = String(values[confirmKey] ?? "");
      if (p !== c) {
        errors[confirmKey] = "Passwords do not match.";
      }
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ message: "Validation failed", errors });
    }

    for (const f of fields) {
      if (!["image", "file"].includes(f.type)) continue;
      const file = filesByField.get(f.fieldKey);
      if (!file) {
        if (!(f.fieldKey in values)) values[f.fieldKey] = "";
        continue;
      }
      values[f.fieldKey] = {
        filename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        base64: file.buffer.toString("base64"),
      };
    }

    const submission = await Submission.create({
      form: form._id,
      data: values,
      answers: values,
    });

    return res.status(201).json({
      message: "Submission successful",
      submissionId: submission._id,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getActiveFields,
  submitFormResponse,
};
