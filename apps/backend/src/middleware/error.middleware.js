export function errorMiddleware(error, req, res, next) {
  const status = Number.isInteger(error.status) ? error.status : 500;

  if (status >= 500) {
    console.error("[BACKEND]", error);
  }

  res.status(status).json({
    error:
      status >= 500
        ? "Error interno del servidor."
        : error.message,
  });
}