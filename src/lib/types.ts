export interface VideoInfo {
  id: string;
  title: string;
  duration: number; // 毫秒
  size: number; // 字节
  format: string;
  thumbnail: string;
}

export interface VideoFileInfo {
  id: string;
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
  error?: string;
}
