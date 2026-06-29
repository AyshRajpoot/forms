const express = require("express");
const { adminLogin, adminLogout } = require("../controllers/authController");

const router = express.Router();

router.post("/admin/login", adminLogin);
router.post("/admin/logout", adminLogout);

module.exports = router;
