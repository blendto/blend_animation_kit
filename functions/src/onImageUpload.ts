/* eslint-disable
  @typescript-eslint/no-unsafe-call,
  import/no-import-module-exports,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-argument
*/
import UploadService from "server/service/upload";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";

exports.handler = async (event) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const bucket = event.Records[0].s3.bucket.name;
  const fileKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );

  const uploadService = diContainer.get<UploadService>(TYPES.UploadService);
  await uploadService.processHeroImageTrigger(bucket, fileKey);
};
