const bcrypt = require("bcryptjs");
const { createToken } = require("../config/jwt");

async function adminLogin(req, res) {
  const email = req.body?.email;
  const password = req.body?.password;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({ message: "Email and password must be text values" });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  if (!cleanEmail.includes("@")) {
    return res.status(400).json({ message: "Enter a valid email" });
  }

  if (cleanPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const adminEmail = process.env.ADMIN_EMAIL.toLowerCase().trim();

  if (cleanEmail !== adminEmail) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isPasswordCorrect = await bcrypt.compare(cleanPassword, process.env.ADMIN_PASSWORD_HASH);
  if (!isPasswordCorrect) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = createToken({
    role: "admin",
    email: adminEmail,
  });

  return res.status(200).json({
    message: "Login successful",
    token,
    tokenType: "Bearer",
  });
}

module.exports = { adminLogin };
