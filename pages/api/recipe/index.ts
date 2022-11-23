import { diContainer } from "inversify.config";
import Joi from "joi";
import { NextApiResponse } from "next";
import { MethodNotAllowedError } from "server/base/errors";
import {
  AssetType,
  BackgroundType,
  ElementSource,
  InteractionAction,
  InteractionLayerTypes,
  Recipe,
  SourceMetadataType,
  UserInteractionType,
} from "server/base/models/recipe";
import { BatchLevelEditStatus } from "server/base/models/blend";
import { Style } from "server/engine/blend/style";
import {
  ensureServiceAuth,
  NextApiRequestExtended,
  requestComponentToValidate,
  validate,
  withReqHandler,
} from "server/helpers/request";
import { BlendMicroServices } from "server/internal/inter-service-auth";
import { RecipeService } from "server/service/recipe";
import { TYPES } from "server/types";

export default withReqHandler(
  async (req: NextApiRequestExtended, res: NextApiResponse) => {
    const { method } = req;
    switch (method) {
      case "POST":
        return ensureServiceAuth(
          BlendMicroServices.Retool,
          createRecipe,
          req,
          res
        );
      default:
        throw new MethodNotAllowedError();
    }
  }
);

const ELEMENT_SCHEMA = Joi.object({
  uid: Joi.string().required(),
  assetType: Joi.string().required(),
});

const BRANDING_INFO_DATA_SCHEMA = Joi.object({ value: Joi.string() });

const ARRAY_OF_OBJECTS_SCHEMA = Joi.array().items(Joi.object({}).unknown(true));

const STYLE_CONFIG_SCHEMA = Joi.object({
  color: Joi.object({
    primary: Joi.string(),
    fill: Joi.string(),
  }),
});

const IMAGE_FILE_KEY_SCHEMA = Joi.object({
  original: Joi.string().required().allow(null),
  trimLTWH: Joi.array().length(4).items(Joi.number()),
  withoutBg: Joi.string(),
  mask: Joi.string(),
  heroImageId: Joi.string(),
  classificationMetadata: Joi.object({
    productSuperClass: Joi.string().required(),
    userChosenSuperClass: Joi.string(),
  }),
});

const SIZE_SCHEMA = Joi.object({
  width: Joi.number().required(),
  height: Joi.number().required(),
});

