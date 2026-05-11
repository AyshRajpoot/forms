const Form = require("../models/Form");
const FormField = require("../models/FormField");
const { validateFormFieldDocument } = require("../validators/adminValidators");

function normalizeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

async function createForm(req, res, next) {
  try {
    const form = await Form.create(req.body);
    return res.status(201).json(form);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Form key already exists" });
    }
    return next(error);
  }
}

async function listForms(req, res, next) {
  try {
    const forms = await Form.find().sort({ updatedAt: -1 }).lean();
    return res.status(200).json(forms);
  } catch (error) {
    return next(error);
  }
}

async function getForm(req, res, next) {
  try {
    const form = await Form.findById(req.params.formId).lean();
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }
    return res.status(200).json(form);
  } catch (error) {
    return next(error);
  }
}

async function updateForm(req, res, next) {
  try {
    const form = await Form.findById(req.params.formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    if (req.body.key !== undefined && req.body.key !== form.key) {
      const keyTaken = await Form.exists({ key: req.body.key, _id: { $ne: form._id } });
      if (keyTaken) {
        return res.status(409).json({ message: "Form key already exists" });
      }
    }

    Object.assign(form, req.body);
    await form.save();
    return res.status(200).json(form);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Form key already exists" });
    }
    return next(error);
  }
}

async function deleteForm(req, res, next) {
  const { formId } = req.params;
  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    await FormField.deleteMany({ formId: form._id });
    await form.deleteOne();

    return res.status(200).json({ message: "Form and related fields deleted" });
  } catch (error) {
    return next(error);
  }
}

async function createField(req, res, next) {
  const { formId } = req.params;

  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    const priorityExists = await FormField.exists({ formId, priority: req.body.priority });
    if (priorityExists) {
      return res.status(409).json({ message: "Priority already in use" });
    }

    const requestedLabel = normalizeLabel(req.body.label);
    if (requestedLabel) {
      const existingFields = await FormField.find({ formId }).select("label").lean();
      const duplicateLabel = existingFields.some((item) => normalizeLabel(item.label) === requestedLabel);
      if (duplicateLabel) {
        return res.status(409).json({ message: "Field already exists" });
      }
    }

    const field = await FormField.create({ formId, ...req.body });
    return res.status(201).json(field);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Field key already exists for this form" });
    }
    return next(error);
  }
}

async function listFields(req, res, next) {
  const { formId } = req.params;
  try {
    const form = await Form.findById(formId);
    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    const fields = await FormField.find({ formId }).sort({ priority: 1 }).lean();
    return res.status(200).json(fields);
  } catch (error) {
    return next(error);
  }
}

async function getField(req, res, next) {
  try {
    const field = await FormField.findById(req.params.fieldId).lean();
    if (!field) {
      return res.status(404).json({ message: "Field not found" });
    }
    return res.status(200).json(field);
  } catch (error) {
    return next(error);
  }
}

async function updateField(req, res, next) {
  const { fieldId } = req.params;

  try {
    const field = await FormField.findById(fieldId);
    if (!field) {
      return res.status(404).json({ message: "Field not found" });
    }

    Object.assign(field, req.body);

    if (field.type !== "dropdown") {
      field.options = [];
    }

    const ruleError = validateFormFieldDocument(field.toObject());
    if (ruleError) {
      return res.status(400).json({ message: ruleError });
    }

    if (req.body.priority !== undefined) {
      const priorityTaken = await FormField.exists({
        formId: field.formId,
        priority: field.priority,
        _id: { $ne: field._id },
      });
      if (priorityTaken) {
        return res.status(409).json({ message: "Priority already in use" });
      }
    }

    if (req.body.fieldKey !== undefined) {
      const keyTaken = await FormField.exists({
        formId: field.formId,
        fieldKey: field.fieldKey,
        _id: { $ne: field._id },
      });
      if (keyTaken) {
        return res.status(409).json({ message: "Field key already exists for this form" });
      }
    }

    if (req.body.label !== undefined) {
      const requestedLabel = normalizeLabel(field.label);
      const existingFields = await FormField.find({ formId: field.formId, _id: { $ne: field._id } })
        .select("label")
        .lean();
      const duplicateLabel = existingFields.some((item) => normalizeLabel(item.label) === requestedLabel);
      if (duplicateLabel) {
        return res.status(409).json({ message: "Field already exists" });
      }
    }

    await field.save();
    return res.status(200).json(field);
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Field key or priority conflict for this form" });
    }
    return next(error);
  }
}

async function deleteField(req, res, next) {
  try {
    const field = await FormField.findById(req.params.fieldId);
    if (!field) {
      return res.status(404).json({ message: "Field not found" });
    }

    await field.deleteOne();
    return res.status(200).json({ message: "Field deleted" });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createForm,
  listForms,
  getForm,
  updateForm,
  deleteForm,
  createField,
  listFields,
  getField,
  updateField,
  deleteField,
};
