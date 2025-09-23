"use client";

import {
  DownloadState,
  StepStatus,
  TaskStatus,
  TaskStatusEnum,
  TaskStepEnum,
} from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const initialSteps: StepStatus[] = [
  {
    step: TaskStepEnum.Extract,
    status: TaskStatusEnum.Pending,
    progress: 0,
    message: "等待开始提取视频链接...",
  },
  {
    step: TaskStepEnum.Download,
    status: TaskStatusEnum.Pending,
    progress: 0,
    message: "等待开始下载视频...",
  },
  {
    step: TaskStepEnum.Convert,
    status: TaskStatusEnum.Pending,
    progress: 0,
    message: "等待开始格式转换...",
  },
];

export function useVideoDownload() {
  const [state, setState] = useState<DownloadState>({
    isProcessing: false,
    currentStep: 0,
    steps: initialSteps,
    videoInfo: null,
    error: null,
  });

  const currentTaskId = useRef<string | null>(null);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  // 创建下载任务
  const createDownloadTask = async (
    url: string,
    fileName?: string
  ): Promise<string> => {
    const response = await fetch("/api/download", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, fileName }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to create download task");
    }

    const result = await response.json();
    return result.taskId;
  };

  // 获取任务进度
  const getTaskProgress = async (taskId: string): Promise<TaskStatus> => {
    const response = await fetch(`/api/progress?id=${taskId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Failed to get task progress");
    }

    return await response.json();
  };

  // 更新步骤状态
  const updateStep = useCallback(
    (stepIndex: number, updates: Partial<StepStatus>) => {
      setState((prev) => ({
        ...prev,
        steps: prev.steps.map((step, index) =>
          index === stepIndex ? { ...step, ...updates } : step
        ),
      }));
    },
    []
  );

  // 开始进度轮询
  const startProgressPolling = useCallback(
    async (taskId: string) => {
      try {
        const taskStatus = await getTaskProgress(taskId);

        // 更新步骤状态
        switch (taskStatus.status) {
          case TaskStatusEnum.Pending:
          case TaskStatusEnum.Created:
            updateStep(0, {
              status: TaskStatusEnum.Processing,
              progress: 0,
              message: "正在提取视频链接...",
            });
            setTimeout(() => {
              startProgressPolling(taskId);
            }, 1000);
            break;
          case TaskStatusEnum.Processing:
            switch (taskStatus.progress.step) {
              case TaskStepEnum.Extract:
                updateStep(0, {
                  status: TaskStatusEnum.Processing,
                  progress: taskStatus.progress.percent,
                  message: `正在提取视频链接... ${taskStatus.progress.percent}%`,
                });
                break;
              case TaskStepEnum.Download:
                updateStep(0, {
                  status: TaskStatusEnum.Completed,
                  progress: 100,
                  message: "视频链接提取成功",
                });
                updateStep(1, {
                  status: TaskStatusEnum.Processing,
                  progress: taskStatus.progress.percent,
                  message: `正在下载视频... ${taskStatus.progress.percent}%`,
                });
                break;
              case TaskStepEnum.Convert:
                updateStep(0, {
                  status: TaskStatusEnum.Completed,
                  progress: 100,
                  message: "视频链接提取成功",
                });
                updateStep(1, {
                  status: TaskStatusEnum.Completed,
                  progress: 100,
                  message: "视频下载完成",
                });
                updateStep(2, {
                  status: TaskStatusEnum.Processing,
                  progress: taskStatus.progress.percent,
                  message: `正在转换格式... ${taskStatus.progress.percent}%`,
                });
                break;
            }
            setTimeout(() => {
              startProgressPolling(taskId);
            }, 1000);
            break;
          case TaskStatusEnum.Completed:
            // 任务完成
            if (progressInterval.current) {
              clearInterval(progressInterval.current);
              progressInterval.current = null;
            }

            // 更新所有步骤为完成状态
            updateStep(0, {
              status: TaskStatusEnum.Completed,
              progress: 100,
              message: "视频链接提取成功",
            });
            updateStep(1, {
              status: TaskStatusEnum.Completed,
              progress: 100,
              message: "视频下载完成",
            });
            updateStep(2, {
              status: TaskStatusEnum.Completed,
              progress: 100,
              message: "格式转换完成",
            });

            setState((prev) => ({
              ...prev,
              videoInfo: taskStatus.videoInfo,
              isProcessing: false,
              currentStep: 2,
            }));
            break;
          case TaskStatusEnum.Error:
            // 任务失败
            if (progressInterval.current) {
              clearInterval(progressInterval.current);
              progressInterval.current = null;
            }

            setState((prev) => ({
              ...prev,
              error: taskStatus.error || "Unknown error",
              isProcessing: false,
            }));
            break;
        }
      } catch (error) {
        console.error("获取任务进度失败:", error);
      }
    },
    [updateStep]
  );

  // 停止进度轮询
  const stopProgressPolling = useCallback(() => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
  }, []);

  // 清理函数
  useEffect(() => {
    return () => {
      stopProgressPolling();
    };
  }, [stopProgressPolling]);

  // 开始下载流程
  const startDownload = useCallback(
    async (url: string) => {
      if (state.isProcessing) return;

      setState((prev) => ({
        ...prev,
        isProcessing: true,
        currentStep: 0,
        steps: initialSteps,
        videoInfo: null,
        error: null,
      }));

      try {
        // 步骤1：提取视频信息
        updateStep(0, {
          status: TaskStatusEnum.Processing,
          message: "正在提取视频链接...",
          progress: 0,
        });

        // 创建下载任务
        const taskId = await createDownloadTask(url);
        currentTaskId.current = taskId;

        setState((prev) => ({ ...prev, currentStep: 1 }));

        // 开始进度轮询
        startProgressPolling(taskId);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "未知错误";
        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isProcessing: false,
        }));

        // 标记当前步骤为错误
        updateStep(0, {
          status: TaskStatusEnum.Error,
          message: errorMessage,
          error: errorMessage,
        });
      }
    },
    [state.isProcessing, updateStep, startProgressPolling]
  );

  // 重置状态
  const reset = useCallback(() => {
    stopProgressPolling();
    currentTaskId.current = null;
    setState({
      isProcessing: false,
      currentStep: 0,
      steps: initialSteps,
      videoInfo: null,
      error: null,
    });
  }, [stopProgressPolling]);

  return {
    ...state,
    startDownload,
    reset,
  };
}
