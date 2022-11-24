class ExternalHTTPError extends Error {
  extra: Record<string, unknown>;
  constructor(message: string, extra: Record<string, unknown>) {
    super(message);
    this.name = "ExternalHTTPError";
    this.extra = extra;
  }
}

export default ExternalHTTPError;
