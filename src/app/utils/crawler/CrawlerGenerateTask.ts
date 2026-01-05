import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AtomTask, Task } from "task-runner-plus";
import { replaceIllegalCharsInPath } from "../common";
import { CrawlerTask, CrawlerTaskCtx, CrawlerTaskOptions } from "./CrawlerTask";

export class CrawlerGenerateTask extends CrawlerTask {
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

    const webInitAtomTasks = await this.createWebInitAtomTask();
    const findResourceTask = new AtomTask<CrawlerTaskCtx>({
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
        ctx.mediaResponse = await ctx.page.waitForResponse(
          async (res) => {
            const contentType = res.headers()["content-type"];
            return (
              contentType.startsWith("video/") ||
              contentType.startsWith("audio/")
            );
          },
          {
            timeout: this.browserTimeout,
          }
        );
      },
    });

    extractTask.setAtomTasks([...webInitAtomTasks, findResourceTask]);

    return extractTask;
  }

  public async createDownloadTask(ctx: CrawlerTaskCtx) {
    const downloadTask = new Task<CrawlerTaskCtx>(
      { id: `Download_${this.id}`, name: "下载视频" },
      {
        ctx,
      }
    );
    downloadTask.setAtomTasks([
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          if (!ctx.mediaResponse) {
            throw new Error("未获取媒体响应");
          }
          const body = await ctx.mediaResponse.body();
          await writeFile(
            join(
              ctx.outputFolder,
              replaceIllegalCharsInPath(ctx.videoInfo.title)
            ),
            body
          );
        },
      }),
    ]);

    return downloadTask;
  }
}
