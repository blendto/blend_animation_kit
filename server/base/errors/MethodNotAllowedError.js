class MethodNotAllowedError extends Error {
  constructor(message = "MethodNotAllowed") {
    super(message);
    this.name = "MethodNotAllowedError";
  }
}

export default MethodNotAllowedError;
