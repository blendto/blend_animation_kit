import { UploadService } from "server/service/upload";
import { diContainer } from "inversify.config";
import { TYPES } from "server/types";

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const fileKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );

  const uploadService = diContainer.get<UploadService>(TYPES.UploadService);
  await uploadService.processHeroImageTrigger(bucket, fileKey);
};
