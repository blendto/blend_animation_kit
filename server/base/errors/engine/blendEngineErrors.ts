import logger from "server/base/Logger";

export class IllegalBlendAccessError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "IllegalBlendAccessError";
  }

  static logIllegalBlendAccess(
    blendId: string,
    blendOwner: string,
    trierUid: string,
    isTrierAnonymous: boolean
  ) {
    const message =
      `A user is trying to access another user's blend. Blend id: ${blendId}. ` +
      `Owner id: ${blendOwner}. Requesting user id: ${trierUid}`;

    const loggable = {
      op: "ILLEGAL_BLEND_ACCESS_ATTEMPT",
      message,
      blendId,
      blendOwner,
      trierUid,
    };
    logger.warn(loggable);
   
  }
}
