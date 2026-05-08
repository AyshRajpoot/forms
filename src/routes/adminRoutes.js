const express = require("express");
const {
  createForm,
  listForms,
  getForm,
  updateForm,
  deleteForm,
  createField,
  listFields,
  listSubmissions,
  updateSubmission,
  deleteSubmission,
  getField,
  updateField,
  deleteField,
} = require("../controllers/adminController");
const { authenticateToken, authorizeRoles } = require("../middleware/verifyToken");
const { validateBody } = require("../middleware/validateBody");
const {
  createFormSchema,
  createFieldSchema,
  updateFormSchema,
  updateFieldSchema,
} = require("../validators/adminValidators");

const router = express.Router();

router.use(authenticateToken, authorizeRoles("admin"));

router.get("/forms", listForms);
router.post("/forms", validateBody(createFormSchema), createForm);
router.get("/forms/:formId", getForm);
router.patch("/forms/:formId", validateBody(updateFormSchema), updateForm);
router.delete("/forms/:formId", deleteForm);

router.get("/forms/:formId/fields", listFields);
router.get("/forms/:formId/submissions", listSubmissions);
router.patch("/forms/:formId/submissions/:submissionId", updateSubmission);
router.delete("/forms/:formId/submissions/:submissionId", deleteSubmission);
router.post("/forms/:formId/fields", validateBody(createFieldSchema), createField);

router.get("/fields/:fieldId", getField);
router.patch("/fields/:fieldId", validateBody(updateFieldSchema), updateField);
router.delete("/fields/:fieldId", deleteField);

module.exports = router;
