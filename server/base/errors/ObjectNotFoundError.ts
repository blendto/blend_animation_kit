export default class ObjectNotFoundError extends Error {
  constructor(message = "ObjectNotFound") {
    super(message);
    this.name = "ObjectNotFoundError";
  }
}
