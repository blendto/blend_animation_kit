import { Readable, Stream } from "stream";

export const bufferToStream = (binary: Buffer) => {
  const readableInstanceStream = new Readable({
    read() {
      this.push(binary);
      this.push(null);
    },
  });
  return readableInstanceStream;
};

export const streamToBuffer = async (stream: Stream) =>
  new Promise<Buffer>((resolve, reject) => {
    // eslint-disable-next-line no-underscore-dangle
    const _buf = Array<unknown>();

    stream.on("data", (chunk) => _buf.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(_buf as Uint8Array[])));
    stream.on("error", (err) =>
      // eslint-disable-next-line prefer-promise-reject-errors
      reject(`error converting stream - ${JSON.stringify(err)}`)
    );
  });
