const Form = require("../models/Form");
const FormField = require("../models/FormField");

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

module.exports = {
  getActiveFields,
};
