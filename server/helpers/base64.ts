export default class Base64 {
  static decode = (str: string): string =>
    Buffer.from(str, "base64").toString("binary");
  static encode = (str: string): string =>
    Buffer.from(str, "binary").toString("base64");
}
