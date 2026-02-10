import { OpenAI } from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { logger } from "..";

export type { ChatCompletionMessageParam } from "openai/resources";

export interface InstructResult {
  success: boolean;
  errorMsg?: string;
  message: string;
}

export const instruct = async (
  messages: ChatCompletionMessageParam[],
): Promise<InstructResult> => {
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
    timeout: 60 * 1000,
  });

  logger.debug(["LLM request", messages], { verbose: true });

  const response = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages,
  });

  logger.debug(["LLM response", response], { verbose: true });

  const result = response?.choices.at(0)?.message.content || "";

  return {
    success: true,
    message: result,
  };
};