const CREATE_RECIPE_SCHEMA = Joi.object({
  id: Joi.string().required(),
  variant: Joi.string(),
  images: Joi.array()
    .items(
      Joi.object({
        uid: Joi.string().required(),
        uri: Joi.string().required(),
        source: Joi.string().valid(...Object.values(ElementSource)),
      })
    )
    .required(),
  externalImages: ARRAY_OF_OBJECTS_SCHEMA,
  branding: Joi.object({
    logo: Joi.object({
      isPlaceholder: Joi.boolean().required(),
      data: Joi.object({
        uri: Joi.string().required(),
        source: Joi.string().required().valid(ElementSource.branding),
      }).required(),
    }),
    info: Joi.object({
      isPlaceholder: Joi.boolean().required(),
      data: Joi.object({
        brandName: BRANDING_INFO_DATA_SCHEMA,
        upiHandle: BRANDING_INFO_DATA_SCHEMA,
        email: BRANDING_INFO_DATA_SCHEMA,
        contactNo: BRANDING_INFO_DATA_SCHEMA,
        whatsappNo: BRANDING_INFO_DATA_SCHEMA,
        instaHandle: BRANDING_INFO_DATA_SCHEMA,
        website: BRANDING_INFO_DATA_SCHEMA,
        address: BRANDING_INFO_DATA_SCHEMA,
      }).required(),
    }),
  }).allow(null),
  gifsOrStickers: ARRAY_OF_OBJECTS_SCHEMA,
  texts: ARRAY_OF_OBJECTS_SCHEMA,
  buttons: ARRAY_OF_OBJECTS_SCHEMA,
  links: ARRAY_OF_OBJECTS_SCHEMA,
  recipeDetails: Joi.object({
    elements: Joi.object({
      hero: ELEMENT_SCHEMA,
      background: ELEMENT_SCHEMA.required().allow(null),
      title: Joi.string().required().allow(null),
    }).required(),
    assets: Joi.object({
      images: Joi.object({
        zipURL: Joi.string(),
        withoutHeroZipURL: Joi.string(),
      }),
    }),
    isPremium: Joi.boolean(),
  }),
  interactions: Joi.array().items(
    Joi.object({
      action: Joi.string()
        .required()
        .valid(...Object.values(InteractionAction))
        .required(),
      assetType: Joi.string()
        .required()
        .valid(...Object.values(AssetType))
        .required(),
      assetUid: Joi.string().required(),
      metadata: Joi.object({
        $: Joi.string().required(),
        layerType: Joi.string().valid(...Object.values(InteractionLayerTypes)),
        style: STYLE_CONFIG_SCHEMA,
      })
        .required()
        .unknown(true),
      userInteraction: Joi.object({
        type: Joi.string()
          .valid(...Object.values(UserInteractionType))
          .required(),
        options: Joi.object({}),
      }),
      time: Joi.number(),
    })
  ),
  metadata: Joi.object({
    sourceBlendId: Joi.string().required(),
    source: Joi.object({
      type: Joi.string()
        .required()
        .valid(...Object.values(SourceMetadataType)),
      version: Joi.number().required(),
    }).required(),
    sourceRecipeId: Joi.string(),
    aspectRatio: SIZE_SCHEMA,
    sourceRecipe: Joi.object({
      id: Joi.string().required(),
      variant: Joi.string().required(),
      extra: Joi.object({
        title: Joi.string(),
        thumbnail: Joi.string(),
        isPremium: Joi.boolean(),
      }),
    }),
    resolution: SIZE_SCHEMA,
    target: Joi.string(),
  }),
  title: Joi.string().allow(null),
  background: Joi.object({
    $: Joi.string()
      .required()
      .valid(...Object.values(BackgroundType)),
    color: Joi.string(),
    opacity: Joi.number(),
    colors: Joi.array().items(Joi.string()),
    angle: Joi.number(),
    stops: Joi.array().items(Joi.number()),
    style: STYLE_CONFIG_SCHEMA,
    editorSettings: Joi.object(),
  }).allow(null),
  thumbnail: Joi.string(),
  heroImages: IMAGE_FILE_KEY_SCHEMA.allow(null),
  imageFileKeys: Joi.array().items(IMAGE_FILE_KEY_SCHEMA),
  fileName: Joi.string().allow(null),
  batchLevelEditStatus: Joi.string()
    .valid(...Object.values(BatchLevelEditStatus))
    .allow(null),
  style: Joi.object({
    config: Joi.object({
      color: Joi.object({
        tags: Joi.array().items(Joi.string()).required(),
        default: Joi.object({}).required().unknown(true),
        rules: Joi.object({
          similarColorTags: Joi.array()
            .items(Joi.array().items(Joi.string()).length(2))
            .required(),
          contrastingColorTags: Joi.array()
            .items(Joi.array().items(Joi.string()).length(2))
            .required(),
        }).required(),
      }),
      gradient: Joi.object({
        default: Joi.object({
          colors: Joi.array().items(Joi.string()).required(),
          angle: Joi.number().required(),
          stops: Joi.array().items(Joi.number()).required(),
        }),
        rules: Joi.object({
          similarColorTags: Joi.array().items(Joi.string()).required(),
          contrastingColorTags: Joi.array().items(Joi.string()).required(),
        }).required(),
      }),
    }).required(),
  }),
  version: Joi.string().required(),
  createdOn: Joi.string().required(),
  updatedOn: Joi.string().required(),
  createdAt: Joi.number().required(),
  updatedAt: Joi.number().required(),
  createdBy: Joi.string().required(),
  isWatermarked: Joi.boolean().required(),
});

const createRecipe = async (
  req: NextApiRequestExtended,
  res: NextApiResponse
) => {
  validate(
    req.body as object,
    requestComponentToValidate.body,
    CREATE_RECIPE_SCHEMA
  );

  const recipe = req.body as Recipe;
  new Style().validate(recipe);
  await diContainer.get<RecipeService>(TYPES.RecipeService).create(recipe);
  res.status(201).send(recipe);
};
