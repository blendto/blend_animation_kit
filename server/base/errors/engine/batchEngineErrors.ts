import logger from "server/base/Logger";

export class IllegalBatchAccessError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "IllegalBatchAccessError";
  }

  static logIllegalBatchAccess(
    batchId: string,
    owner: string,
    trierUid: string
  ) {
    const message =
      `A user is trying to access another user's batch. Batch id: ${batchId}. ` +
      `Owner id: ${owner}. Requesting user id: ${trierUid}`;

    const loggable = {
      op: "ILLEGAL_BATCH_ACCESS_ATTEMPT",
      message,
      blendId: batchId,
      blendOwner: owner,
      trierUid,
    };
    logger.error(loggable);
  }
}
