import { DynamoBasedServiceLocator } from "server/service";
import { UploadService } from "server/service/upload";

exports.handler = async (event) => {
  const bucket = event.Records[0].s3.bucket.name;
  const fileKey = decodeURIComponent(
    event.Records[0].s3.object.key.replace(/\+/g, " ")
  );

  const uploadService = DynamoBasedServiceLocator.instance.find(UploadService);
  await uploadService.processHeroImageTrigger(bucket, fileKey);
};
