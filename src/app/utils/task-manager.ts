import { TaskStatus, TaskStatusEnum, TaskStepEnum } from "@/lib/types";
import KeyvRedis from "@keyv/redis";
import Keyv from "keyv";
import { downloadEventEmitter } from "./event";
import { logger } from "./logger";
import { storeScreenshot, storeVideoFile } from "./storage";

const keyv = new Keyv<TaskStatus>(
  {
    store: new KeyvRedis(process.env.REDIS_URL, {
      namespace: "tasks",
      keyPrefixSeparator: "->",
    }),
  },
  {
    namespace: "tasks",
    ttl: 24 * 60 * 60 * 1000,
  }
);

keyv.on("error", (err) => {
  logger.error(`Redis(${process.env.REDIS_URL}) 连接错误: ${err}`);
});

// 监听下载进度事件
downloadEventEmitter.on(
  "progress",
  async (taskId: string, { percent, step, progressMessage }) => {
    const taskStatus = await getTaskStatus(taskId);
    if (taskStatus) {
      await updateTaskStatus(taskId, {
        status: TaskStatusEnum.Processing,
        progress: { step, percent, message: progressMessage },
      });
      logger.debug(`任务进度更新: ${taskId} - ${step} ${percent}%`);
    }
  }
);

// 监听下载成功事件
downloadEventEmitter.on(
  "success",
  async (
    taskId: string,
    { videoInfo, output, progressMessage, screenshot }
  ) => {
    // 存储视频文件信息
    storeVideoFile(taskId, output);
    storeScreenshot(taskId, screenshot);

    // 更新任务状态
    await updateTaskStatus(taskId, {
      status: TaskStatusEnum.Completed,
      progress: {
        step: TaskStepEnum.Convert,
        percent: 100,
        message: progressMessage,
      },
      videoInfo,
    });
  }
);

// 监听下载错误事件
downloadEventEmitter.on(
  "error",
  async (taskId: string, { error, screenshot }) => {
    const taskStatus = await keyv.get(taskId);
    if (taskStatus) {
      storeScreenshot(taskId, screenshot);
      await updateTaskStatus(taskId, {
        status: TaskStatusEnum.Error,
        error,
      });
      logger.error(`任务失败: ${taskId} - ${error}`);
    }
  }
);

/**
 * 创建新任务
 * @param taskId 任务ID
 * @param taskStatus 任务状态
 */
export function createTask(taskId: string, taskStatus: TaskStatus): void {
  keyv.set(taskId, taskStatus);
  logger.debug(`任务已创建: ${taskId}`, {
    verbose: true,
  });
}

/**
 * 获取任务状态
 * @param taskId 任务ID
 * @returns 任务状态或null
 */
export async function getTaskStatus(
  taskId: string
): Promise<TaskStatus | null | undefined> {
  return keyv.get(taskId);
}

/**
 * 更新任务状态
 * @param taskId 任务ID
 * @param updates 更新内容
 */
export async function updateTaskStatus(
  taskId: string,
  updates: Partial<TaskStatus>
): Promise<void> {
  const taskStatus = keyv.get(taskId);
  if (taskStatus) {
    Object.assign(taskStatus, updates);
    keyv.set(taskId, taskStatus);
    logger.debug(`任务状态已更新: ${taskId}`, {
      verbose: true,
    });
  }
}

/**
 * 删除任务
 * @param taskId 任务ID
 */
export function deleteTask(taskId: string): void {
  keyv.delete(taskId);
  logger.debug(`任务已删除: ${taskId}`, {
    verbose: true,
  });
}
