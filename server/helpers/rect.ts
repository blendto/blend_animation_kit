import logger from "server/base/Logger";
import { TrimLTWH } from "server/base/models/heroImage";

export class Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;

  constructor(left: number, top: number, right: number, bottom: number) {
    this.left = left;
    this.top = top;
    this.right = right;
    this.bottom = bottom;
  }

  public get width(): number {
    return this.right - this.left;
  }

  public get height(): number {
    return this.bottom - this.top;
  }

  toLTWH(): TrimLTWH {
    return [
      this.left,
      this.top,
      this.right - this.left,
      this.bottom - this.top,
    ];
  }

  static tryParseBase64LTRB(b64Str: string): Rect {
    try {
      const arr = JSON.parse(
        Buffer.from(b64Str, "base64").toString()
      ) as Array<number>;
      return new Rect(arr[0], arr[1], arr[2], arr[3]);
    } catch (er) {
      logger.info({
        code: "FAILED_PARSING_B64_CROP",
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        error: er,
      });
    }
  }
}
