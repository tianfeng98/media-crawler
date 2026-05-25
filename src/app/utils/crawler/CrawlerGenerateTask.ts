import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { AtomTask, Task } from "task-runner-plus";
import { replaceIllegalCharsInPath } from "../common";
import { CrawlerTask, CrawlerTaskCtx, CrawlerTaskOptions } from "./CrawlerTask";

export class CrawlerGenerateTask extends CrawlerTask {
  constructor(websiteUrl: string, options: CrawlerTaskOptions) {
    super(websiteUrl, options);
  }

  public async createExtractTask() {
    const extractTask = new Task<CrawlerTaskCtx>(
      { id: `Extract_${this.id}`, name: "提取视频信息" },
      {
        sharedCtx: this.ctx,
      },
    );
    this.ctx.bindTask(extractTask);

    const webInitAtomTasks = await this.createWebInitAtomTask();

    extractTask.setAtomTasks(webInitAtomTasks);

    return extractTask;
  }

  public async createDownloadTask() {
    const downloadTask = new Task<CrawlerTaskCtx>(
      { id: `Download_${this.id}`, name: "下载视频" },
      {
        sharedCtx: this.ctx,
      },
    );
    this.ctx.bindTask(downloadTask);
    downloadTask.setAtomTasks([
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          const mediaResponse = ctx.get("mediaResponse");
          if (!mediaResponse) {
            throw new Error("未获取媒体响应");
          }
          const videoInfo = ctx.get("videoInfo");
          if (!videoInfo) {
            throw new Error("视频信息未获取");
          }
          const outputFolder = ctx.get("outputFolder");
          if (!outputFolder) {
            throw new Error("输出文件夹未获取");
          }
          const body = await mediaResponse.body();
          await writeFile(
            join(outputFolder, replaceIllegalCharsInPath(videoInfo.title)),
            body,
          );
        },
      }),
    ]);

    return downloadTask;
  }

  public async getResourceResponse() {
    const page = this.ctx.get("page");
    if (!page) {
      throw new Error("页面未创建");
    }
    return page.waitForResponse(
      async (res) => {
        const contentType = res.headers()["content-type"];
        return (
          contentType.startsWith("video/") || contentType.startsWith("audio/")
        );
      },
      {
        timeout: this.browserTimeout,
      },
    );
  }
}
