import { isEmpty } from "lodash";
import { RecipeVariantId } from "server/base/models/recipeList";
import { BrandingEntity, BrandingInfoType } from "server/repositories/branding";
import { UserError } from "../errors";
import { HeroImageFileKeys } from "./heroImage";

export enum ElementSource {
  blend = "BLEND",
  recipe = "RECIPE",
  branding = "BRANDING",
  blend_assets = "BLEND_ASSETS",
  hero = "HERO",
}

export interface StoredImage {
  uid: string;
  uri: string;
  source?: ElementSource;
}

export interface BrandingDetails {
  logo?: {
    isPlaceholder: boolean;
    data: { uri: string; source: ElementSource.branding };
  };
  info?: {
    isPlaceholder: boolean;
    data: { [attribute in BrandingInfoType]?: { value: string } };
  };
}

export interface ElementRef {
  uid: string;
  assetType: string;
}

export interface Elements {
  hero?: ElementRef;
  background: ElementRef;
  title: ElementRef;
}

export interface RecipeDetails {
  elements: Elements;
  assets?: { images?: { zipURL?: string; withoutHeroZipURL?: string } };
  isPremium?: boolean;
}

export type InteractionAction = "DISPLAY_INLINE" | "STOP_DISPLAY";
export type AssetType =
  | "IMAGE"
  | "EXT_IMAGE"
  | "GIF"
  | "STICKER"
  | "TEXT"
  | "LINK"
  | "BRANDING";

export interface Offset {
  dx: number;
  dy: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  left: number;
  top: number;
  height: number;
  width: number;
}

export enum InteractionLayerTypes {
  Background = "BACKGROUND",
  Text = "TEXT",
  Image = "IMAGE",
  Sticker = "STICKER",
  Shape = "SHAPE",
  Gif = "GIF",
  Link = "LINK",
  Element = "ELEMENT",
  BrandingInfo = "BRANDING_INFO",
  BrandingLogo = "BRANDING_LOGO",
}

interface StyleConfig {
  color: { primary?: string; fill?: string };
}

export interface InteractionMetadata {
  $: string;
  layerType?: InteractionLayerTypes;
  style?: StyleConfig;
}

export interface GeometricPositionable extends InteractionMetadata {
  position: Offset;
  size: Size;
  relativeSize: Size;
  rotation: number;
  rotationX: number;
  rotationY: number;
  zIndex: number;
  cropRect?: Rect;
}

export interface ImageMetadata extends GeometricPositionable {
  hasBgRemoved: boolean;
  fillColor?: string;
}

export interface BrandingLogoMetadata extends GeometricPositionable {}

type TextAlignment = "LEFT" | "CENTER" | "RIGHT";
type TextBackgroundShape = "RECT" | "ROUNDED_RECT";

export interface TextBackground {
  color: string;

  shape: TextBackgroundShape;
}

export interface TextMetadata extends GeometricPositionable {
  color: string;
  font: string;
  fontSize: number;
  textScaleFactor: number;
  alignment?: TextAlignment;
  background?: TextBackground;
}

export interface BrandingInfoMetadata extends TextMetadata {
  iconSet: string;
}

export interface Interaction {
  action: InteractionAction;
  assetType: AssetType;
  assetUid: string;
  metadata: InteractionMetadata;
  userInteraction?: UserInteraction;
  time?: number;
}

export interface UserInteraction {
  type: "LINK";
  options: UserInteractionOptions;
}

export interface UserInteractionOptions {}

export interface LinkOptions extends UserInteractionOptions {
  target: string;
}

export interface SourceMetadata {
  type: "MOBILE" | "WEB";
  version: number;
}

export interface RecipeMetadata {
  sourceBlendId: string;
  source: SourceMetadata;
  sourceRecipeId?: string;
  aspectRatio?: Size;
  sourceRecipe?: RecipeVariantId;
}

export interface Recipe {
  id: string;
  variant?: string;
  images?: StoredImage[];
  externalImages?: Record<string, unknown>[];
  branding?: BrandingDetails;
  gifsOrStickers?: Record<string, unknown>[];
  texts?: Record<string, unknown>[];
  buttons?: Record<string, unknown>[];
  links?: Record<string, unknown>[];
  recipeDetails?: RecipeDetails;
  interactions?: Interaction[];
  metadata?: RecipeMetadata;
  title?: string;
  background?: BackgroundInfo;
  thumbnail?: string;
  imageFileKeys?: HeroImageFileKeys[];
  style?: {
    config: {
      color?: {
        tags: string[];
        default: Record<string, string>;
        rules: {
          similarColorTags: [string, string][];
          contrastingColorTags: [string, string][];
        };
      };
      gradient?: {
        default: {
          colors: string[];
          angle: number;
          stops: number[];
        };
        rules: {
          similarColorTags: string[];
          contrastingColorTags: string[];
        };
      };
    };
  };
}

interface BackgroundInfo {
  $: BackgroundType;
  color?: string;
  opacity?: number;
  colors?: string[];
  angle?: number;
  stops?: number[];
  style?: StyleConfig;
}

export enum BackgroundType {
  GradientBackgroundInfo = "GradientBackgroundInfo",
  ColoredBackgroundInfo = "ColoredBackgroundInfo",
}

