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

    let priorityNotice = null;
    const occupant = await FormField.findOne({ formId, priority: req.body.priority }).select("_id label priority");
    if (occupant) {
      const maxRow = await FormField.find({ formId })
        .sort({ priority: -1 })
        .limit(1)
        .select("priority")
        .lean();
      const newSlot = (maxRow[0]?.priority ?? 0) + 1;
      const occupantDoc = await FormField.findById(occupant._id);
      occupantDoc.priority = newSlot;
      await occupantDoc.save();
      priorityNotice = `"${occupantDoc.label}" moved to ${newSlot}. This field is ${req.body.priority}.`;
    }

    const requestedLabel = normalizeLabel(req.body.label);
    if (requestedLabel) {
      const existingFields = await FormField.find({ formId }).select("label").lean();
      const duplicateLabel = existingFields.some((item) => normalizeLabel(item.label) === requestedLabel);
      if (duplicateLabel) {
        return res.status(409).json({ message: "Field already exists" });
      }
    }

    const body = { formId, ...req.body };
    if (body.type !== "password") {
      delete body.passwordMinUppercase;
      delete body.passwordMinLowercase;
      delete body.passwordMinDigits;
      delete body.passwordMinSpecial;
    } else {
      body.passwordMinUppercase = body.passwordMinUppercase ?? 1;
      body.passwordMinLowercase = body.passwordMinLowercase ?? 1;
      body.passwordMinDigits = body.passwordMinDigits ?? 1;
      body.passwordMinSpecial = body.passwordMinSpecial ?? 1;
    }

    const field = await FormField.create(body);
    const payload = { field };
    if (priorityNotice) payload.priorityNotice = priorityNotice;
    return res.status(201).json(payload);
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

    const previousPriority = field.priority;

    Object.assign(field, req.body);

    if (field.type !== "dropdown") {
      field.options = [];
    }

    if (field.type !== "password") {
      field.passwordMinUppercase = undefined;
      field.passwordMinLowercase = undefined;
      field.passwordMinDigits = undefined;
      field.passwordMinSpecial = undefined;
    } else {
      if (field.passwordMinUppercase == null) field.passwordMinUppercase = 1;
      if (field.passwordMinLowercase == null) field.passwordMinLowercase = 1;
      if (field.passwordMinDigits == null) field.passwordMinDigits = 1;
      if (field.passwordMinSpecial == null) field.passwordMinSpecial = 1;
    }

    const ruleError = validateFormFieldDocument(field.toObject());
    if (ruleError) {
      return res.status(400).json({ message: ruleError });
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

    const targetPriority = field.priority;
    const others = await FormField.find({
      formId: field.formId,
      priority: targetPriority,
      _id: { $ne: field._id },
    }).select("_id label priority");

    let priorityNotice = null;

    if (others.length === 1 && targetPriority !== previousPriority) {
      const maxRow = await FormField.find({ formId: field.formId })
        .sort({ priority: -1 })
        .limit(1)
        .select("priority")
        .lean();
      const tempPriority = (maxRow[0]?.priority ?? 0) + 1;

      field.priority = tempPriority;
      await field.save();

      const other = await FormField.findById(others[0]._id);
      other.priority = previousPriority;
      await other.save();

      field.priority = targetPriority;
      await field.save();

      priorityNotice = `Swapped with "${other.label}": they are now ${previousPriority}, this field is ${targetPriority}.`;

      return res.status(200).json({ field, priorityNotice });
    }

    if (others.length > 0) {
      let maxP = (
        await FormField.find({ formId: field.formId })
          .sort({ priority: -1 })
          .limit(1)
          .select("priority")
          .lean()
      )[0]?.priority ?? 0;
      const movedLabels = [];
      for (const ref of others) {
        const doc = await FormField.findById(ref._id);
        maxP += 1;
        doc.priority = maxP;
        await doc.save();
        movedLabels.push(`"${doc.label}" → ${maxP}`);
      }
      if (others.length === 1 && targetPriority === previousPriority) {
        priorityNotice = `Duplicate priority fixed: "${others[0].label}" is now ${maxP}.`;
      } else {
        priorityNotice = `Adjusted ${others.length} overlapping field(s): ${movedLabels.join(", ")}.`;
      }
    }

    await field.save();
    const payload = { field };
    if (priorityNotice) payload.priorityNotice = priorityNotice;
    return res.status(200).json(payload);
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
