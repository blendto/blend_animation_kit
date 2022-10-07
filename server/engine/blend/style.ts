import { UserError } from "server/base/errors";
import { BackgroundType, Recipe } from "server/base/models/recipe";

export class Style {
  validate(recipe: Recipe): void {
    if (recipe.style?.config.color.tags.length > 6) {
      throw new UserError(
        "You can't have more than 6 color tags",
        "TOO_MANY_COLOR_TAGS"
      );
    }

    const similarColorTagPairsSet = new Set(
      recipe.style?.config.color.rules.similarColorTags.map((l) => l.join("-"))
    );
    const mismatchPairs = [];
    recipe.style?.config.color.rules.contrastingColorTags
      .map((l) => l.join("-"))
      .forEach((tag) => {
        if (similarColorTagPairsSet.has(tag)) {
          mismatchPairs.push(tag);
        }
      });
    if (mismatchPairs.length) {
      throw new UserError(
        `Following tag pair/s were found in both similar and contrasting pairs: ${mismatchPairs.join(
          ", "
        )}`,
        "TAG_PAIR_MISMATCH"
      );
    }

    if (recipe.background) {
      if (
        recipe.background.$ === BackgroundType.GradientBackgroundInfo &&
        recipe.background.style?.color?.primary
      ) {
        throw new UserError(
          "BG has gradient colors where as styling defines a singular color",
          "BG_TAG_MISMATCH"
        );
      }

      if (
        recipe.background.$ === BackgroundType.ColoredBackgroundInfo &&
        recipe.style?.config?.gradient
      ) {
        throw new UserError(
          "BG has a singular color where as styling defines gradient colors",
          "BG_TAG_MISMATCH"
        );
      }

      const similarColorTags = new Set(
        recipe.style?.config?.gradient?.rules.similarColorTags
      );
      const mismatchTags = [];
      recipe.style?.config?.gradient?.rules.contrastingColorTags.forEach(
        (tag) => {
          if (similarColorTags.has(tag)) {
            mismatchTags.push(tag);
          }
        }
      );
      if (mismatchTags.length) {
        throw new UserError(
          `Following tag/s were found as both similar and contrasting to BG: ${mismatchTags.join(
            ", "
          )}`,
          "BG_TAG_RULE_MISMATCH"
        );
      }
    }
  }
}
