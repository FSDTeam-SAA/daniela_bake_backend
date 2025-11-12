export const sendSuccess = (res, data = null, message = "Request successful") => {
  return res.json({
    success: true,
    message,
    data,
  });
};

const normalizeErrorSources = (errorSources, err) => {
  if (Array.isArray(errorSources) && errorSources.length) {
    return errorSources;
  }
  return [
    {
      path: err?.path || "",
      message: err?.message || "An error occurred",
    },
  ];
};

const sanitizeStack = (err) => {
  if (!err) return null;
  return process.env.NODE_ENV === "production" ? null : err.stack;
};

const sanitizeErrObject = (err) => {
  if (!err) return null;
  return {
    name: err.name,
    message: err.message,
  };
};

export const sendError = (
  res,
  {
    message = "An error occurred",
    status = 500,
    errorSources = null,
    err = null,
    data = null,
  } = {}
) => {
  res.status(status);
  return res.json({
    success: false,
    message,
    errorSources: normalizeErrorSources(errorSources, err),
    err: sanitizeErrObject(err),
    stack: sanitizeStack(err),
    ...(data !== null ? { data } : {}),
  });
};
