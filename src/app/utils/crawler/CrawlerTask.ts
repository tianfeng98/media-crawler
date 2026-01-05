import { DownloadItem, TaskStepEnum, VideoInfo } from "@/lib/types";
import { formatPercent } from "@/lib/utils";
import EventEmitter from "events";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "os";
import {
  Browser,
  BrowserContext,
  Page,
  Response as PlaywrightResponse,
  chromium,
  devices,
  webkit,
} from "playwright";
import { uid } from "radashi";
import { rimraf } from "rimraf";
import { AtomTask, Task, TaskStatus } from "task-runner-plus";
import { replaceIllegalCharsInPath } from "../common";
import { runFFmpeg, runFFmpegScreenshot } from "../ffmpeg";
import { logger } from "../logger";
import { getVideoTitle } from "./utils";

export interface CrawlerTaskCtx {
  browser?: Browser;
  context?: BrowserContext;
  page?: Page;
  outputFolder: string;
  videoInfo: VideoInfo;
  mediaResponse?: PlaywrightResponse;
  logger: typeof logger;
  downloadItems: DownloadItem[];
}

export interface CrawlerTaskOptions {
  /**
   * 任务ID
   */
  taskId?: string;
  /**
   * 浏览器超时时间
   */
  browserTimeout?: number;
  /**
   * 输出文件夹
   */
  outputFolder?: string;
}

export class CrawlerTask {
  protected id = uid(24);
  protected websiteUrl: string;
  protected browserTimeout?: number;
  protected ctx: CrawlerTaskCtx;
  eventEmitter = new EventEmitter<{
    progress: [
      string,
      { percent: number; step: TaskStepEnum; progressMessage?: string }
    ];
    success: [
      string,
      {
        videoInfo: VideoInfo;
        output: string;
        screenshot: string;
        progressMessage?: string;
      }
    ];
    error: [string, { error: string; screenshot: string }];
  }>();
  private extractTask?: Task<CrawlerTaskCtx>;
  private downloadTask?: Task<CrawlerTaskCtx>;
  private convertTask?: Task<CrawlerTaskCtx>;

  constructor(
    websiteUrl: string,
    {
      taskId,
      browserTimeout = 30 * 1000,
      outputFolder,
    }: CrawlerTaskOptions = {}
  ) {
    if (taskId) {
      this.id = taskId;
    }
    this.websiteUrl = websiteUrl;
    this.browserTimeout = browserTimeout;
    this.ctx = {
      logger,
      videoInfo: {
        id: this.id,
        title: this.id,
        duration: 0,
        size: 0,
        format: process.env.VIDEO_FORMAT ?? "mp4",
      },
      outputFolder:
        outputFolder ||
        process.env.DOWNLOAD_FOLDER ||
        join(tmpdir(), "media-crawler", "download", this.id),
      downloadItems: [],
    };
  }

