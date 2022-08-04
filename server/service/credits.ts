import "reflect-metadata";
import { BlendService } from "server/service/blend";
import { inject, injectable } from "inversify";
import { TYPES } from "server/types";
import { diContainer } from "inversify.config";
import SubscriptionService, {
  NoWatermarkReason,
} from "server/service/subscription";

type RunThis = (
  shouldWatermark: boolean,
  creditServiceActivityLogId: string
) => Promise<void>;

@injectable()
export class CreditsService {
  @inject(TYPES.BlendService) blendService: BlendService;

  async runWithCreditAndWatermarkCheck(
    uid: string,
    blendId: string,
    buildVersion: number,
    clientType: string,
    callback: RunThis
  ): Promise<void> {
    const subscriptionService = diContainer.get<SubscriptionService>(
      TYPES.SubscriptionService
    );

    const {
      can: userCanDoWatermarkFreeExport,
      noWatermarkReason,
      creditServiceActivityLogId,
    } = await subscriptionService.canDoWatermarkFreeExport(
      buildVersion,
      uid,
      blendId,
      clientType
    );
    const shouldWatermark = !userCanDoWatermarkFreeExport;
    try {
      await callback(shouldWatermark, creditServiceActivityLogId);
    } catch (err) {
      if (noWatermarkReason === NoWatermarkReason.USER_HAS_CREDITS) {
        await subscriptionService.reverseCreditUsage(
          creditServiceActivityLogId
        );
      }
      throw err;
    }
  }
}
