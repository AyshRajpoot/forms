const express = require("express");
const { getActiveFields, submitForm } = require("../controllers/formController");

const router = express.Router();

router.get("/:formKey/active-fields", getActiveFields);
router.post("/:formKey/submissions", submitForm);

module.exports = router;
