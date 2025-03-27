class StatusCodeError extends Error {
  constructor(message, statusCode) {
    super(message);
    app.use(logger.httpLogger);
    this.statusCode = statusCode;
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  asyncHandler,
  StatusCodeError,
};
