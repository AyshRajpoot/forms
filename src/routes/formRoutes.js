const express = require("express");
const multer = require("multer");
const { getActiveFields, submitFormResponse } = require("../controllers/formController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB per file
});

router.get("/:formKey/active-fields", getActiveFields);
router.post("/:formKey/submit", upload.any(), submitFormResponse);

module.exports = router;
