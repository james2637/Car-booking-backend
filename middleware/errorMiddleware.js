export const notFound = (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || "Internal server error.";

  if (error.name === "ValidationError" || error.name === "CastError") {
    statusCode = 400;
  } else if (error.code === 11000) {
    statusCode = 409;
    message = "An account with this email already exists.";
  } else if (error.name === "MulterError") {
    statusCode = 400;
    message =
      error.code === "LIMIT_FILE_SIZE"
        ? "Each image must be 5 MB or smaller."
        : error.code === "LIMIT_FILE_COUNT"
          ? "A maximum of 4 images can be uploaded."
          : error.message;
  } else if (statusCode >= 500) {
    console.error(error);
    message = "Internal server error.";
  }

  res.status(statusCode).json({ message });
};
