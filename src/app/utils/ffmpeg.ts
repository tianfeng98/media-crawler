import Ffmpeg from "fluent-ffmpeg";
import { dayjs } from "./common";
import { logger } from "./logger";

const formatDurationStr = (duration: string) => {
  // 'hh:mm:ss.SSS'
  const [hh, mm, s] = duration.split(":");
  const hours = parseInt(hh, 10);
  const minutes = parseInt(mm, 10);
  const [ss, SSS] = s.split(".");
  const seconds = parseInt(ss, 10);
  const milliseconds = parseInt(SSS, 10);
  const result = dayjs.duration({
    milliseconds,
    seconds,
    minutes,
    hours,
  });
  return result.asMilliseconds();
};

const initFFmpeg = async () => {
  // 动态导入FFmpeg安装器
  const ffmpegInstall = await import("@ffmpeg-installer/ffmpeg");
  const ffprobeInstall = await import("@ffprobe-installer/ffprobe");

  Ffmpeg.setFfmpegPath(ffmpegInstall.path);
  Ffmpeg.setFfprobePath(ffprobeInstall.path);
};

export const getVideoCodec = async (input: string) => {
  await initFFmpeg();
  return new Promise<string | undefined>((resolve, reject) => {
    const command = Ffmpeg();
    command
      .input(input)
      .ffprobe(
        [
          "-allowed_extensions",
          "ALL",
          "-protocol_whitelist",
          "file,http,https,tls,tcp,crypto",
        ],
        (err, metadata) => {
          if (err) return reject(err);

          const videoStream = metadata.streams.find(
            (s) => s.codec_type === "video",
          );
          if (!videoStream) return reject(new Error("No video stream found"));

          resolve(videoStream.codec_name);
        },
      );
  });
};

const getVideoCodecOptions = (codec?: string) => {
  switch (codec) {
    case "h265":
    case "hevc":
      return [
        "-c:v libx264", // 使用 H.264 (AVC) 编码器
        "-crf 23", // 视觉无损范围 (0-51，越小质量越高，0为绝对无损)
        "-preset fast", // 慢速预设可以获得更好的压缩率
        "-pix_fmt yuv420p", // 提高兼容性，确保大多数播放器能打开
      ];
    case "h264":
    case "avc":
    default:
      return [
        "-c:v copy", // 视频流直接拷贝，不重编码以保持原始视频质量
        "-bsf:a aac_adtstoasc", // 修复 AAC 音频封装，防止 MP4 播放无声音。
      ];
  }
};

export interface FFmpegProgressInfo {
  input: string;
  output: string;
  /**
   * 当前处理的媒体时长（毫秒）
   */
  currentMilliseconds: number;
  /**
   * 媒体的总时长（毫秒）
   * 如果总时长未知，则为0
   */
  totalMilliseconds: number;
}

export interface FFmpegOptions {
  userAgent?: string;
  threads?: number;
  headers?: Record<string, string>;
  verbose?: boolean;
  onProgress?: (progress: FFmpegProgressInfo) => void;
}

export const runFFmpeg = async (
  input: string,
  output: string,
  { userAgent, threads, headers, verbose, onProgress }: FFmpegOptions = {},
) => {
  await initFFmpeg();
  const codec = await getVideoCodec(input);
  logger.debug(`视频编码器: ${codec}`, { verbose });
  const videoCodecOptions = getVideoCodecOptions(codec);

  return new Promise<FFmpegProgressInfo>((resolve, reject) => {
    const command = Ffmpeg();
    let totalMilliseconds = 0;

    command.input(input);

    if (userAgent) {
      command.inputOptions("-user_agent", userAgent);
    }

    if (threads) {
      command.inputOptions("-threads", threads.toString());
    }

    if (headers) {
      command.inputOptions(
        "-headers",
        Object.entries(headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join("$'\r\n'"),
      );
    }
    command
      .inputOptions(
        "-allowed_extensions",
        "ALL",
        "-protocol_whitelist",
        "file,http,https,tls,tcp,crypto",
      )
      .outputOptions([
        ...videoCodecOptions,
        "-c:a copy", // 音频流直接拷贝，不重编码以保持原始音质
      ])
      .output(output)
      .on("start", function (commandLine) {
        logger.debug("Spawned FFmpeg with command: " + commandLine, {
          verbose,
        });
      })
      .on("progress", function (progress) {
        const currentMilliseconds = formatDurationStr(progress.timemark);
        if (totalMilliseconds && totalMilliseconds > 0) {
          onProgress?.({
            input,
            output,
            currentMilliseconds,
            totalMilliseconds,
          });
        }
      })
      .on("codecData", function (data) {
        totalMilliseconds = formatDurationStr(data.duration);
      })
      .on("end", function () {
        const finishInfo: FFmpegProgressInfo = {
          input,
          output,
          currentMilliseconds: totalMilliseconds,
          totalMilliseconds,
        };
        onProgress?.(finishInfo);
        resolve(finishInfo);
      })
      .on("error", function (err) {
        reject(err);
      })
      .run();
  });
};

export const runFFmpegScreenshot = async (
  input: string,
  output: string,
  { verbose }: FFmpegOptions = {},
) => {
  const ffmpegInstall = await import("@ffmpeg-installer/ffmpeg");
  Ffmpeg.setFfmpegPath(ffmpegInstall.path);
  return new Promise<FFmpegProgressInfo>((resolve, reject) => {
    const command = Ffmpeg();
    command
      .input(input)
      .outputOptions("-ss", "4.500")
      .outputOptions("-vframes", "1")
      .output(output)
      .on("start", function (commandLine) {
        logger.debug("Spawned FFmpeg with command: " + commandLine, {
          verbose,
        });
      })
      .on("end", function () {
        resolve({
          input,
          output,
          currentMilliseconds: 0,
          totalMilliseconds: 0,
        });
      })
      .on("error", function (err) {
        reject(err);
      })
      .run();
  });
};
