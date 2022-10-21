import { UserError } from "server/base/errors";
import { BackgroundType, Recipe } from "server/base/models/recipe";

export class Style {
  validateTag(validTags: Set<string>, tag: string): void {
    if (!validTags.has(tag)) {
      throw new UserError(`Tag ${tag} is undefined`, "UNDEFINED_TAG");
    }
  }

  validate(recipe: Recipe): void {
    if (new Set(recipe.style?.config.color?.tags).size > 6) {
      throw new UserError(
        "You can't have more than 6 color tags",
        "TOO_MANY_COLOR_TAGS"
      );
    }

    const allColorTags = new Set(recipe.style?.config.color?.tags || []);

    recipe.interactions.forEach((i) => {
      if (i.metadata.style?.color) {
        type tagType = keyof typeof i.metadata.style.color;
        Object.keys(i.metadata.style.color).forEach((tagKind: tagType) => {
          this.validateTag(allColorTags, i.metadata.style?.color[tagKind]);
        });
      }
    });

    recipe.style?.config.color?.rules.similarColorTags.forEach(
      ([tag1, tag2]) => {
        this.validateTag(allColorTags, tag1);
        this.validateTag(allColorTags, tag2);
      }
    );
    recipe.style?.config.color?.rules.contrastingColorTags.forEach(
      ([tag1, tag2]) => {
        this.validateTag(allColorTags, tag1);
        this.validateTag(allColorTags, tag2);
      }
    );

    const similarColorTagPairsSet = new Set(
      recipe.style?.config.color?.rules.similarColorTags.map((l) => l.join("-"))
    );
    const mismatchPairs = [];
    recipe.style?.config.color?.rules.contrastingColorTags
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
      if (recipe.background.$ === BackgroundType.GradientBackgroundInfo) {
        if (recipe.background.style) {
          throw new UserError(
            "BG has gradient colors where as styling defines a singular color",
            "BG_TAG_MISMATCH"
          );
        }

        recipe.style?.config.gradient?.rules.contrastingColorTags.forEach(
          (tag) => {
            this.validateTag(allColorTags, tag);
          }
        );
        recipe.style?.config.gradient?.rules.similarColorTags.forEach((tag) => {
          this.validateTag(allColorTags, tag);
        });

        const similarColorTags = new Set(
          recipe.style?.config.gradient?.rules.similarColorTags
        );
        const mismatchTags = [];
        recipe.style?.config.gradient?.rules.contrastingColorTags.forEach(
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

      if (recipe.background.$ === BackgroundType.ColoredBackgroundInfo) {
        if (recipe.style?.config.gradient) {
          throw new UserError(
            "BG has a singular color where as styling defines gradient colors",
            "BG_TAG_MISMATCH"
          );
        }

        this.validateTag(allColorTags, recipe.background.style?.color?.primary);
      }
    }
  }
}
