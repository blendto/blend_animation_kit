import { v4 } from "uuid";
import { RecipeSource, RecipeVariantId } from "server/base/models/recipeList";
import { BrandingInfoType } from "server/repositories/branding";
import { UserError } from "../errors";
import { BrandingRecipe } from "./brandingRecipe";
import { BlendHeroImage, ImageFileKeys } from "./heroImage";

export enum ElementSource {
  blend = "BLEND",
  recipe = "RECIPE",
  branding = "BRANDING",
  blend_assets = "BLEND_ASSETS",
  hero = "HERO",
  blend_output = "BLEND_OUTPUT",
}

export class StoredImage {
  uid: string;
  uri: string;
  source?: ElementSource;

  static isSourceBlend(this: void, image: StoredImage): boolean {
    return !image.source || image.source === ElementSource.blend;
  }
}

export interface BrandingDetails {
  logo?: {
    data: { uri: string; source: ElementSource };
  };
  info?: {
    data: { type: BrandingInfoType; value: string; link?: string }[];
  };
}

export enum FlowType {
  START_WITH_A_TEMPLATE = "START_WITH_A_TEMPLATE",
  BATCH = "BATCH",
  ASSISTED_WEB = "ASSISTED_WEB",
  ASSISTED_MOBILE = "ASSISTED_MOBILE",
  // TODO: Cleanup
  // HACK: This is a temporary flow demoing org specific templates to a potential client
  ONLINE_SALES_1 = "ONLINE_SALES_1",
  ONLINE_SALES_2 = "ONLINE_SALES_2",
}

export interface ElementRef {
  uid: string;
  assetType: string;
}

export interface Elements {
  hero?: ElementRef;
  heroes?: ElementRef[];
  background?: ElementRef;
  title?: ElementRef;
  subtitle?: ElementRef;
  ctaText?: ElementRef;
  offerText?: ElementRef;
}

export interface RecipeDetails {
  elements: Elements;
  assets?: { images?: { zipURL?: string; withoutHeroZipURL?: string } };
  isPremium?: boolean;
}

export enum InteractionAction {
  DISPLAY_INLINE = "DISPLAY_INLINE",
  STOP_DISPLAY = "STOP_DISPLAY",
}

export enum AssetType {
  IMAGE = "IMAGE",
  EXT_IMAGE = "EXT_IMAGE",
  GIF = "GIF",
  STICKER = "STICKER",
  TEXT = "TEXT",
  LINK = "LINK",
  BRANDING = "BRANDING",
}

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
  color?: { primary?: string; fill?: string };
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

enum BrandingInfoLayout {
  COLUMN = "COLUMN",
  ROW = "ROW",
}

enum BrandingInfoIconStyle {
  OUTLINE = "OUTLINE",
  FILLED = "FILLED",
  ORIGINAL = "ORIGINAL",
  ROUNDED = "ROUNDED",
}

export enum BrandingInfoTransformType {
  ICON = "ICON",
  TEXT = "TEXT",
}

interface BrandingInfoTransform {
  handle: BrandingInfoType;
  position: Offset;
  type: BrandingInfoTransformType;
  size: Size;
}

export interface BrandingInfoMetadata extends GeometricPositionable {
  color: string;
  font: string;
  fontSize: number;
  textScaleFactor: number;
  itemGap?: number;
  iconMargin?: number;
  iconSize?: number;
  layout?: BrandingInfoLayout;
  iconStyle?: BrandingInfoIconStyle;
  transforms?: BrandingInfoTransform[];
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
  type: UserInteractionType;
  options: UserInteractionOptions;
}

export enum UserInteractionType {
  LINK = "LINK",
}

export interface UserInteractionOptions {}

export interface LinkOptions extends UserInteractionOptions {
  target: string;
}

export enum SourceMetadataType {
  MOBILE = "MOBILE",
  WEB = "WEB",
}

export interface SourceMetadata {
  type: SourceMetadataType;
  version: number;
}

interface ExternalRecipeSource extends Record<string, any> {
  $: string;
}

export interface RecipeMetadata {
  sourceBlendId: string;
  source: SourceMetadata;
  sourceRecipeId?: string;
  aspectRatio?: Size;
  sourceRecipe?: RecipeVariantId;
  resolution?: Size;
  target?: string;
  externalRecipeSource?: ExternalRecipeSource;
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
  heroImages?: BlendHeroImage;
  imageFileKeys?: ImageFileKeys[];
  applicableFor?: FlowType[];
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
  version?: string;
  createdOn?: string;
  updatedOn?: string;
  createdAt?: number;
  updatedAt?: number;
  createdBy?: string;
  isWatermarked?: boolean;
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
  ImageBackgroundInfo = "ImageBackgroundInfo",
}

