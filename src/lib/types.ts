export interface VideoInfo {
  id: string;
  title: string;
  duration: number; // 毫秒
  size: number; // 字节
  format: string;
}

export interface VideoFileInfo {
  id: string;
  videoInfo: VideoInfo;
  filePath: string;
  expiresAt: number; // 过期时间戳
}

export enum TaskStatusEnum {
  Pending = "pending",
  Created = "created",
  Processing = "processing",
  Completed = "completed",
  Error = "error",
}

export enum TaskStepEnum {
  Extract = "extract",
  Download = "download",
  Convert = "convert",
}

export interface TaskStatus {
  taskId: string;
  status: TaskStatusEnum;
  progress: {
    step: TaskStepEnum;
    percent: number;
    message?: string;
  };
  videoInfo: VideoInfo | null;
  error: string | null;
}

export interface StepStatus {
  index: number;
  step: TaskStepEnum;
  status: TaskStatusEnum;
  progress: number;
  message: string;
  progressMessage?: string;
  error?: string;
}

export enum DownloadType {
  HLS = "hls",
  General = "general",
}

export interface DownloadItem {
  input: string;
  filename: string;
  type: "key" | "media";
}
