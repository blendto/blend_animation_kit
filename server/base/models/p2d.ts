import { ReplacementTexts } from "./recipe";

export enum P2DCreationLogAction {
  SUGGEST = "suggest",
  CHOOSE = "choose",
}

export interface P2DSuggestion {
  id: string;
  variant: string;
  mutations: {
    texts?: ReplacementTexts;
    images?: {
      primaryIllustration?: {
        uri: string;
        source: string;
      };
    };
  };
}

export interface P2DCreationLogItem {
  createdOn: string;
  createdAt: number;
  userId: string;
  blendId: string;
  prompt?: string;
  suggestions: P2DSuggestion[];
  action: P2DCreationLogAction;
}
