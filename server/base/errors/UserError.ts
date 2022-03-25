class UserError extends Error {
  code: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "UserError";
    this.code = code;
  }
}

export default UserError;
