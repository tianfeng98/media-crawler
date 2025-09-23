import { createWriteStream, existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface WriteFileByResponseOptions {
  overwrite?: boolean;
}

export const writeFileByResponse = async (
  response: Response,
  output: string,
  { overwrite }: WriteFileByResponseOptions = {}
) => {
  if (existsSync(output) && !overwrite) {
    return true;
  }
  const reader = response.body?.getReader();
  if (!reader) {
    return false;
  }
  await mkdir(dirname(output), { recursive: true });
  const writeStream = createWriteStream(output);
  return new Promise<boolean>(async (resolve) => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        writeStream.end();
        resolve(true);
        break;
      }
      writeStream.write(value);
    }
  });
};

export const writeFileByBase64 = async (
  base64Str: string,
  output: string,
  { overwrite }: WriteFileByResponseOptions = {}
) => {
  if (existsSync(output) && !overwrite) {
    return true;
  }
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, Buffer.from(base64Str, "base64"));
  return true;
};
