import { existsSync } from "node:fs";
import { join } from "node:path";
import { Page } from "playwright";
import { round } from "radashi";
import { replaceIllegalCharsInPath } from "../common";
import { writeFileByBase64 } from "../file";
import { DownloadItem } from "../hls";
import { logger } from "../logger";

const getBase64StrFromPage = async (page: Page, input: string) => {
  return page.evaluate(
    async ({ input }) => {
      const res = await window.fetch(input);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          const res_1 = e.target?.result;
          if (res_1) {
            if (typeof res_1 === "string") {
              if (res_1.startsWith("data:")) {
                resolve(res_1.split(",")[1]);
              } else {
                resolve(res_1);
              }
            } else {
              reject(new Error("result is not a string"));
            }
          } else {
            reject(new Error("result is null"));
          }
        };
        reader.readAsDataURL(blob);
      });
    },
    {
      input,
    }
  );
};

export const getVideoTitle = async (page: Page): Promise<string | null> => {
  return null;
};

export const formatPercent = (percent: number) => {
  return Math.min(100, round(percent, 2));
};

export const downloadItem = async (
  { input, filename }: DownloadItem,
  {
    index,
    verbose,
    videoDir,
    page,
  }: {
    page: Page;
    index: number;
    videoDir: string;
    verbose?: boolean;
  }
) => {
  const output = join(videoDir, replaceIllegalCharsInPath(filename));
  if (existsSync(output)) {
    logger.debug(`${index} ${filename} 已存在`, {
      verbose,
    });
    return true;
  }
  const base64Str = await getBase64StrFromPage(page, input);
  logger.debug([`${index} 写入base64内容长度`, base64Str.length], {
    verbose,
  });
  return writeFileByBase64(base64Str, output);
};
