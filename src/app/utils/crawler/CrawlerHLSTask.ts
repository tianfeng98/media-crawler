import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { isNumber } from "radashi";
import { AtomTask, Task } from "task-runner-plus";
import { replaceIllegalCharsInPath } from "../common";
import { parseM3u8 } from "../hls";
import { CrawlerTask, CrawlerTaskCtx, CrawlerTaskOptions } from "./CrawlerTask";
import { downloadItem } from "./utils";

export class CrawlerHLSTask extends CrawlerTask {
  constructor(websiteUrl: string, options: CrawlerTaskOptions) {
    super(websiteUrl, options);
  }

  public async createExtractTask(ctx: CrawlerTaskCtx) {
    const extractTask = new Task<CrawlerTaskCtx>(
      { id: `Extract_${this.id}`, name: "提取视频信息" },
      {
        ctx,
      }
    );
    ctx.logger.debug(["正在分析页面", this.websiteUrl]);
    const webInitAtomTasks = await this.createWebInitAtomTask();
    const findResourceTask = new AtomTask<CrawlerTaskCtx>({
      exec: async ({ ctx, execCount }) => {
        if (!ctx.page) {
          throw new Error("页面未创建");
        }
        ctx.logger.debug("正在获取m3u8内容");
        if (execCount > 1) {
          ctx.page.reload({
            timeout: this.browserTimeout,
            waitUntil: "domcontentloaded",
          });
        }
        ctx.mediaResponse = await ctx.page.waitForResponse(
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
          }
        );
      },
      processMsg: "正在获取m3u8内容",
      successMsg: "获取m3u8内容成功",
      errorMsg: "获取m3u8内容失败",
    });

    extractTask.setAtomTasks([
      ...webInitAtomTasks,
      findResourceTask,
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          if (!ctx.mediaResponse) {
            throw new Error("未获取媒体响应");
          }
          const m3u8Url = ctx.mediaResponse.url();
          const m3u8Content = await ctx.mediaResponse.text();

          ctx.logger.debug("获取m3u8内容成功, 开始写入 index.m3u8 文件");

          const {
            downloadItems,
            keyDownloadItem,
            localM3u8FileContent,
          } = parseM3u8(m3u8Url, m3u8Content);

          ctx.downloadItems = [...downloadItems];
          if (keyDownloadItem) {
            ctx.downloadItems.unshift(keyDownloadItem);
          }

          const videoDir = join(
            ctx.outputFolder,
            replaceIllegalCharsInPath(ctx.videoInfo.title)
          );
          await mkdir(videoDir, { recursive: true });
          await writeFile(join(videoDir, "index.m3u8"), localM3u8FileContent);

          ctx.logger.debug([
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

  public async createDownloadTask(ctx: CrawlerTaskCtx) {
    const hlsConcurrency = Number(process.env.CRAWLER_HLS_CONCURRENCY);
    const concurrency = isNumber(hlsConcurrency) ? hlsConcurrency : 5;
    ctx.logger.debug(["开始下载HLS分片, 并发下载数", concurrency]);
    const downloadTask = new Task<CrawlerTaskCtx>(
      { id: `Download_${this.id}`, name: "下载视频" },
      {
        ctx,
        concurrency,
      }
    );
    const inspectTask = new AtomTask<CrawlerTaskCtx>({
      exec: async ({ ctx }) => {
        if (!ctx.downloadItems || ctx.downloadItems.length === 0) {
          ctx.logger.error(["未获取下载项"]);
          throw new Error("未获取下载项");
        }
        ctx.logger.debug(["下载项", ctx.downloadItems.length]);
        const atomTasks = ctx.downloadItems.map<AtomTask<CrawlerTaskCtx>>(
          (item) => {
            const { filename, type } = item;
            if (type === "key") {
              return new AtomTask<CrawlerTaskCtx>({
                exec: async ({ ctx, execCount }) => {
                  if (!ctx.page) {
                    throw new Error("页面未创建");
                  }
                  if (execCount > 1) {
                    ctx.page.reload({
                      timeout: this.browserTimeout,
                      waitUntil: "domcontentloaded",
                    });
                  }
                  ctx.logger.debug(["开始写入key文件", filename]);
                  const keyResponse = await ctx.page.waitForResponse(
                    async (res) => {
                      const url = res.url();
                      const urlObj = new URL(url);
                      return urlObj.pathname.endsWith(filename);
                    },
                    {
                      timeout: this.browserTimeout,
                    }
                  );
                  const body = await keyResponse.body();
                  await writeFile(
                    join(
                      ctx.outputFolder,
                      replaceIllegalCharsInPath(ctx.videoInfo.title),
                      replaceIllegalCharsInPath(filename)
                    ),
                    body
                  );
                },
                processMsg: "正在写入key文件",
                successMsg: "已写入key文件",
                errorMsg: "写入key文件失败",
              });
            }
            return new AtomTask(
              {
                exec: () => {
                  if (!ctx.page) {
                    throw new Error("页面未创建");
                  }
                  return downloadItem(item, {
                    videoDir: join(
                      ctx.outputFolder,
                      replaceIllegalCharsInPath(ctx.videoInfo.title)
                    ),
                    page: ctx.page,
                  });
                },
                processMsg: `下载分片 ${item.filename}`,
                successMsg: `分片 ${item.filename} 下载完成`,
                errorMsg: `分片 ${item.filename} 下载失败`,
              },
              {
                retryTimes: 3,
              }
            );
          }
        );
        ctx.addAtomTasks(atomTasks);
      },
      processMsg: "检查下载项",
      successMsg: "检查下载项成功",
      errorMsg: "检查下载项失败",
    });
    downloadTask.setAtomTasks([inspectTask]);
    return downloadTask;
  }
}
