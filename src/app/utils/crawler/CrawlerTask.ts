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
import {
  AtomTask,
  AtomTaskStatus,
  Task,
  TaskCtx,
  TaskStatus,
} from "task-runner-plus";
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
  protected readonly ctx: TaskCtx<CrawlerTaskCtx>;
  eventEmitter = new EventEmitter<{
    progress: [
      string,
      { percent: number; step: TaskStepEnum; progressMessage?: string },
    ];
    success: [
      string,
      {
        videoInfo: VideoInfo;
        output: string;
        screenshot: string;
        progressMessage?: string;
      },
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
    }: CrawlerTaskOptions = {},
  ) {
    if (taskId) {
      this.id = taskId;
    }
    this.websiteUrl = websiteUrl;
    this.browserTimeout = browserTimeout;
    this.ctx = new TaskCtx<CrawlerTaskCtx>({
      defaultData: {
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
      },
    });
  }

  protected createWebInitAtomTask() {
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
      new AtomTask({
        exec: async ({ ctx }) => {
          const browser = PLAYWRIGHT_SERVER_ENDPOINT
            ? await webkit.connect(`ws://${PLAYWRIGHT_SERVER_ENDPOINT}`, {
                timeout,
              })
            : await chromium.launch({
                headless: PLAYWRIGHT_HEADLESS !== "false",
                timeout,
                executablePath: PLAYWRIGHT_EXECUTABLE_PATH,
              });
          ctx.set("browser", browser);
        },
        processMsg: "连接浏览器",
        successMsg: "浏览器连接成功",
        errorMsg: "浏览器连接失败",
      }),
      new AtomTask({
        exec: async ({ ctx }) => {
          const browser = ctx.get("browser");
          if (!browser) {
            throw new Error("浏览器未连接");
          }
          ctx.set("context", await browser.newContext(devices[device]));
        },
        processMsg: `启动设备 ${device}`,
        successMsg: `设备${device} 启动成功`,
        errorMsg: `设备${device} 启动失败`,
      }),
      new AtomTask({
        exec: async ({ ctx }) => {
          const context = ctx.get("context");
          if (!context) {
            throw new Error("浏览器上下文未创建");
          }
          ctx.set("page", await context.newPage());
        },
        processMsg: "打开页面",
        successMsg: "页面打开成功",
        errorMsg: "页面打开失败",
      }),
      new AtomTask({
        exec: async ({ ctx }) => {
          const page = ctx.get("page");
          if (!page) {
            throw new Error("页面未创建");
          }
          await page.goto(this.websiteUrl, {
            timeout,
            waitUntil: "domcontentloaded",
          });
        },
        processMsg: "访问网站",
        successMsg: "访问网站成功",
        errorMsg: "访问网站失败",
      }),
      new AtomTask({
        exec: async ({ ctx }) => {
          const page = ctx.get("page");
          if (!page) {
            throw new Error("页面未创建");
          }
          const isVideoExist = await page.evaluate(
            () => document.querySelector("video") !== null,
          );
          if (!isVideoExist) {
            await page.goto(this.websiteUrl, {
              timeout,
              // domcontentloaded事件结束后页面不一定加载完成，若没有video标签，需要等待load事件
              // 才能确保所有资源加载完成
              waitUntil: "load",
            });
          }
        },
        processMsg: "校验网站视频是否存在",
        successMsg: "校验网站视频结束",
        errorMsg: "校验网站视频失败",
      }),
    );

    return atomTasks;
  }

  protected createGetTitleAtomTask() {
    return new AtomTask<CrawlerTaskCtx>({
      exec: async ({ ctx }) => {
        const page = ctx.get("page");
        if (!page) {
          throw new Error("页面未创建");
        }
        const videoInfo = ctx.get("videoInfo");
        if (!videoInfo) {
          throw new Error("视频信息未获取");
        }
        let videoTitle = "";
        try {
          videoTitle = await getVideoTitle(page);
        } catch (e) {
          logger.error(`获取视频标题失败 ${e}`);
        }
        let result = AtomTaskStatus.Failed;
        if (videoTitle.length > 0) {
          videoInfo.title = videoTitle;
          result = AtomTaskStatus.Completed;
        } else {
          const pageTitle = await page.title();
          videoInfo.title = `${replaceIllegalCharsInPath(pageTitle)}-${
            this.id
          }`;
          result = AtomTaskStatus.Warning;
        }
        ctx.set("videoInfo", videoInfo);
        return result;
      },
      processMsg: "获取视频标题",
      successMsg: (ctx) => `获取视频标题完成:${ctx.get("videoInfo")?.title}`,
      errorMsg: "未获取到视频标题",
    });
  }

  protected async createExtractTask() {
    const task = new Task<CrawlerTaskCtx>(
      { id: `Extract_${this.id}`, name: "提取视频信息" },
      {
        sharedCtx: this.ctx,
      },
    );
    this.ctx.bindTask(task);
    return task;
  }

  protected async createDownloadTask() {
    const task = new Task<CrawlerTaskCtx>(
      { id: `Download_${this.id}`, name: "下载视频" },
      {
        sharedCtx: this.ctx,
      },
    );
    this.ctx.bindTask(task);
    return task;
  }

  protected async createConvertTask() {
    const convertTask = new Task<CrawlerTaskCtx>(
      { id: `Convert_${this.id}`, name: "转换视频" },
      {
        sharedCtx: this.ctx,
      },
    );
    this.ctx.bindTask(convertTask);
    convertTask.setAtomTasks([
      new AtomTask({
        exec: async ({ ctx }) => {
          const videoInfo = ctx.get("videoInfo");
          if (!videoInfo) {
            throw new Error("视频信息未获取");
          }
          const videoName = replaceIllegalCharsInPath(videoInfo.title);
          const outputFolder = ctx.get("outputFolder");
          if (!outputFolder) {
            throw new Error("输出文件夹未获取");
          }
          const res = await runFFmpeg(
            join(outputFolder, videoName, "index.m3u8"),
            join(outputFolder, `${videoName}.${videoInfo.format}`),
            {
              onProgress({ currentMilliseconds, totalMilliseconds }) {
                const percent = formatPercent(
                  (currentMilliseconds * 100) / totalMilliseconds,
                );

                convertTask.setTaskMsg("格式转换中");
                convertTask.setPercent(percent);
              },
            },
          );
          if (res) {
            convertTask.setTaskMsg("格式转换完成");
            rimraf(join(outputFolder, videoName));
            const { size } = await stat(res.output);
            videoInfo.size = size;
            videoInfo.duration = res.totalMilliseconds;
            ctx.set("videoInfo", videoInfo);
            runFFmpegScreenshot(
              res.output,
              join(outputFolder, `${videoName}-screenshot.png`),
              {},
            ).then(({ output: screenshotOutput }) => {
              this.eventEmitter.emit("success", videoInfo.id, {
                videoInfo: videoInfo,
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

  private async installTask(task: Task<CrawlerTaskCtx>, step: TaskStepEnum) {
    task.event.on("progress", ({ percent, taskInfo }) => {
      this.eventEmitter.emit("progress", this.id, {
        percent,
        step,
        progressMessage: taskInfo.taskMsg,
      });
    });
    task.event.on("complete", ({ taskInfo }) => {
      this.eventEmitter.emit("progress", this.id, {
        percent: 100,
        step,
        progressMessage: taskInfo.taskMsg,
      });
    });
    task.event.on("error", async ({ taskInfo, error }) => {
      let screenshot = join(
        taskInfo.state.outputFolder,
        `${taskInfo.state.videoInfo.title}-screenshot.png`,
      );
      await taskInfo.state.page?.screenshot({
        type: "png",
        path: screenshot,
      });
      this.eventEmitter.emit("error", this.id, {
        error: [error.name, error.message].join(": "),
        screenshot,
      });
    });
    task.start();
    await task.waitForEnd();
    return task.getTaskInfo().status === TaskStatus.Completed;
  }

  async start() {
    this.extractTask = await this.createExtractTask();
    const extractSuccess = await this.installTask(
      this.extractTask,
      TaskStepEnum.Extract,
    );

    if (extractSuccess) {
      this.downloadTask = await this.createDownloadTask();
      const downloadSuccess = await this.installTask(
        this.downloadTask,
        TaskStepEnum.Download,
      );

      this.destroyPlaywright();

      if (downloadSuccess) {
        this.convertTask = await this.createConvertTask();
        const convertSuccess = await this.installTask(
          this.convertTask,
          TaskStepEnum.Convert,
        );
        return convertSuccess;
      }
    }
    return false;
  }

  async destroyPlaywright() {
    const state = this.extractTask?.getTaskInfo().state;
    await state?.context?.close();
    await state?.browser?.close();
  }

  destroy() {
    this.destroyPlaywright();
    this.eventEmitter.removeAllListeners();
    this.extractTask?.event.all.clear();
    this.downloadTask?.event.all.clear();
    this.convertTask?.event.all.clear();
  }

  getTasksInfo() {
    return [this.extractTask, this.downloadTask, this.convertTask]
      .map((task) => task?.getTaskInfo())
      .filter(Boolean);
  }
}
