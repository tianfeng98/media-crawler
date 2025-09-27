import { TaskStatusEnum, TaskStepEnum, type TaskStatus } from "@/lib/types";
import { downloadEventEmitter } from "./event";
import { logger } from "./logger";
import { storeVideoFile } from "./storage";

// 全局任务状态管理
const taskStatusMap = new Map<string, TaskStatus>();

// 监听下载进度事件
downloadEventEmitter.on("progress", (taskId: string, { percent, step }) => {
  const taskStatus = getTaskStatus(taskId);
  if (taskStatus) {
    taskStatus.status = TaskStatusEnum.Processing;
    taskStatus.progress = { step, percent };
    taskStatusMap.set(taskId, taskStatus);
    logger.debug(`任务进度更新: ${taskId} - ${step} ${percent}%`);
  }
});

// 监听下载成功事件
downloadEventEmitter.on(
  "success",
  async (taskId: string, { videoInfo, output }) => {
    // 存储视频文件信息
    await storeVideoFile(taskId, output);

    // 更新任务状态
    updateTaskStatus(taskId, {
      status: TaskStatusEnum.Completed,
      progress: {
        step: TaskStepEnum.Convert,
        percent: 100,
      },
      videoInfo,
    });
  }
);

// 监听下载错误事件
downloadEventEmitter.on("error", (taskId: string, { error }) => {
  const taskStatus = taskStatusMap.get(taskId);
  if (taskStatus) {
    taskStatus.status = TaskStatusEnum.Error;
    taskStatus.error = error;
    taskStatusMap.set(taskId, taskStatus);
    logger.error(`任务失败: ${taskId} - ${error}`);
  }
});

/**
 * 创建新任务
 * @param taskId 任务ID
 * @param taskStatus 任务状态
 */
export function createTask(taskId: string, taskStatus: TaskStatus): void {
  taskStatusMap.set(taskId, taskStatus);
  logger.debug(`任务已创建: ${taskId}`, {
    verbose: true,
  });
}

/**
 * 获取任务状态
 * @param taskId 任务ID
 * @returns 任务状态或null
 */
export function getTaskStatus(taskId: string): TaskStatus | null {
  return taskStatusMap.get(taskId) || null;
}

/**
 * 更新任务状态
 * @param taskId 任务ID
 * @param updates 更新内容
 */
export function updateTaskStatus(
  taskId: string,
  updates: Partial<TaskStatus>
): void {
  const taskStatus = taskStatusMap.get(taskId);
  if (taskStatus) {
    Object.assign(taskStatus, updates);
    taskStatusMap.set(taskId, taskStatus);
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
  taskStatusMap.delete(taskId);
  logger.debug(`任务已删除: ${taskId}`, {
    verbose: true,
  });
}

/**
 * 获取所有任务状态（用于调试）
 * @returns 所有任务状态
 */
export function getAllTasks(): TaskStatus[] {
  return Array.from(taskStatusMap.values());
}

/**
 * 清理完成的任务（可选）
 * @param maxAge 最大保留时间（毫秒）
 */
export function cleanupCompletedTasks(
  maxAge: number = 24 * 60 * 60 * 1000
): void {
  const now = Date.now();
  const tasksToDelete: string[] = [];

  for (const [taskId, taskStatus] of taskStatusMap.entries()) {
    if (
      taskStatus.status === TaskStatusEnum.Completed ||
      taskStatus.status === TaskStatusEnum.Error
    ) {
      // 这里可以添加时间检查逻辑
      tasksToDelete.push(taskId);
    }
  }

  tasksToDelete.forEach((taskId) => {
    taskStatusMap.delete(taskId);
  });

  if (tasksToDelete.length > 0) {
    logger.debug(`已清理 ${tasksToDelete.length} 个完成的任务`, {
      verbose: true,
    });
  }
}
