import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { convertToModelMessages, streamText, type UIMessage } from 'ai';

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_KEY,
});

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
    const { messages }: { messages: Array<UIMessage> } = await req.json();

    const result = streamText({
        model: google('gemini-3-flash-preview'),
        system: `
      - You are Maicrophone, an expert, encouraging, and highly technical AI Vocal Coach.
      - When you receive audio recordings from the user, actively analyze them for pitch, tone, breath support, and resonance. 
      - Give constructive, specific feedback and actionable vocal exercises to improve their technique.
      - Be warm, supportive, and motivating, treating the user like a dedicated student.
      - Always format your exercises clearly.
    `,
        messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
}
