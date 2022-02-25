import Base64 from "./base64";

// eslint-disable-next-line import/prefer-default-export
export class EncodedPageKey {
  key: string | null;

  constructor(pageKeyString) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.key = pageKeyString;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static fromObject(obj: any): EncodedPageKey | null {
    if (!obj) {
      return null;
    }
    return new EncodedPageKey(Base64.encode(JSON.stringify(obj)));
  }

  // "null" as a string is ignored for pageKey. Its okay.
  // It's not fair. The client should not have send "null"
  // World is not fair!
  exists(): boolean {
    return this.key !== null && this.key !== "null";
  }

  isValid(): boolean {
    return typeof this.key === "string";
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  decode(): Record<any, any> | null {
    if (!this.exists() || !this.isValid()) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return JSON.parse(Base64.decode(this.key));
  }
}