export class RecipeUtils {
  static aspectRatioToVariant(aspectRatio: Size) {
    return `${aspectRatio.width}:${aspectRatio.height}`;
  }
}

export interface ReplacementTexts {
  title?: string;
  subtitle?: string;
  ctaText?: string;
  offerText?: string;
}

export class ChooseRecipeRequest {
  recipeId: string;
  retainAssetSource: boolean;
  variant?: string;
  fileKeys?: { original: string; withoutBg: string };
  encoderVersion: number;
  source?: RecipeSource;
  replacementTexts: ReplacementTexts;
}

export class RecipeWrapper {
  private recipe: Recipe | BrandingRecipe;

  constructor(recipe: Recipe | BrandingRecipe) {
    this.recipe = recipe;
  }

  private backfillExternalRecipeSource() {
    if (!this.recipe.metadata?.externalRecipeSource) return;
    const { externalRecipeSource } = this.recipe.metadata;

    if (externalRecipeSource.$ !== "AiStudioRecipeSource") return;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const imageSize = externalRecipeSource?.image?.metadata?.imageSize as
      | Array<number>
      | undefined;
    if (!imageSize || imageSize.length < 2) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      externalRecipeSource.image.metadata.imageSize = [512, 512];
    }
  }

  clean() {
    if (!this.recipe.heroImages?.original) {
      this.recipe.heroImages = null;
    }
    this.backfillExternalRecipeSource();
  }

  replaceHero(
    fileKeys: ImageFileKeys,
    image?: StoredImage,
    interaction?: Interaction
  ) {
    let heroUid =
      this.recipe.recipeDetails?.elements?.hero?.uid ??
      this.recipe.recipeDetails?.elements?.heroes?.[0]?.uid;
    if (heroUid) {
      if (!image) {
        image = this.recipe.images.find((image) => image.uid === heroUid);
      }
      if (!interaction) {
        interaction = this.recipe.interactions.find(
          (interaction) =>
            interaction.assetType === "IMAGE" &&
            interaction.assetUid === heroUid
        );
      }
    } else {
      // Apply a default hero
      heroUid = v4();
      this.recipe.recipeDetails.elements.hero = {
        uid: heroUid,
        assetType: AssetType.IMAGE,
      };
      image = {
        uid: heroUid,
        uri: fileKeys.withoutBg,
      };
      const maxZIndex = this.recipe.interactions.length
        ? Math.max(
            ...this.recipe.interactions.map(
              (i) => (i.metadata as ImageMetadata).zIndex
            )
          )
        : 0;
      interaction = this.defaultHeroInteraction(heroUid, maxZIndex);
      this.recipe.images.push(image);
      this.recipe.interactions.push(interaction);
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

    return { image, interaction };
  }

  defaultHeroInteraction(heroUid: string, maxZIndex: number) {
    const canvasSize = this.recipe.metadata.resolution;
    const defaultHeroSize = {
      width: canvasSize.width * 0.7,
      height: canvasSize.height * 0.7,
    };
    return {
      action: InteractionAction.DISPLAY_INLINE,
      assetType: AssetType.IMAGE,
      assetUid: heroUid,
      metadata: {
        $: "ImageMetadata",
        hasBgRemoved: true,
        layerType: InteractionLayerTypes.Image,
        position: {
          dx: (canvasSize.width - defaultHeroSize.width) / 2,
          dy: (canvasSize.height - defaultHeroSize.height) / 2,
        },
        relativeSize: {
          width: canvasSize.width,
          height: canvasSize.height,
        },
        rotation: 0,
        rotationOrigin: "CENTER",
        rotationX: 0,
        rotationY: 0,
        size: defaultHeroSize,
        zIndex: maxZIndex + 1,
      } as ImageMetadata,
      time: 0,
    };
  }

  filterOutBrandingInteractions() {
    this.recipe.interactions = this.recipe.interactions.filter(
      (i: Interaction) =>
        !["BrandingInfoMetadata", "BrandingLogoMetadata"].includes(i.metadata.$)
    );
  }

  cleanupBranding() {
    delete this.recipe.branding;
    this.filterOutBrandingInteractions();
  }

  replaceTexts(replacementTexts: ReplacementTexts): void {
    Object.keys(replacementTexts).forEach((key) => {
      if (this.recipe.recipeDetails?.elements[key]) {
        const matchingText = this.recipe.texts.find(
          (t) =>
            t.uid ===
            (this.recipe.recipeDetails.elements[key] as ElementRef).uid
        );
        if (matchingText) {
          matchingText.value = replacementTexts[key];
        }
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
  fileKeys: ImageFileKeys;
  pageKey: number;
  userChosenSuperClass?: string;
  heroImageId?: string;
  filters: Record<string, unknown>;
  flow: FlowType;
}
