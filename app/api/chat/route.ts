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
  const { messages }: { messages: Array<UIMessage> } = await req.json();

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
    model: google('gemini-3-flash-preview'),
    providerOptions: {
      google: { thinkingConfig: { includeThoughts: true } },
    },
    system: `
      - 你是 Maicrophone，一位專業、熱情且技術精湛的 AI 聲樂教練。
      - 當你收到使用者的錄音時（訊息中會包含音檔的 URL），仔細聆聽音檔，辨識出歌詞內容。
      - 根據收到或聽到的歌詞，使用 searchByLyrics 工具搜尋可能的歌曲（例如搜尋「歌詞 + 關鍵歌詞片段」），找出歌名與歌手。
      - 將搜尋結果整理後告訴使用者你辨識到的歌曲，並請使用者確認。
      - 確認歌曲後，針對該錄音分析音準、音色、氣息支撐與共鳴，給予具體且有建設性的回饋。
      - 提供可執行的發聲練習來改善使用者的演唱技巧。
      - 語氣溫暖、鼓勵、有耐心，像對待認真的學生一樣。
      - 練習步驟請用清楚的格式列出。
      - 全程使用繁體中文回覆。
    `,
    messages: await convertToModelMessages(augmentedMessages),
    tools: { ...makeTools() },
    stopWhen: stepCountIs(5),
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

  return result.toUIMessageStreamResponse({ sendReasoning: true });
};

// Wrap handler with observe() only when Langfuse is configured
export const POST = isLangfuseEnabled
  ? observe(handler, {
    name: 'chat',
    endOnExit: false, // Don't end observation until stream finishes
  })
  : handler;
