import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { observe } from '@langfuse/tracing';
import { trace } from '@opentelemetry/api';
import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { after } from 'next/server';

import { isLangfuseEnabled, langfuseSpanProcessor } from '@/instrumentation';
import { getChallengeConfig } from '@/lib/challenges';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_KEY,
});

// Allow streaming responses up to 60 seconds (agent loops need more time)
export const maxDuration = 60;

const handler = async (req: Request) => {
  const { messages, userId, challengeId }: { messages: Array<UIMessage>; userId?: string; challengeId: string } = await req.json();

  const challenge = getChallengeConfig(challengeId);

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
    system: challenge.system,
    messages: await convertToModelMessages(augmentedMessages),
    tools: challenge.tools(userId),
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
