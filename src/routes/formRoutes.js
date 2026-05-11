const express = require("express");
const { getActiveFields } = require("../controllers/formController");

const router = express.Router();

router.get("/:formKey/active-fields", getActiveFields);

module.exports = router;
