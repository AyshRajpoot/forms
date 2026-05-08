function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.issues[0];
      return res.status(400).json({
        message: firstError ? firstError.message : "Invalid request body",
      });
    }
    req.body = result.data;
    return next();
  };
}

module.exports = { validateBody };
