import { TaskStepEnum, type VideoInfo } from "@/lib/types";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "os";
import pLimit from "p-limit";
import { chromium, devices } from "playwright";
import { rimraf } from "rimraf";
import { replaceIllegalCharsInPath } from "../common";
import { downloadEventEmitter } from "../event";
import { runFFmpeg } from "../ffmpeg";
import { writeFileByBase64 } from "../file";
import { parseM3u8 } from "../hls";
import { logger } from "../logger";

const downloadM3u8FromWebsite = async ({
  outputDir,
  websiteUrl,
  verbose,
  timeout,
  headless,
  fileName,
  onProgress,
}: {
  outputDir: string;
  websiteUrl: string;
  verbose?: boolean;
  timeout?: number;
  headless?: boolean;
  fileName?: string;
  onProgress?: (percent: number) => void;
}) => {
  logger.debug(["正在分析页面", websiteUrl], {
    verbose,
  });
  // Setup
  const browser = await chromium.launch({
    headless,
  });
  const context = await browser.newContext(
    devices["iPhone 13 Pro"]
    // devices["Desktop Chrome"]
  );
  const page = await context.newPage();

  await page.goto(websiteUrl, {
    timeout,
    waitUntil: "domcontentloaded",
  });

  let videoName = fileName ? replaceIllegalCharsInPath(fileName) : "";
  if (!videoName) {
    const pageTitle = await page.title();
    videoName = replaceIllegalCharsInPath(pageTitle);
  }

  logger.debug(`正在获取m3u8链接`, {
    verbose,
  });

  const m3u8Res = await page.waitForResponse(
    async (res) => {
      const url = res.url();
      const urlObj = new URL(url);
      if (urlObj.pathname.endsWith(".m3u8")) {
        // 非嵌套m3u8
        const content = await res.text();
        return !content.includes(".m3u8");
      }
      const contentType = res.headers()["content-type"];
      if (["application/x-mpegurl"].includes(contentType)) {
        const content = await res.text();
        return content.startsWith("#EXT");
      }
      return false;
    },
    {
      timeout,
    }
  );
  const m3u8Url = m3u8Res.url();
  const m3u8Content = await m3u8Res.text();

  logger.debug(`获取m3u8链接成功`, {
    verbose,
  });

  const { downloadItems, keyDownloadItem, localM3u8FileContent } = parseM3u8(
    m3u8Url,
    m3u8Content
  );

  const videoDir = join(outputDir, videoName);
  await mkdir(videoDir, { recursive: true });

  logger.debug(`开始写入 index.m3u8 文件`, {
    verbose,
  });
  await writeFile(join(videoDir, "index.m3u8"), localM3u8FileContent);
  logger.debug(`index.m3u8 文件写入完成`, {
    verbose,
  });

  if (keyDownloadItem) {
    logger.debug(`开始写入 key 文件`, {
      verbose,
    });
    const keyResponse = await page.waitForResponse(async (res) => {
      const url = res.url();
      const urlObj = new URL(url);
      return urlObj.pathname.endsWith(keyDownloadItem.filename);
    });
    const body = await keyResponse.body();
    await writeFile(
      join(videoDir, replaceIllegalCharsInPath(keyDownloadItem.filename)),
      body
    );
    logger.debug(`key 文件写入完成`, {
      verbose,
    });
  }

  const limit = pLimit(10);
  let count = 0;
  const allCount = downloadItems.length;
  logger.debug(`开始下载 ${allCount} 个文件`, {
    verbose,
  });
  await Promise.all(
    downloadItems.map((item, index) =>
      limit(async ({ input, filename }) => {
        const base64Str = await page.evaluate(
          ({ input }) => {
            return window
              .fetch(input)
              .then((res) => res.blob())
              .then(
                (blob) =>
                  new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = function (e) {
                      const res = e.target?.result;
                      if (res) {
                        if (typeof res === "string") {
                          if (res.startsWith("data:")) {
                            resolve(res.split(",")[1]);
                          } else {
                            resolve(res);
                          }
                        } else {
                          reject(new Error("result is not a string"));
                        }
                      } else {
                        reject(new Error("result is null"));
                      }
                    };
                    reader.readAsDataURL(blob);
                  })
              );
          },
          {
            input,
            index,
          }
        );
        logger.debug([`base64Str length ${index}`, base64Str.length], {
          verbose,
        });
        const output = join(videoDir, replaceIllegalCharsInPath(filename));
        return writeFileByBase64(base64Str, output).then((success) => {
          if (success) {
            const percent = Math.round((++count * 100) / allCount);
            logger.debug(`${count} / ${allCount} ${filename} 下载完成`, {
              verbose,
            });
            onProgress?.(percent);
          } else {
            logger.error(`${index} ${filename} 下载失败`);
          }
        });
      }, item)
    )
  );

  logger.debug(`${videoName} 下载完成`);

  await context.close();
  await browser.close();

  return videoName;
};

export const downloadVideoFromWebsite = async (
  websiteUrl: string,
  { fileName, taskId }: { fileName?: string; taskId: string }
): Promise<VideoInfo | null> => {
  const id = taskId;
  const folder =
    process.env.DOWNLOAD_FOLDER ??
    join(tmpdir(), "media-crawler", "download", id);
  const videoName = await downloadM3u8FromWebsite({
    timeout: 60 * 1000,
    outputDir: folder,
    websiteUrl,
    fileName,
    onProgress(percent) {
      downloadEventEmitter.emit("progress", id, {
        percent,
        step: TaskStepEnum.Download,
      });
    },
  });
  logger.debug("开始转换");
  const res = await runFFmpeg(
    join(folder, videoName, "index.m3u8"),
    join(folder, `${videoName}.mp4`),
    {
      onProgress({ currentTime, totalTime }) {
        const percent = Math.round((currentTime * 100) / totalTime);
        downloadEventEmitter.emit("progress", id, {
          percent,
          step: TaskStepEnum.Convert,
        });
      },
    }
  );
  if (res) {
    const { size } = await stat(res.output);
    logger.debug("转换完成");
    await rimraf(join(folder, videoName));
    logger.debug("删除HLS完成");
    const videoInfo: VideoInfo = {
      title: videoName,
      duration: res.totalTime,
      size,
      format: "mp4",
      thumbnail: "",
      id,
    };
    downloadEventEmitter.emit("success", id, { videoInfo, output: res.output });
    return videoInfo;
  }
  return null;
};
