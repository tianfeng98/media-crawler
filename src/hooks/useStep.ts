"use client";

import { StepStatus, TaskStatusEnum, TaskStepEnum } from "@/lib/types";
import { useMemoizedFn } from "ahooks";
import { useMemo, useState } from "react";

const generateMessage = (
  step: TaskStepEnum,
  status: TaskStatusEnum,
  progress = 0
) => {
  const messageMap: Record<TaskStepEnum, Record<TaskStatusEnum, string>> = {
    [TaskStepEnum.Extract]: {
      [TaskStatusEnum.Pending]: "等待开始提取视频链接...",
      [TaskStatusEnum.Created]: "等待开始提取视频链接...",
      [TaskStatusEnum.Processing]: `正在提取视频链接... ${progress}%`,
      [TaskStatusEnum.Completed]: "视频链接提取成功",
      [TaskStatusEnum.Error]: "视频链接提取失败",
    },
    [TaskStepEnum.Download]: {
      [TaskStatusEnum.Pending]: "等待开始下载视频...",
      [TaskStatusEnum.Created]: "等待开始下载视频...",
      [TaskStatusEnum.Processing]: `正在下载视频... ${progress}%`,
      [TaskStatusEnum.Completed]: "视频下载完成",
      [TaskStatusEnum.Error]: "视频下载失败",
    },
    [TaskStepEnum.Convert]: {
      [TaskStatusEnum.Pending]: "等待开始格式转换...",
      [TaskStatusEnum.Created]: "等待开始格式转换...",
      [TaskStatusEnum.Processing]: `正在格式转换... ${progress}%`,
      [TaskStatusEnum.Completed]: "格式转换完成",
      [TaskStatusEnum.Error]: "格式转换失败",
    },
  };
  return messageMap[step][status];
};

const initialSteps: StepStatus[] = [
  {
    index: 0,
    step: TaskStepEnum.Extract,
    status: TaskStatusEnum.Pending,
    progress: 0,
    message: generateMessage(TaskStepEnum.Extract, TaskStatusEnum.Pending),
  },
  {
    index: 1,
    step: TaskStepEnum.Download,
    status: TaskStatusEnum.Pending,
    progress: 0,
    message: generateMessage(TaskStepEnum.Download, TaskStatusEnum.Pending),
  },
  {
    index: 2,
    step: TaskStepEnum.Convert,
    status: TaskStatusEnum.Pending,
    progress: 0,
    message: generateMessage(TaskStepEnum.Convert, TaskStatusEnum.Pending),
  },
];

export const useStep = () => {
  const [steps, setSteps] = useState<StepStatus[]>([...initialSteps]);

  const isProcessing = useMemo(() => {
    const lastStepStatus = steps.at(-1)!.status;
    return [TaskStatusEnum.Completed, TaskStatusEnum.Error].includes(
      lastStepStatus
    );
  }, [steps]);

  const currentStep = useMemo(() => {
    return steps.find((step) => step.status === TaskStatusEnum.Processing);
  }, [steps]);

  const initSteps = useMemoizedFn(() => {
    setSteps([...initialSteps]);
  });

  // 更新步骤状态
  const updateStep = useMemoizedFn(
    (
      stepType: TaskStepEnum,
      {
        status,
        progress,
      }: Pick<StepStatus, "status"> & Partial<Pick<StepStatus, "progress">>
    ) => {
      setSteps((prev) => {
        const newSteps = [...prev];
        const step = newSteps.find((step) => step.step === stepType);
        if (!step) {
          return newSteps;
        }
        const { index: stepIndex, progress: stepProgress } = step;
        const updateProgress = progress ?? stepProgress;
        if (stepIndex > 0) {
          for (let i = 0; i < stepIndex; i += 1) {
            newSteps[i] = {
              ...newSteps[i],
              status: TaskStatusEnum.Completed,
              progress: 100,
              message: generateMessage(
                newSteps[i].step,
                TaskStatusEnum.Completed
              ),
            };
          }
        }
        newSteps[stepIndex] = {
          ...newSteps[stepIndex],
          message: generateMessage(
            newSteps[stepIndex].step,
            status,
            updateProgress
          ),
          status,
          progress: updateProgress,
        };
        return newSteps;
      });
    }
  );

  return {
    steps,
    isProcessing,
    currentStep,
    initSteps,
    updateStep,
  };
};
