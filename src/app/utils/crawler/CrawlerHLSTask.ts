import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isNumber } from "radashi";
import { AtomTask, AtomTaskStatus, Task } from "task-runner-plus";
import { replaceIllegalCharsInPath } from "../common";
import { parseM3u8 } from "../hls";
import { CrawlerTask, CrawlerTaskCtx, CrawlerTaskOptions } from "./CrawlerTask";
import { downloadItem } from "./utils";

export class CrawlerHLSTask extends CrawlerTask {
  constructor(websiteUrl: string, options: CrawlerTaskOptions) {
    super(websiteUrl, options);
  }

  public async createExtractTask() {
    const extractTask = new Task<CrawlerTaskCtx>(
      {
        id: `Extract_${this.id}`,
        name: "提取视频信息",
      },
      {
        sharedCtx: this.ctx,
      },
    );
    this.ctx.bindTask(extractTask);
    const webInitAtomTasks = this.createWebInitAtomTask();
    const getTitleAtomTask = this.createGetTitleAtomTask();
    const findResourceTask = new AtomTask<CrawlerTaskCtx>({
      exec: async ({ ctx, execCount }) => {
        const page = ctx.get("page");
        if (!page) {
          throw new Error("页面未创建");
        }
        const logger = ctx.get("logger");
        logger?.debug("正在获取m3u8内容");
        if (execCount > 1) {
          page.reload({
            timeout: this.browserTimeout,
            waitUntil: "domcontentloaded",
          });
        }
        ctx.set(
          "mediaResponse",
          await page.waitForResponse(
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
              timeout: this.browserTimeout,
            },
          ),
        );
      },
      processMsg: "正在获取m3u8内容",
      successMsg: "获取m3u8内容成功",
      errorMsg: "获取m3u8内容失败",
    });

    extractTask.setAtomTasks([
      ...webInitAtomTasks,
      findResourceTask,
      getTitleAtomTask,
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          const mediaResponse = ctx.get("mediaResponse");
          const logger = ctx.get("logger");
          if (!mediaResponse) {
            throw new Error("未获取媒体响应");
          }
          const outputFolder = ctx.get("outputFolder");
          if (!outputFolder) {
            throw new Error("输出文件夹未获取");
          }
          const videoInfo = ctx.get("videoInfo");
          if (!videoInfo) {
            throw new Error("视频信息未获取");
          }
          const m3u8Url = mediaResponse.url();
          const m3u8Content = await mediaResponse.text();

          logger?.debug("获取m3u8内容成功, 开始写入 index.m3u8 文件");

          const { downloadItems, keyDownloadItem, localM3u8FileContent } =
            parseM3u8(m3u8Url, m3u8Content);

          const items = [...downloadItems];

          if (keyDownloadItem) {
            items.unshift(keyDownloadItem);
          }

          ctx.set("downloadItems", items);

          const videoDir = join(
            outputFolder,
            replaceIllegalCharsInPath(videoInfo.title),
          );
          await mkdir(videoDir, { recursive: true });
          await writeFile(join(videoDir, "index.m3u8"), localM3u8FileContent);

          logger?.debug([
            "index.m3u8 文件写入完成",
            join(videoDir, "index.m3u8"),
          ]);
        },
        processMsg: "写入m3u8内容",
        successMsg: "写入m3u8内容成功",
        errorMsg: "写入m3u8内容失败",
      }),
    ]);

    return extractTask;
  }

  public async createDownloadTask() {
    const hlsConcurrency = Number(process.env.CRAWLER_HLS_CONCURRENCY);
    const concurrency = isNumber(hlsConcurrency) ? hlsConcurrency : 5;
    const downloadTask = new Task<CrawlerTaskCtx>(
      { id: `Download_${this.id}`, name: "下载视频" },
      {
        sharedCtx: this.ctx,
        concurrency,
      },
    );
    this.ctx.bindTask(downloadTask);
    const inspectTask = new AtomTask<CrawlerTaskCtx>({
      exec: async ({ ctx }) => {
        const downloadItems = ctx.get("downloadItems");
        const logger = ctx.get("logger");
        if (!downloadItems || downloadItems.length === 0) {
          throw new Error("未获取下载项");
        }
        logger?.debug(["下载项", downloadItems.length]);
        const atomTasks = downloadItems.map<AtomTask<CrawlerTaskCtx>>(
          (item) => {
            const { filename, type } = item;
            if (type === "key") {
              return new AtomTask<CrawlerTaskCtx>({
                exec: async ({ ctx: _ctx, execCount }) => {
                  const page = _ctx.get("page");
                  const _logger = _ctx.get("logger");
                  if (!page) {
                    throw new Error("页面未创建");
                  }
                  const outputFolder = _ctx.get("outputFolder");
                  if (!outputFolder) {
                    throw new Error("输出文件夹未获取");
                  }
                  const videoInfo = _ctx.get("videoInfo");
                  if (!videoInfo) {
                    throw new Error("视频信息未获取");
                  }
                  if (execCount > 1) {
                    page.reload({
                      timeout: this.browserTimeout,
                      waitUntil: "domcontentloaded",
                    });
                  }
                  _logger?.debug(["开始写入key文件", filename]);
                  const keyResponse = await page.waitForResponse(
                    async (res) => {
                      const url = res.url();
                      const urlObj = new URL(url);
                      return urlObj.pathname.endsWith(filename);
                    },
                    {
                      timeout: this.browserTimeout,
                    },
                  );
                  const body = await keyResponse.body();
                  await writeFile(
                    join(
                      outputFolder,
                      replaceIllegalCharsInPath(videoInfo.title),
                      replaceIllegalCharsInPath(filename),
                    ),
                    body,
                  );
                },
                processMsg: "正在写入key文件",
                successMsg: "已写入key文件",
                errorMsg: "写入key文件失败",
              });
            }
            return new AtomTask(
              {
                exec: async ({ ctx: _ctx }) => {
                  const page = _ctx.get("page");
                  const _logger = _ctx.get("logger");
                  if (!page) {
                    throw new Error("页面未创建");
                  }
                  const outputFolder = _ctx.get("outputFolder");
                  if (!outputFolder) {
                    throw new Error("输出文件夹未获取");
                  }
                  const videoInfo = _ctx.get("videoInfo");
                  if (!videoInfo) {
                    throw new Error("视频信息未获取");
                  }
                  const downloadRes = await downloadItem(item, {
                    videoDir: join(
                      outputFolder,
                      replaceIllegalCharsInPath(videoInfo.title),
                    ),
                    page,
                  });
                  return downloadRes
                    ? AtomTaskStatus.Completed
                    : AtomTaskStatus.Failed;
                },
                processMsg: `下载分片 ${item.filename}`,
                successMsg: `分片 ${item.filename} 下载完成`,
                errorMsg: `分片 ${item.filename} 下载失败`,
              },
              {
                retryTimes: 3,
              },
            );
          },
        );
        ctx.addAtomTasks?.(atomTasks);
      },
      processMsg: "检查下载项",
      successMsg: "检查下载项成功",
      errorMsg: "检查下载项失败",
    });
    downloadTask.setAtomTasks([inspectTask]);
    return downloadTask;
  }
}
