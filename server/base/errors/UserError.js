class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserError";
  }
}

export default UserError;