export class RecipeUtils {
  static aspectRatioToVariant(aspectRatio: Size) {
    return `${aspectRatio.width}:${aspectRatio.height}`;
  }
}

export class ChooseRecipeRequest {
  recipeId: string;
  variant?: string;
  fileKeys?: { original: string; withoutBg: string };
  encoderVersion: number;
}

export class RecipeWrapper {
  private recipe: Recipe;

  constructor(recipe: Recipe) {
    this.recipe = recipe;
  }

  replaceHero(
    fileKeys: HeroImageFileKeys,
    image?: StoredImage,
    interaction?: Interaction
  ) {
    const heroUid = this.recipe.recipeDetails?.elements?.hero?.uid;
    if (!heroUid) {
      return;
    }

    if (!image) {
      image = this.recipe.images.find((image) => image.uid === heroUid);
    }
    if (!interaction) {
      interaction = this.recipe.interactions.find(
        (interaction) =>
          interaction.assetType === "IMAGE" && interaction.assetUid === heroUid
      );
    }

    if (!image || !interaction) {
      throw new UserError(
        `Either/both of hero image and interaction is missing`
      );
    }
    image.source = ElementSource.blend;
    if ((interaction.metadata as ImageMetadata).hasBgRemoved) {
      image.uri = fileKeys.withoutBg;
    } else {
      image.uri = fileKeys.original;
    }
    // Starting from 2.5, we only show the cropped area in the mobile_app instead of actually
    // cropping the image and uploading it.
    // The hero image should not have cropRect property in a recipe as it will get replaced.
    delete (interaction.metadata as ImageMetadata).cropRect;
  }

  replaceBrandingInfo(brandingProfile: BrandingEntity): void {
    if (isEmpty(this.recipe.branding)) {
      return;
    }

    if (brandingProfile.logos.primaryEntry) {
      this.recipe.branding.logo.isPlaceholder = false;
      this.recipe.branding.logo.data.uri = brandingProfile.logos.primaryEntry;
    }

    const unavailableAttributes = [];
    Object.keys(this.recipe.branding.info.data).forEach(
      (att: BrandingInfoType) => {
        if (brandingProfile[att]) {
          this.recipe.branding.info.data[att].value = brandingProfile[att];
          // Set it to false if there's atleast one available attribute
          this.recipe.branding.info.isPlaceholder = false;
        } else {
          unavailableAttributes.push(att);
        }
      }
    );
    if (!this.recipe.branding.info.isPlaceholder) {
      // Delete all placeholder values if there's atleast one available attribute
      unavailableAttributes.forEach((att: BrandingInfoType) => {
        delete this.recipe.branding.info.data[att];
      });
    }
  }

  removeBrandingPlaceholders(): void {
    Object.keys(this.recipe.branding || {}).forEach((type: "info" | "logo") => {
      if (this.recipe.branding[type]?.isPlaceholder) {
        delete this.recipe.branding[type];
        this.recipe.interactions = this.recipe.interactions.filter(
          (i: Interaction) =>
            i.metadata.$ !==
            {
              info: "BrandingInfoMetadata",
              logo: "BrandingLogoMetadata",
            }[type]
        );
      }
    });
  }

  replaceId(id: string) {
    this.recipe.id = id;
  }

  addWatermark() {
    const waterMark = {
      source: ElementSource.blend_assets,
      uri: "ext-services/blend/watermark.png",
      size: { width: 616, height: 172 },
    };
    const blendMetadata = this.recipe.metadata as unknown as {
      resolution: Size;
    };
    const { width, height } = blendMetadata.resolution;

    const interactionWidth = width * 0.5;
    const interactionHeight =
      (interactionWidth / waterMark.size.width) * waterMark.size.height;
    const dx = 0;
    const dy = height - interactionHeight;

    const assetUid = "@@watermark";
    const watermarkInteraction = {
      action: "DISPLAY_INLINE",
      assetUid,
      metadata: {
        layerType: "IMAGE",
        $: "ImageMetadata",
        relativeSize: { width, height },
        rotation: 0,
        rotationOrigin: "CENTER",
        rotationX: 0,
        rotationY: 0,
        size: { width: interactionWidth, height: interactionHeight },
        hasBgRemoved: true,
        position: { dx, dy },
        zIndex: 999,
      },
      time: 0,
      assetType: "IMAGE",
    };

    this.recipe.interactions.push(watermarkInteraction as Interaction);

    this.recipe.images.push({
      uri: waterMark.uri,
      uid: assetUid,
      source: waterMark.source,
    });
  }

  getBackground(encoderVersion: number): BackgroundInfo {
    const { background } = this.recipe;
    if (!background && encoderVersion >= 2.6) {
      return {
        $: BackgroundType.ColoredBackgroundInfo,
        color: "#ffffffff",
        opacity: 0,
      };
    }
    return background || null;
  }
}

export interface SearchRecipeResponse {
  nextPageKey?: number;
  suggestedRecipes: Array<RecipeVariantId>;
}

export interface SuggestRecipesPaginatedRequestBody {
  fileKeys: HeroImageFileKeys;
  pageKey: number;
  multipleAspectRatios?: boolean;
  heroImageId?: string;
}
