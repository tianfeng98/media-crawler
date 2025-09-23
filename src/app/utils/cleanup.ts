import { readdir, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "./logger";

// 清理间隔：60分钟
const CLEANUP_INTERVAL_MINUTES = parseInt(
  process.env.CLEANUP_INTERVAL_MINUTES || "60"
);
const CLEANUP_INTERVAL_MS = CLEANUP_INTERVAL_MINUTES * 60 * 1000;

// 默认过期时间：24小时
const DEFAULT_EXPIRE_HOURS = parseInt(process.env.VIDEO_EXPIRE_HOURS || "24");
const EXPIRE_MS = DEFAULT_EXPIRE_HOURS * 60 * 60 * 1000;

let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * 清理指定目录中的过期文件
 * @param dirPath 目录路径
 */
async function cleanupDirectory(dirPath: string): Promise<void> {
  try {
    const files = await readdir(dirPath);
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      const filePath = join(dirPath, file);
      try {
        const stats = await stat(filePath);
        const fileAge = now - stats.mtime.getTime();

        // 如果文件超过过期时间，删除它
        if (fileAge > EXPIRE_MS) {
          await unlink(filePath);
          cleanedCount++;
          logger.debug(`已删除过期文件: ${filePath}`, {
            verbose: true,
          });
        }
      } catch (error) {
        logger.error([`清理文件时出错: ${filePath}`, error]);
      }
    }

    if (cleanedCount > 0) {
      logger.debug([`清理完成，删除了 ${cleanedCount} 个过期文件`], {
        verbose: true,
      });
    }
  } catch (error) {
    logger.error([`清理目录失败: ${dirPath}`, error]);
  }
}

/**
 * 启动定期清理任务
 */
export function startCleanupTask(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  const downloadFolder =
    process.env.DOWNLOAD_FOLDER || join(process.cwd(), "downloads");

  // 立即执行一次清理
  cleanupDirectory(downloadFolder).catch((error) => {
    logger.error(["初始清理任务失败", error]);
  });

  // 设置定期清理
  cleanupTimer = setInterval(() => {
    cleanupDirectory(downloadFolder).catch((error) => {
      logger.error(["定期清理任务失败", error]);
    });
  }, CLEANUP_INTERVAL_MS);

  logger.debug(`清理任务已启动，间隔: ${CLEANUP_INTERVAL_MINUTES} 分钟`, {
    verbose: true,
  });
}

/**
 * 停止清理任务
 */
export function stopCleanupTask(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    logger.debug("清理任务已停止", {
      verbose: true,
    });
  }
}

/**
 * 手动执行清理任务
 * @param dirPath 可选，指定清理的目录
 */
export async function runCleanupTask(dirPath?: string): Promise<void> {
  const targetDir =
    dirPath || process.env.DOWNLOAD_FOLDER || join(process.cwd(), "downloads");
  await cleanupDirectory(targetDir);
}
