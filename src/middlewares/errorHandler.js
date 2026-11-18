import fs from "node:fs";

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});

  let statusCode = err.statusCode || 500;
  let message = err.message || "Server error";
  let errors = err.errors;

  if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid ${err.path}`;
    errors = undefined;
  }

  if (err.name === "ValidationError") {
    statusCode = 422;
    errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = errors[0]?.message || "Validation failed";
  }

  if (err.name === "MulterError") {
    statusCode = 400;
    message = err.code === "LIMIT_FILE_SIZE" ? "Image must be 2 MB or smaller" : err.message;
    errors = undefined;
  }

  if (err.code === 11000) {
    statusCode = 409;
    message = `${Object.keys(err.keyValue).join(", ")} already exists`;
    errors = undefined;
  }

  if (statusCode === 500) console.error(err);

  res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === "development" && statusCode === 500 && { stack: err.stack }),
  });
};

export default errorHandler;
