export class IllegalBlendAccessError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "IllegalBlendAccessError";
  }
}
