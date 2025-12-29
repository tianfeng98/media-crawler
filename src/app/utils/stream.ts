import { Readable } from "node:stream";

/**
 * 将 Node.js 的 ReadableStream (如 fs.createReadStream 返回的流)
 * 转换为 Web 标准的 ReadableStream
 * @param nodeStream Node.js 的可读流
 * @returns Web 标准的 ReadableStream
 */
export function nodeStreamToWebStream(
  nodeStream: Readable
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      // 当数据可读时的处理函数
      nodeStream.on("data", (chunk: Buffer) => {
        // 直接处理 Buffer 类型数据，避免字符串转换问题
        controller.enqueue(new Uint8Array(chunk));
      });

      // 当流结束时的处理函数
      nodeStream.on("end", () => {
        controller.close();
      });

      // 当发生错误时的处理函数
      nodeStream.on("error", (err) => {
        controller.error(err);
      });
    },

    // 取消控制器时的处理函数
    cancel() {
      nodeStream.destroy();
    },
  });
}

/**
 * 将 Web 标准的 ReadableStream 转换为 Node.js 的 ReadableStream
 * @param webStream Web 标准的 ReadableStream
 * @returns Node.js 的可读流
 */
export async function webStreamToNodeStream(
  webStream: ReadableStream<Uint8Array>
): Promise<Readable> {
  const reader = webStream.getReader();
  const nodeStream = new Readable({
    read() {
      // 当 Node.js 流请求更多数据时，从 Web 流中读取
      reader.read().then(({ done, value }) => {
        if (!done) {
          nodeStream.push(value);
        } else {
          nodeStream.push(null); // 标记流结束
        }
      });
    },
  });

  return nodeStream;
}
