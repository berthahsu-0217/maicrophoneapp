import { FileAudio, Search } from 'lucide-react';

interface MessagePart {
    type: string;
    text?: string;
    mediaType?: string;
    url?: string;
    toolInvocation?: {
        toolName: string;
        state: string;
        args?: Record<string, unknown>;
        result?: unknown;
    };
}

interface Message {
    id: string;
    role: string;
    parts?: MessagePart[];
}

interface ChatMessagesProps {
    messages: Message[];
    isLoading: boolean;
    uploadProgress?: string | null;
}

export function ChatMessages({ messages, isLoading, uploadProgress }: ChatMessagesProps) {
    if (messages.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-md rounded-[3rem] w-full max-w-md mx-auto shadow-2xl gap-8 mt-4">
                <div className="space-y-2 text-center">
                    <h2 className="text-xl font-semibold text-white">Ready when you are</h2>
                    <p className="text-sm text-zinc-500">Type, speak, or record audio below.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {messages.map((m) =>
                m.role !== 'system' ? (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`p-4 rounded-3xl max-w-[85%] ${m.role === 'user'
                                ? 'bg-indigo-600 text-white rounded-br-none'
                                : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700 rounded-bl-none'
                                }`}
                        >
                            {Array.isArray(m.parts)
                                ? m.parts.map((p, i) => {
                                    if (p.type === 'reasoning') return (
                                        <details key={i} className="mb-2 text-sm">
                                            <summary className="cursor-pointer text-zinc-400 hover:text-zinc-300 select-none">💭 Thinking…</summary>
                                            <pre className="mt-1 whitespace-pre-wrap text-zinc-500 text-xs leading-relaxed">{p.text}</pre>
                                        </details>
                                    );
                                    if (p.type === 'text') return <span key={i}>{p.text}</span>;
                                    if (p.type === 'tool-invocation' && p.toolInvocation) {
                                        const { toolName, state } = p.toolInvocation;
                                        return (
                                            <div key={i} className="flex items-center gap-2 text-xs text-zinc-400 my-1">
                                                <Search className="w-3 h-3" />
                                                <span>
                                                    {state === 'result' ? `Used ${toolName}` : `Using ${toolName}…`}
                                                </span>
                                            </div>
                                        );
                                    }
                                    if (p.type === 'source') return null;
                                    if (
                                        p.type === 'file' &&
                                        typeof p.mediaType === 'string' &&
                                        p.mediaType.startsWith('audio/')
                                    ) {
                                        return (
                                            <div key={i} className="flex items-center gap-2 mt-1">
                                                <FileAudio className="w-4 h-4 flex-shrink-0 opacity-70" />
                                                <audio src={p.url} controls className="h-8 max-w-full" />
                                            </div>
                                        );
                                    }
                                    return null;
                                })
                                : null}
                        </div>
                    </div>
                ) : null,
            )}

            {uploadProgress && (
                <div className="flex justify-start">
                    <div className="p-4 rounded-3xl max-w-[85%] bg-zinc-800/80 text-indigo-300 border border-zinc-700 rounded-bl-none flex items-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" /></svg>
                        {uploadProgress}
                    </div>
                </div>
            )}

            {isLoading && !uploadProgress && (
                <div className="flex justify-start">
                    <div className="p-4 rounded-3xl max-w-[85%] bg-zinc-800/80 text-zinc-400 border border-zinc-700 rounded-bl-none animate-pulse">
                        Thinking...
                    </div>
                </div>
            )}
        </>
    );
}
