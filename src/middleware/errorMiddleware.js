import { sendError } from "../utils/response.js";

const buildValidationSources = (err) => {
  if (!err?.errors || typeof err.errors !== "object") {
    return [
      {
        path: err?.path || "",
        message: err?.message || "Validation failed",
      },
    ];
  }

  return Object.values(err.errors).map((error) => ({
    path: error.path || error?.properties?.path || "",
    message: error.message || err.message,
  }));
};

const defaultErrorSource = (err) => [
  {
    path: err?.path || "",
    message: err?.message || "An error occurred",
  },
];

export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err?.message || "An error occurred";
  let errorSources = defaultErrorSource(err);
  let status = statusCode;

  if (err?.name === "ValidationError") {
    status = err.statusCode || 400;
    message = "Validation failed";
    errorSources = buildValidationSources(err);
  } else if (err?.name === "CastError") {
    status = 400;
    message = `Invalid ${err.path || "value"}`;
    errorSources = [
      {
        path: err.path || "",
        message,
      },
    ];
  } else if (err?.code === 11000) {
    status = 400;
    const key = Object.keys(err.keyValue || {})[0] || "field";
    message = `${key} already exists`;
    errorSources = [
      {
        path: key,
        message,
      },
    ];
  }

  sendError(res, {
    message,
    status,
    errorSources,
    err,
  });
};
