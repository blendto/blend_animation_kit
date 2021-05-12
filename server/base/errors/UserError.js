class UserError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "UserError";
    this.code = code;
  }
}

export default UserError;
