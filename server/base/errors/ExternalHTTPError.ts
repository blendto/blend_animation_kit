class ExternalHTTPError extends Error {
  extra: Record<string, unknown>;
  level: string;

  constructor(
    message: string,
    extra: Record<string, unknown>,
    level: "warn" | "error" = "error"
  ) {
    super(message);
    this.name = "ExternalHTTPError";
    this.extra = extra;
    this.level = level;
  }
}

export default ExternalHTTPError;
