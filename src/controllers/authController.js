const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { createToken } = require("../config/jwt");
const TokenBlacklist = require("../models/TokenBlacklist");
const LoginAttempt = require("../models/LoginAttempt");

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = [5, 10, 15, 30];

function clientIp(req) {
  const raw = req.headers["x-forwarded-for"];
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",")[0].trim();
  }
  return String(req.ip || "unknown");
}

function buildAttemptKey(email, ip) {
  return `${String(email || "").trim().toLowerCase()}|${String(ip || "").trim().toLowerCase()}`;
}

function lockDurationMinutes(lockLevel) {
  const idx = Math.min(Math.max(lockLevel, 1), LOCKOUT_MINUTES.length) - 1;
  return LOCKOUT_MINUTES[idx];
}

function lockResponsePayload(record, lockMinutes, retryAfterSeconds) {
  return {
    message: `Too many login attempts. Try again in ${retryAfterSeconds} seconds.`,
    locked: true,
    retryAfterSeconds,
    lockMinutes,
    lockLevel: record.lockLevel,
  };
}

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
  const ip = clientIp(req);
  const key = buildAttemptKey(cleanEmail, ip);

  let attempt = await LoginAttempt.findOne({ key });
  if (!attempt) {
    attempt = await LoginAttempt.create({
      key,
      email: cleanEmail,
      ip,
      failedAttempts: 0,
      lockLevel: 0,
      lockUntil: null,
      lastFailedAt: null,
    });
  }

  const now = new Date();
  if (attempt.lockUntil && attempt.lockUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((attempt.lockUntil.getTime() - now.getTime()) / 1000));
    const minutes = lockDurationMinutes(attempt.lockLevel || 1);
    return res.status(429).json(lockResponsePayload(attempt, minutes, retryAfterSeconds));
  }

  if (attempt.lockUntil && attempt.lockUntil <= now) {
    attempt.failedAttempts = 0;
    attempt.lockUntil = null;
    await attempt.save();
  }

  if (!cleanEmail.includes("@")) {
    return res.status(400).json({ message: "Enter a valid email" });
  }

  if (cleanPassword.length < 8) {
    return res.status(400).json({ message: "Password must be at least 8 characters" });
  }

  const adminEmail = process.env.ADMIN_EMAIL.toLowerCase().trim();

  let isPasswordCorrect = false;
  if (cleanEmail === adminEmail) {
    isPasswordCorrect = await bcrypt.compare(cleanPassword, process.env.ADMIN_PASSWORD_HASH);
  }

  if (!isPasswordCorrect) {
    attempt.failedAttempts += 1;
    attempt.lastFailedAt = now;

    if (attempt.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      attempt.lockLevel += 1;
      const minutes = lockDurationMinutes(attempt.lockLevel);
      const retryAfterSeconds = minutes * 60;
      attempt.lockUntil = new Date(now.getTime() + retryAfterSeconds * 1000);
      attempt.failedAttempts = 0; // reset cycle; next cycle escalates lock duration
      await attempt.save();
      return res.status(429).json(lockResponsePayload(attempt, minutes, retryAfterSeconds));
    }

    await attempt.save();
    return res.status(401).json({ message: "Invalid credentials" });
  }

  attempt.failedAttempts = 0;
  attempt.lockLevel = 0;
  attempt.lockUntil = null;
  attempt.lastFailedAt = null;
  await attempt.save();

  const token = createToken({
    role: "admin",
    email: adminEmail,
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000, // 1 day
  });

  return res.status(200).json({
    message: "Login successful",
    token,
    tokenType: "Bearer",
  });
}

async function adminLogout(req, res, next) {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  let token = null;
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }

  if (!token && req.headers.cookie) {
    const parseCookies = (cookieHeader) => {
      const list = {};
      cookieHeader.split(";").forEach((cookie) => {
        const parts = cookie.split("=");
        list[parts.shift().trim()] = decodeURIComponent(parts.join("="));
      });
      return list;
    };
    const cookies = parseCookies(req.headers.cookie);
    token = cookies.token;
  }

  if (token) {
    try {
      const decoded = jwt.decode(token);
      const expiresAt = decoded && decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      await TokenBlacklist.create({ token, expiresAt });
    } catch (e) {
      // Ignore duplicates or decoding errors
    }
  }

  return res.status(200).json({ message: "Logout successful" });
}

module.exports = { adminLogin, adminLogout };
