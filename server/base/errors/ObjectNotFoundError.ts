export default class ObjectNotFoundError extends Error {
  shouldLogError: boolean;
  constructor(message = "ObjectNotFound", shouldLogError = false) {
    super(message);
    this.name = "ObjectNotFoundError";
    this.shouldLogError = shouldLogError;
  }
}
