import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { observe } from '@langfuse/tracing';
import { trace } from '@opentelemetry/api';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { after } from 'next/server';

import { isLangfuseEnabled, langfuseSpanProcessor } from '@/instrumentation';
import { makeTools } from '@/lib/tools';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_KEY,
});

// Allow streaming responses up to 60 seconds (agent loops need more time)
export const maxDuration = 60;

const handler = async (req: Request) => {
  const { messages, userId }: { messages: Array<UIMessage>; userId?: string } = await req.json();

  // Inject audio file URLs as text so the model knows the real URL for the recognizeSong tool
  const augmentedMessages = messages.map((msg) => {
    if (msg.role !== 'user' || !Array.isArray(msg.parts)) return msg;
    const fileUrls = msg.parts
      .filter((p: any) => p.type === 'file' && p.url)
      .map((p: any) => p.url as string);
    if (fileUrls.length === 0) return msg;
    return {
      ...msg,
      parts: [
        ...msg.parts,
        ...fileUrls.map((url: string) => ({ type: 'text' as const, text: `Audio file URL: ${url}` })),
      ],
    };
  });

  const result = streamText({
    maxRetries: 0,
    model: google('gemini-2.5-flash'),
    providerOptions: {
      google: { thinkingConfig: { includeThoughts: false } },
    },
    system: `
      - 你是 Maicrophone，一位專業、熱情且技術精湛的 AI 聲樂教練。
      - 當你收到使用者的錄音時（訊息中會包含音檔的 URL），仔細聆聽音檔，辨識出歌詞內容。
      - 根據收到或聽到的歌詞，使用 searchByLyrics 工具搜尋可能的歌曲（例如搜尋「歌詞 + 關鍵歌詞片段」），找出歌名與歌手。
      - 如果使用者想找練唱用歌曲、伴奏、無歌詞版、卡拉 OK，優先呼叫 searchYouTubeVideos 工具並提供 3 個可播放影片建議。
      - 呼叫 searchYouTubeVideos 後，避免重複開場句；請用 1-2 句簡短說明即可，影片清單由介面卡片呈現，不要再用長段落重複列出。
      - 將搜尋結果整理後告訴使用者你辨識到的歌曲，並請使用者確認。
      - 確認歌曲後，針對該錄音分析音準、音色、氣息支撐與共鳴，給予具體且有建設性的回饋。
      - 分析完成後，請使用 uploadScore 工具為使用者的演唱評分。你應該評估以下三個項目（每項 0-50 分）：rhythm（節奏）、expression（情感表達）、technique（技巧）。每個維度呼叫一次 uploadScore。
      - 評分時請根據實際聽到的表現給出合理分數，並附上簡短理由。
      - 提供可執行的發聲練習來改善使用者的演唱技巧。
      - 語氣溫暖、鼓勵、有耐心，像對待認真的學生一樣。
      - 練習步驟請用清楚的格式列出。
      - 全程使用繁體中文回覆。
    `,
    messages: await convertToModelMessages(augmentedMessages),
    tools: { ...makeTools(userId) },
    stopWhen: stepCountIs(7),
    experimental_telemetry: { isEnabled: isLangfuseEnabled },
    ...(isLangfuseEnabled && {
      onFinish: async () => {
        trace.getActiveSpan()?.end();
      },
      onError: async () => {
        trace.getActiveSpan()?.end();
      },
    }),
  });

  if (isLangfuseEnabled) {
    // Critical for serverless: flush traces before function terminates
    after(async () => await langfuseSpanProcessor!.forceFlush());
  }

  return result.toUIMessageStreamResponse({ sendReasoning: false });
};

// Wrap handler with observe() only when Langfuse is configured
export const POST = isLangfuseEnabled
  ? observe(handler, {
    name: 'chat',
    endOnExit: false, // Don't end observation until stream finishes
  })
  : handler;
