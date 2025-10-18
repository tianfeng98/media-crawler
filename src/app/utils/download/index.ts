import { TaskStepEnum, VideoInfo } from "@/lib/types";
import { existsSync } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "os";
import pLimit from "p-limit";
import playwright, { devices } from "playwright";
import { retry } from "radashi";
import { rimraf } from "rimraf";
import { replaceIllegalCharsInPath } from "../common";
import { downloadEventEmitter } from "../event";
import { runFFmpeg, runFFmpegScreenshot } from "../ffmpeg";
import { writeFileByBase64 } from "../file";
import { parseM3u8 } from "../hls";
import { logger } from "../logger";

const downloadM3u8FromWebsite = async ({
  browserType = "chromium",
  outputDir,
  websiteUrl,
  videoId,
  verbose,
  timeout,
  headless,
  fileName,
  onProgress,
}: {
  browserType?: "chromium" | "firefox" | "webkit";
  outputDir: string;
  websiteUrl: string;
  videoId: string;
  verbose?: boolean;
  timeout?: number;
  headless?: boolean;
  fileName?: string;
  onProgress?: (step: TaskStepEnum, percent: number, message: string) => void;
}) => {
  let videoName = fileName ? replaceIllegalCharsInPath(fileName) : "";
  logger.debug(["正在分析页面", websiteUrl], {
    verbose,
  });
  // Setup
  const {
    PLAYWRIGHT_SERVER_ENDPOINT,
    PLAYWRIGHT_EXECUTABLE_PATH,
  } = process.env;
  onProgress?.(TaskStepEnum.Extract, 0, "正在连接浏览器");
  const browser = PLAYWRIGHT_SERVER_ENDPOINT
    ? await playwright["webkit"].connect(`ws://${PLAYWRIGHT_SERVER_ENDPOINT}`, {
        timeout,
      })
    : await playwright["webkit"].launch({
        headless,
        timeout,
        executablePath: PLAYWRIGHT_EXECUTABLE_PATH,
      });
  const device = "iPhone 15 Pro Max";
  onProgress?.(
    TaskStepEnum.Extract,
    20,
    `已成功连接浏览器，正在启动设备 ${device}`
  );
  const context = await browser.newContext(
    devices[device]
    // devices["Desktop Chrome"]
  );
  onProgress?.(
    TaskStepEnum.Extract,
    25,
    `设备${device} 启动成功，正在打开新页面`
  );

  const page = await context.newPage();

  onProgress?.(TaskStepEnum.Extract, 30, "已打开新页面，正在访问网站");

  try {
    await page.goto(websiteUrl, {
      timeout,
      waitUntil: "domcontentloaded",
    });

    onProgress?.(TaskStepEnum.Extract, 35, "已访问网站，正在获取网页标题");

    if (!videoName) {
      const pageTitle = await page.title();
      videoName = `${replaceIllegalCharsInPath(pageTitle)}-${videoId}`;
    }

    onProgress?.(
      TaskStepEnum.Extract,
      40,
      `网页标题: ${videoName}，正在获取m3u8内容`
    );

    logger.debug(`正在获取m3u8内容`, {
      verbose,
    });

    let waitInl: NodeJS.Timeout | null = null;
    if (timeout) {
      waitInl = setTimeout(() => {
        page.reload({
          timeout,
          waitUntil: "domcontentloaded",
        });
        onProgress?.(
          TaskStepEnum.Extract,
          41,
          `等待m3u8内容时间较长，刷新重试`
        );
      }, timeout / 2);
    }

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

    if (waitInl) {
      clearTimeout(waitInl);
    }

    const m3u8Url = m3u8Res.url();
    const m3u8Content = await m3u8Res.text();

    onProgress?.(
      TaskStepEnum.Extract,
      45,
      `已获取m3u8内容，正在开始写入m3u8文件`
    );

    logger.debug(`获取m3u8内容成功`, {
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

    onProgress?.(
      TaskStepEnum.Extract,
      100,
      `已写入m3u8文件，正在下载m3u8文件中的分片`
    );

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
      onProgress?.(TaskStepEnum.Extract, 100, `已写入key文件`);
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
          const output = join(videoDir, replaceIllegalCharsInPath(filename));
          if (existsSync(output)) {
            logger.debug(`${index} ${filename} 已存在`, {
              verbose,
            });
            return true;
          }
          const base64Str = await retry({ times: 3, delay: 1000 }, async () => {
            return page.evaluate(
              ({ input }) => {
                return window
                  .fetch(input)
                  .then((res) => res.blob())
                  .then(
                    (blob) =>
                      new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = function(e) {
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
          });
          logger.debug([`base64Str length ${index}`, base64Str.length], {
            verbose,
          });
          return writeFileByBase64(base64Str, output).then((success) => {
            if (success) {
              const percent = Math.round((++count * 100) / allCount);
              logger.debug(`${count} / ${allCount} ${filename} 下载完成`, {
                verbose,
              });
              onProgress?.(TaskStepEnum.Download, percent, "HLS分片下载中");
            } else {
              logger.error(`${index} ${filename} 下载失败`);
              onProgress?.(TaskStepEnum.Download, 0, "HLS分片下载失败");
            }
          });
        }, item)
      )
    );

    logger.debug(`${videoName} 下载完成`);
  } catch (error) {
    await page.screenshot({
      path: join(outputDir, `${videoName}-screenshot-error.png`),
    });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }

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
  try {
    const videoName = await downloadM3u8FromWebsite({
      timeout: 60 * 1000,
      outputDir: folder,
      websiteUrl,
      fileName,
      videoId: id,
      onProgress(step, percent, message) {
        downloadEventEmitter.emit("progress", id, {
          percent,
          step,
          progressMessage: message,
        });
      },
    });
    logger.debug("开始转换");
    const res = await runFFmpeg(
      join(folder, videoName, "index.m3u8"),
      join(folder, `${videoName}.mp4`),
      {
        onProgress({ currentMilliseconds, totalMilliseconds }) {
          const percent = Math.round(
            (currentMilliseconds * 100) / totalMilliseconds
          );
          downloadEventEmitter.emit("progress", id, {
            percent,
            step: TaskStepEnum.Convert,
            progressMessage: "格式转换中",
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
        duration: res.totalMilliseconds,
        size,
        format: "mp4",
        id,
      };

      const { output: screenshotOutput } = await runFFmpegScreenshot(
        res.output,
        join(folder, `${videoName}-screenshot.png`),
        {}
      );

      downloadEventEmitter.emit("success", id, {
        videoInfo,
        output: res.output,
        screenshot: screenshotOutput,
        progressMessage: "格式转换完成",
      });
      return videoInfo;
    }
    logger.error(["下载失败", "转换失败"]);
    downloadEventEmitter.emit("error", id, {
      error: "转换失败",
      screenshot: join(folder, `${videoName}-screenshot-error.png`),
    });
    return null;
  } catch (error) {
    const errMsg = (error as Error).message;
    logger.error(["下载失败", errMsg]);
    downloadEventEmitter.emit("error", id, {
      error: errMsg,
      screenshot: join(folder, `${id}-screenshot-error.png`),
    });
    return null;
  }
};