  protected async createWebInitAtomTask() {
    const atomTasks: AtomTask<CrawlerTaskCtx>[] = [];
    const {
      PLAYWRIGHT_SERVER_ENDPOINT,
      PLAYWRIGHT_EXECUTABLE_PATH,
      PLAYWRIGHT_HEADLESS,
      PLAYWRIGHT_DEVICE,
    } = process.env;
    const timeout = this.browserTimeout;

    // iPhone 15 Pro Max
    // Desktop Chrome
    const device = PLAYWRIGHT_DEVICE ?? "Desktop Chrome";

    atomTasks.push(
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          ctx.browser = PLAYWRIGHT_SERVER_ENDPOINT
            ? await webkit.connect(`ws://${PLAYWRIGHT_SERVER_ENDPOINT}`, {
                timeout,
              })
            : await chromium.launch({
                headless: PLAYWRIGHT_HEADLESS !== "false",
                timeout,
                executablePath: PLAYWRIGHT_EXECUTABLE_PATH,
              });
        },
        processMsg: "连接浏览器",
        successMsg: "浏览器连接成功",
        errorMsg: "浏览器连接失败",
      }),
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          if (!ctx.browser) {
            throw new Error("浏览器未连接");
          }
          ctx.context = await ctx.browser.newContext(devices[device]);
        },
        processMsg: `启动设备 ${device}`,
        successMsg: `设备${device} 启动成功`,
        errorMsg: `设备${device} 启动失败`,
      }),
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          if (!ctx.context) {
            throw new Error("浏览器上下文未创建");
          }
          ctx.page = await ctx.context.newPage();
        },
        processMsg: "打开页面",
        successMsg: "页面打开成功",
        errorMsg: "页面打开失败",
      }),
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          if (!ctx.page) {
            throw new Error("页面未创建");
          }
          await ctx.page.goto(this.websiteUrl, {
            timeout,
            waitUntil: "domcontentloaded",
          });
        },
        processMsg: "访问网站",
        successMsg: "访问网站成功",
        errorMsg: "访问网站失败",
      }),
      new AtomTask<CrawlerTaskCtx>({
        exec: async ({ ctx }) => {
          if (!ctx.page) {
            throw new Error("页面未创建");
          }
          const videoTitle = await getVideoTitle(ctx.page);
          if (videoTitle.length > 0) {
            ctx.videoInfo.title = videoTitle;
          } else {
            const pageTitle = await ctx.page.title();
            ctx.videoInfo.title = `${replaceIllegalCharsInPath(pageTitle)}-${
              this.id
            }`;
          }
        },
        processMsg: "获取视频标题",
        successMsg: "获取视频标题完成",
        errorMsg: "未获取到视频标题",
      })
    );

    return atomTasks;
  }

  protected async createExtractTask(ctx: CrawlerTaskCtx) {
    return new Task<CrawlerTaskCtx>(
      { id: `Extract_${this.id}`, name: "提取视频信息" },
      {
        ctx,
      }
    );
  }

  protected async createDownloadTask(ctx: CrawlerTaskCtx) {
    return new Task<CrawlerTaskCtx>(
      { id: `Download_${this.id}`, name: "下载视频" },
      {
        ctx,
      }
    );
  }

  protected async createConvertTask(ctx: CrawlerTaskCtx) {
    await ctx.context?.close();
    await ctx.browser?.close();
    const convertTask = new Task<CrawlerTaskCtx>(
      { id: `Convert_${this.id}`, name: "转换视频" },
      {
        ctx,
      }
    );
    convertTask.setAtomTasks([
      new AtomTask({
        exec: async ({ ctx }) => {
          const videoName = replaceIllegalCharsInPath(ctx.videoInfo.title);
          const res = await runFFmpeg(
            join(ctx.outputFolder, videoName, "index.m3u8"),
            join(ctx.outputFolder, `${videoName}.${ctx.videoInfo.format}`),
            {
              onProgress({ currentMilliseconds, totalMilliseconds }) {
                const percent = formatPercent(
                  (currentMilliseconds * 100) / totalMilliseconds
                );

                convertTask.setTaskMsg("格式转换中");
                convertTask.setPercent(percent);
              },
            }
          );
          if (res) {
            convertTask.setTaskMsg("格式转换完成");
            rimraf(join(ctx.outputFolder, videoName));
            const { size } = await stat(res.output);
            ctx.videoInfo.size = size;
            ctx.videoInfo.duration = res.totalMilliseconds;
            runFFmpegScreenshot(
              res.output,
              join(ctx.outputFolder, `${videoName}-screenshot.png`),
              {}
            ).then(({ output: screenshotOutput }) => {
              this.eventEmitter.emit("success", ctx.videoInfo.id, {
                videoInfo: ctx.videoInfo,
                output: res.output,
                screenshot: screenshotOutput,
                progressMessage: convertTask.taskMsg,
              });
            });
          }
        },
        processMsg: "开始转换",
        successMsg: "转换完成",
        errorMsg: "转换失败",
      }),
    ]);

    return convertTask;
  }

  async start() {
    this.extractTask = await this.createExtractTask(this.ctx);
    this.extractTask.event.on("progress", ({ percent, taskInfo }) => {
      this.eventEmitter.emit("progress", this.id, {
        percent,
        step: TaskStepEnum.Extract,
        progressMessage: taskInfo.taskMsg,
      });
    });
    this.extractTask.event.on("complete", ({ taskInfo }) => {
      this.eventEmitter.emit("progress", this.id, {
        percent: 100,
        step: TaskStepEnum.Extract,
        progressMessage: taskInfo.taskMsg,
      });
    });
    this.extractTask.start();
    await this.extractTask.waitForEnd();

    if (this.extractTask.getInfo().status !== TaskStatus.Completed) {
      return;
    }

    this.downloadTask = await this.createDownloadTask(
      this.extractTask.getCtx()
    );
    this.downloadTask.event.on("progress", ({ percent, taskInfo }) => {
      this.eventEmitter.emit("progress", this.id, {
        percent,
        step: TaskStepEnum.Download,
        progressMessage: taskInfo.taskMsg,
      });
    });
    this.downloadTask.event.on("complete", ({ taskInfo }) => {
      this.eventEmitter.emit("progress", this.id, {
        percent: 100,
        step: TaskStepEnum.Download,
        progressMessage: taskInfo.taskMsg,
      });
    });

    this.downloadTask.start();
    await this.downloadTask.waitForEnd();

    if (this.downloadTask.getInfo().status !== TaskStatus.Completed) {
      return;
    }

    this.convertTask = await this.createConvertTask(this.downloadTask.getCtx());
    this.convertTask.start();
    this.convertTask.event.on("progress", ({ percent, taskInfo }) => {
      this.eventEmitter.emit("progress", this.id, {
        percent,
        step: TaskStepEnum.Convert,
        progressMessage: taskInfo.taskMsg,
      });
    });
  }

  destroy() {
    this.eventEmitter.removeAllListeners();
    this.extractTask?.event.all.clear();
    this.downloadTask?.event.all.clear();
    this.convertTask?.event.all.clear();
  }

  getTasksInfo() {
    return [this.extractTask, this.downloadTask, this.convertTask]
      .map((task) => task?.getInfo())
      .filter(Boolean);
  }
}
