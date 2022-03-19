import { Blend } from "server/base/models/blend";
import { Batch } from "server/base/models/batch";

export class LibraryItems {
  blends: Blend[];
  batches: Batch[];
  nextPageKey?: string;
}
