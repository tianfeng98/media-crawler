import { DownloadItem } from "@/lib/types";
import markdownit from "markdown-it";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { Page } from "playwright";
import { replaceIllegalCharsInPath } from "../common";
import { writeFileByBase64 } from "../file";
import { instruct } from "../llm";
import { logger } from "../logger";

const getBase64StrFromPage = async (page: Page, input: string) => {
  return page.evaluate(
    async ({ input }) => {
      const res = await window.fetch(input);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function(e) {
          const res_1 = e.target?.result;
          if (res_1) {
            if (typeof res_1 === "string") {
              if (res_1.startsWith("data:")) {
                resolve(res_1.split(",")[1]);
              } else {
                resolve(res_1);
              }
            } else {
              reject(new Error("result is not a string"));
            }
          } else {
            reject(new Error("result is null"));
          }
        };
        reader.readAsDataURL(blob);
      });
    },
    {
      input,
    }
  );
};

export const getVideoTitle = async (page: Page): Promise<string> => {
  const html = await page.evaluate(() => {
    // 移除注释，移除所有script、style、img标签，移除所有标签中的onclick事件、style属性、class属性、data-*属性、文本中间的间隔
    return (
      document
        .querySelector("body")
        ?.innerHTML?.replace(
          /(<!--.*?-->|<script[^>]*>.*?<\/script>|<style[^>]*>.*?<\/style>|<img[^>]*>|(<[^>]*?)\s+(onclick|style|class|data-[^\s=]+)[^>]*?(\s*?>)|\s+)/gs,
          (match, p1, p2, p3, p4) => {
            if (p1) {
              // 注释、script、style、img 标签，直接移除
              return "";
            } else if (p2 && p3) {
              // 移除标签内的属性，保留标签和其他属性
              return `${p2}${p4}`;
            } else {
              // 多个空格替换为单个空格
              return " ";
            }
          }
        )
        .trim() || ""
    );
  });
  const {
    success,
    errorMsg,
    message: llmResult,
  } = await instruct(`你是一个专业的网页内容解析器。请从以下 HTML 文本中精确提取**当前页面主视频的标题**。

提取规则：
- 忽略所有推荐视频、相关视频、评论、导航栏、页脚、广告中的文本。
- 如果无法确定主标题，请返回 ""。
- 不要添加任何解释、前缀或后缀。
- 如果标题未在 HTML 中明确出现，请返回 ""，不要根据上下文推测。

请以严格的 JSON 格式输出，仅包含一个字段 "title"。

HTML 内容如下：
${html}

输出格式示例：
{"title": "【2026春晚】周杰伦《青花瓷》现场版"}
或
{"title": ""}
`);
  if (!success) {
    logger.error(`LLM解析视频标题失败 ${errorMsg}`);
    return "";
  }
  const jsonStr = /```json(.*?)```/s.test(llmResult)
    ? markdownit({})
        .parse(llmResult, {})
        .find((item) => item.tag === "code" && item.info === "json")?.content ||
      llmResult
    : llmResult;
  logger.debug(`LLM解析视频标题结果 ${jsonStr}`, {
    verbose: true,
  });
  try {
    const data = JSON.parse(jsonStr);
    return data.title.toString().trim() || "";
  } catch (error) {
    logger.error(`LLM解析视频标题失败 ${error}`);
    return "";
  }
};

export const downloadItem = async (
  { input, filename }: DownloadItem,
  {
    videoDir,
    page,
  }: {
    page: Page;
    videoDir: string;
  }
) => {
  const output = join(videoDir, replaceIllegalCharsInPath(filename));
  if (existsSync(output)) {
    logger.debug(`${filename} 已存在`);
    return true;
  }
  const base64Str = await getBase64StrFromPage(page, input);
  logger.debug([`${filename} 写入base64内容长度`, base64Str.length]);
  return writeFileByBase64(base64Str, output);
};
