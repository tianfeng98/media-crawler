"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StepStatus, TaskStatusEnum } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, Circle, Loader2 } from "lucide-react";
import { useEffect } from "react";

interface StepCardProps {
  step: StepStatus;
  isActive: boolean;
  stepNumber: number;
}

const stepIcons = {
  extract: "🔍",
  download: "⬇️",
  convert: "🔄",
};

const stepTitles = {
  extract: "提取视频链接",
  download: "下载视频",
  convert: "格式转换",
};

export function StepCard({ step, isActive, stepNumber }: StepCardProps) {
  const getStatusIcon = () => {
    switch (step.status) {
      case TaskStatusEnum.Completed:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case TaskStatusEnum.Processing:
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      case TaskStatusEnum.Error:
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  useEffect(() => {
    console.log("step", step, step.progress);
  }, [step]);

  const getStatusBadge = () => {
    switch (step.status) {
      case TaskStatusEnum.Completed:
        return (
          <Badge
            variant="default"
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            完成
          </Badge>
        );
      case TaskStatusEnum.Processing:
        return (
          <Badge
            variant="default"
            className="bg-blue-500 hover:bg-blue-600 text-white"
          >
            进行中
          </Badge>
        );
      case TaskStatusEnum.Error:
        return <Badge variant="destructive">错误</Badge>;
      default:
        return <Badge variant="secondary">等待</Badge>;
    }
  };

  return (
    <Card
      className={cn(
        "relative transition-all duration-300",
        isActive && "ring-2 ring-blue-500 shadow-lg",
        step.status === "completed" && "border-green-200 bg-green-50/50",
        step.status === "error" && "border-red-200 bg-red-50/50"
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 text-sm font-semibold">
              {stepNumber}
            </div>
            <div>
              <h3 className="font-semibold text-lg">
                {stepIcons[step.step]} {stepTitles[step.step]}
              </h3>
              <p className="text-sm text-muted-foreground">{step.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            {getStatusBadge()}
          </div>
        </div>

        {step.status === "processing" && (
          <div className="space-y-2">
            <Progress value={step.progress} className="h-2" />
            <p className="text-xs text-muted-foreground text-center">
              {step.progress}%
            </p>
          </div>
        )}

        {step.status === "error" && step.error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-sm text-red-700 dark:text-red-300">
            {step.error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
