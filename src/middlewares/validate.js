import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

const validate = (req, res, next) => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const errors = result.array().map((err) => ({ field: err.path, message: err.msg }));
  // 400 with every field error, so forms can show each message next to its field
  throw new ApiError(400, errors[0].message, errors);
};

export default validate;
