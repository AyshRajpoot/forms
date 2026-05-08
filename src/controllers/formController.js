const Form = require("../models/Form");
const FormField = require("../models/FormField");
const FormSubmission = require("../models/FormSubmission");
const { validateSubmission } = require("../validators/submissionValidator");
const { secureSubmissionPayload } = require("../utils/submissionSecurity");

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

async function submitForm(req, res, next) {
  const { formKey } = req.params;
  try {
    const form = await Form.findOne({ key: formKey, isActive: true });
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    const fields = await FormField.find({ formId: form._id, enabled: true }).sort({ priority: 1 }).lean();
    const validation = validateSubmission(fields, req.body || {});
    if (!validation.isValid) {
      return res.status(400).json({
        message: "Submission validation failed",
        errors: validation.errors,
      });
    }

    const securedPayload = await secureSubmissionPayload(fields, req.body || {});
    const submission = await FormSubmission.create({
      formId: form._id,
      payload: securedPayload,
    });

    return res.status(201).json({
      message: "Submission stored",
      submissionId: submission._id,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getActiveFields,
  submitForm,
};
