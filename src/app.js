const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const authRoutes = require("./routes/authRoutes");
const adminRoutes = require("./routes/adminRoutes");
const formRoutes = require("./routes/formRoutes");
const { notFound, errorHandler } = require("./middleware/errorHandlers");

const app = express();

app.use(helmet());

const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
app.use(
  cors({
    origin: frontendOrigin,
    credentials: true,
  })
);

app.use(express.json({ limit: "200kb" }));
app.use(morgan("dev"));

const formSubmitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (req, res) => res.status(200).json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/forms", formSubmitLimiter, formRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
