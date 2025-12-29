import { VideoFileInfo } from "@/lib/types";
import KeyvRedis from "@keyv/redis";
import Keyv from "keyv";
import { logger } from "./logger";

// 创建keyv实例，使用内存存储
const storage = new Keyv<VideoFileInfo>(
  {
    store: new KeyvRedis(process.env.REDIS_URL, {
      namespace: "files",
      keyPrefixSeparator: "->",
    }),
  },
  {
    namespace: "files",
    ttl: 24 * 60 * 60 * 1000,
  }
);

const screenshotStorage = new Keyv<string>(
  {
    store: new KeyvRedis(process.env.REDIS_URL, {
      namespace: "screenshots",
      keyPrefixSeparator: "->",
    }),
  },
  {
    namespace: "screenshots",
    ttl: 24 * 60 * 60 * 1000,
  }
);

// 默认过期时间：24小时
const DEFAULT_EXPIRE_HOURS = parseInt(process.env.VIDEO_EXPIRE_HOURS || "24");

/**
 * 存储视频文件信息
 * @param videoId 视频ID
 * @param filePath 文件路径
 * @param expireHours 过期时间（小时），默认24小时
 */
export async function storeVideoFile({
  videoId,
  filePath,
  fileName,
  expireHours = DEFAULT_EXPIRE_HOURS,
}: {
  videoId: string;
  filePath: string;
  fileName: string;
  expireHours?: number;
}): Promise<void> {
  const expiresAt = Date.now() + expireHours * 60 * 60 * 1000;
  const videoFileInfo: VideoFileInfo = {
    id: videoId,
    filePath,
    fileName,
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
