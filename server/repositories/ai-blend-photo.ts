import {
  DynamooseEntity,
  dynamooseModel,
  DynamooseModel,
  DynamooseRepo,
  DynamooseSchema,
  Repo,
} from "server/repositories/base";
import ConfigProvider from "server/base/ConfigProvider";
import {
  AIBlendPhoto,
  AIBlendPhotoGenerationStatus,
} from "server/base/models/aistudio";

const aiBlendPhotoDynamooseSchema = new DynamooseSchema(
  {
    blendId: {
      type: String,
      hashKey: true,
      required: true,
    },
    fileKeys: { type: Object },
    prompts: { type: Array },
    generatedImages: { type: Array },
    createdOn: { type: String },
    createdBy: { type: String },
    status: { type: String, enum: Object.values(AIBlendPhotoGenerationStatus) },
  },
  {
    timestamps: {
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    saveUnknown: ["fileKeys.*", "prompts.**"],
  }
);

export interface AiBlendPhotoDynamooseEntity
  extends DynamooseEntity,
    AIBlendPhoto {}

export class AiBlendPhotoDynamooseRepo
  extends DynamooseRepo<AIBlendPhoto, AiBlendPhotoDynamooseEntity>
  implements Repo<AIBlendPhoto>
{
  model: DynamooseModel<AiBlendPhotoDynamooseEntity> = dynamooseModel(
    ConfigProvider.AI_BLEND_PHOTOS_TABLE,
    aiBlendPhotoDynamooseSchema,
    {
      create: true,
      waitForActive: false,
      update: true,
    }
  );
}
