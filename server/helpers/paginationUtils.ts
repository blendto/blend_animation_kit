import Base64 from "./base64";

export class EncodedPageKey {
  key: string | null;

  constructor(pageKeyString) {
    this.key = pageKeyString;
  }

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
    return this.key != null && this.key != "null";
  }

  isValid(): boolean {
    return typeof this.key == "string";
  }

  decode(): Record<any, any> | null {
    if (!this.exists() || !this.isValid()) {
      return null;
    }
    return JSON.parse(Base64.decode(this.key));
  }
}
