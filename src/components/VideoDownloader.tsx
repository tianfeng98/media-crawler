"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useVideoDownload } from "@/hooks/useVideoDownload";
import { AlertCircle, Download, RefreshCw } from "lucide-react";
import { useState } from "react";
import { StepCard } from "./StepCard";
import { VideoInfo } from "./VideoInfo";
import { ThemeToggle } from "./theme-toggle";

export function VideoDownloader() {
  const [url, setUrl] = useState("");
  const {
    isProcessing,
    currentStep,
    steps,
    videoInfo,
    error,
    startDownload,
    reset,
  } = useVideoDownload();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim() && !isProcessing) {
      startDownload(url.trim());
    }
  };

  const handleReset = () => {
    setUrl("");
    reset();
  };

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 标题和主题切换 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left space-y-2 flex-1">
          <h1 className="text-3xl font-bold">
            视频下载器 - Media Crawler {process.env.APP_VERSION}
          </h1>
          <p className="text-muted-foreground">
            输入视频链接，自动完成提取、下载和格式转换
          </p>
        </div>
        <div className="flex-shrink-0">
          <ThemeToggle />
        </div>
      </div>

      {/* URL输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            输入视频链接
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="请输入视频链接，如：https://www.youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isProcessing}
                className="flex-1"
              />
              <Button
                type="submit"
                disabled={!url.trim() || isProcessing || !isValidUrl(url)}
                className="min-w-[100px]"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    处理中
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    获取
                  </>
                )}
              </Button>
              {(videoInfo || error) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isProcessing}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重置
                </Button>
              )}
            </div>
            {url && !isValidUrl(url) && (
              <p className="text-sm text-red-500">请输入有效的URL链接</p>
            )}
          </form>
        </CardContent>
      </Card>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 步骤展示区域 */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">处理步骤</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {steps.map((step, index) => (
            <StepCard
              key={step.step}
              step={step}
              isActive={index === currentStep?.index}
              stepNumber={index + 1}
            />
          ))}
        </div>
      </div>

      {/* 视频信息展示 */}
      {videoInfo && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">视频详情</h2>
          <VideoInfo videoInfo={videoInfo} />
        </div>
      )}

      {/* 完成提示 */}
      {videoInfo && steps.every((step) => step.status === "completed") && (
        <Alert className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            视频处理完成！所有步骤已成功执行。
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function CheckCircle({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
