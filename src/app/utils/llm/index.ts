import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources";

export interface InstructResult {
  success: boolean;
  errorMsg?: string;
  message: string;
}

export const instruct = async (prompt: string): Promise<InstructResult> => {
  const { OPENAI_BASE_URL, OPENAI_API_KEY, MODEL_NAME } = process.env;
  if (!OPENAI_BASE_URL || !OPENAI_API_KEY || !MODEL_NAME) {
    return {
      success: false,
      errorMsg: "OPENAI_BASE_URL or OPENAI_API_KEY or MODEL_NAME is not set",
      message: "",
    };
  }
  const openai = new OpenAI({
    baseURL: OPENAI_BASE_URL,
    apiKey: OPENAI_API_KEY,
  });
  const messages: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content:
        "你是一个专业的网页内容解析器，你需要根据用户提供的HTML代码，提取其中的视频标题",
    },
    {
      role: "user",
      content: prompt,
    },
  ];

  const response = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages,
  });

  return {
    success: true,
    message: response.choices.at(0)?.message.content || "",
  };
};
