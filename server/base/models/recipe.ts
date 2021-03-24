export interface StoredImage {
  uid: string;
  uri: string;
}

export interface ElementRef {
  uid: string;
  assetType: string;
}

export interface Elements {
  hero: ElementRef;
  bg: ElementRef;
  title: ElementRef;
}

export interface RecipeDetails {
  elements: Elements;
}

export type InteractionAction = "DISPLAY_INLINE" | "STOP_DISPLAY";
export type AssetType =
  | "IMAGE"
  | "EXT_IMAGE"
  | "GIF"
  | "STICKER"
  | "TEXT"
  | "LINK";

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

export interface InteractionMetadata {
  $: string;
}

export interface GeometricPositionable extends InteractionMetadata {
  position: Offset;
  size: Offset;
  relativeSize: Offset;
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
  alignment: TextAlignment;
  background: TextBackground;
}

export interface Interaction {
  action: InteractionAction;
  assetType: AssetType;
  assetUid: string;
  metadata: InteractionMetadata;
}

export interface SourceMetadata {
  type: "MOBILE" | "WEB";
  version: number;
}

export interface RecipeMetadata {
  sourceBlendId: string;
  source: SourceMetadata;
}

export interface Recipe {
  id: string;
  images: StoredImage[];
  recipeDetails: RecipeDetails;
  interactions: Interaction[];
  metadata: RecipeMetadata;
}
