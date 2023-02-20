class UserError extends Error {
  code: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "UserError";
    this.code = code;
  }
}

export enum UserErrorCode {
  USER_NOT_FOUND = "USER_NOT_FOUND",
  INVALID_USER_ID = "INVALID_USER_ID",
  BRANDING_PROFILE_NOT_FOUND = "BRANDING_PROFILE_NOT_FOUND",
  NON_GENERATED_BLEND = "NON_GENERATED_BLEND",
}

export default UserError;
