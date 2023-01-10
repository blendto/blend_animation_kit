import { Blend } from "server/base/models/blend";
import { Recipe } from "server/base/models/recipe";
import { Batch } from "server/base/models/batch";
import { UserError } from "server/base/errors";
import { BlendUpdater } from "server/engine/blend/updater";

export class BatchBlendUpdater {
  batch: Batch;
  constructor(batch: Batch) {
    this.batch = batch;
  }
  validate(blendId: string) {
    if (!this.batch.blends.includes(blendId)) {
      throw new UserError("Blend Id not part of the batch");
    }
  }
  updatedBlend(
    updaterUid: string,
    existingBlend: Blend,
    incomingRecipe: Recipe
  ): Blend {
    return new BlendUpdater(existingBlend, incomingRecipe).updatedBlend(
      updaterUid,
      false
    );
  }
}
