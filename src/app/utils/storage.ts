import { VideoFileInfo } from "@/lib/types";
import Keyv from "keyv";
import { logger } from "./logger";

// 创建keyv实例，使用内存存储
const storage = new Keyv<VideoFileInfo>();

const screenshotStorage = new Keyv<string>();

// 默认过期时间：24小时
const DEFAULT_EXPIRE_HOURS = parseInt(process.env.VIDEO_EXPIRE_HOURS || "24");

/**
 * 存储视频文件信息
 * @param videoId 视频ID
 * @param filePath 文件路径
 * @param expireHours 过期时间（小时），默认24小时
 */
export async function storeVideoFile(
  videoId: string,
  filePath: string,
  expireHours: number = DEFAULT_EXPIRE_HOURS
): Promise<void> {
  const expiresAt = Date.now() + expireHours * 60 * 60 * 1000;
  const videoFileInfo: VideoFileInfo = {
    id: videoId,
    filePath,
    expiresAt,
  };

  await storage.set(videoId, videoFileInfo, expireHours * 60 * 60 * 1000);
  logger.debug(`视频文件信息已存储: ${videoId} -> ${filePath}`);
}

/**
 * 获取视频文件信息
 * @param videoId 视频ID
 * @returns 视频文件信息或null
 */
export async function getVideoFile(
  videoId: string
): Promise<VideoFileInfo | null> {
  const videoFileInfo = await storage.get(videoId);
  if (!videoFileInfo) {
    return null;
  }

  // 检查是否过期
  if (Date.now() > videoFileInfo.expiresAt) {
    await storage.delete(videoId);
    logger.debug(`视频文件已过期，已删除: ${videoId}`, {
      verbose: true,
    });
    return null;
  }

  return videoFileInfo;
}

/**
 * 删除视频文件信息
 * @param videoId 视频ID
 */
export async function deleteVideoFile(videoId: string): Promise<void> {
  await storage.delete(videoId);
  logger.debug(`视频文件信息已删除: ${videoId}`, {
    verbose: true,
  });
}

/**
 * 获取所有过期的视频文件
 * @returns 过期的视频文件列表
 */
export async function getExpiredVideoFiles(): Promise<VideoFileInfo[]> {
  const expiredFiles: VideoFileInfo[] = [];
  const now = Date.now();

  // 由于keyv没有直接的方法获取所有键，我们需要通过其他方式
  // 这里我们返回一个空数组，实际的清理逻辑在cleanup.ts中实现
  return expiredFiles;
}

/**
 * 清理过期的视频文件
 * @param videoId 视频ID
 * @param filePath 文件路径
 */
export async function cleanupExpiredVideo(
  videoId: string,
  filePath: string
): Promise<void> {
  try {
    const { unlink } = await import("node:fs/promises");
    await unlink(filePath);
    await deleteVideoFile(videoId);
    logger.debug(`过期视频文件已清理: ${videoId} -> ${filePath}`, {
      verbose: true,
    });
  } catch (error) {
    logger.error([`清理视频文件失败: ${videoId} -> ${filePath}`, error]);
  }
}

/**
 * 存储截图
 * @param videoId 视频ID
 * @param screenshot 截图
 * @param expireHours 过期时间（小时），默认24小时
 */
export async function storeScreenshot(
  videoId: string,
  screenshot: string,
  expireHours: number = DEFAULT_EXPIRE_HOURS
): Promise<void> {
  await screenshotStorage.set(
    videoId,
    screenshot,
    expireHours * 60 * 60 * 1000
  );
  logger.debug(`截图已存储: ${videoId} -> ${screenshot}`);
}

/**
 * 获取截图
 * @param videoId 视频ID
 * @returns 截图或null
 */
export async function getScreenshot(videoId: string): Promise<string | null> {
  const screenshot = await screenshotStorage.get(videoId);
  if (!screenshot) {
    return null;
  }
  return screenshot;
}
