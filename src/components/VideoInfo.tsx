"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VideoInfo as VideoInfoType } from "@/lib/types";
import { formatDuration, formatFileSize } from "@/lib/utils";
import { saveAs } from "file-saver";
import { Clock, Download, Eye, FileVideo, HardDrive } from "lucide-react";
import { useMemo } from "react";

interface VideoInfoProps {
  videoInfo: VideoInfoType;
}

export function VideoInfo({ videoInfo }: VideoInfoProps) {
  const videoUrl = useMemo(() => {
    const urlObj = new URL(window.location.origin);
    urlObj.pathname = "/api/video";
    urlObj.searchParams.set("id", videoInfo.id);
    return urlObj.toString();
  }, [videoInfo.id]);
  const handlePreview = () => {
    window.open(videoUrl, "_blank");
  };
  const handleDownload = () => {
    saveAs(videoUrl, videoInfo.title);
  };
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="h-5 w-5" />
          视频信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-36 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
            {videoInfo.thumbnail && (
              <img
                src={videoInfo.thumbnail}
                alt={videoInfo.title}
                className="object-cover w-full h-full"
              />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-lg line-clamp-2">
              {videoInfo.title}
            </h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(videoInfo.duration)}
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="h-4 w-4" />
                {formatFileSize(videoInfo.size)}
              </div>
              <Badge variant="outline">{videoInfo.format}</Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {/* 预览 */}
              <Button variant="outline" onClick={handlePreview}>
                <Eye className="h-3 w-3" />
                <span className="truncate max-w-xs">预览</span>
              </Button>
              {/* 下载 */}
              <Button variant="outline" onClick={handleDownload}>
                <Download className="h-3 w-3" />
                <span className="truncate max-w-xs">下载</span>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
