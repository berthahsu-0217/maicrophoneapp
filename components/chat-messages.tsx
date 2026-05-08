import { NotePlayer } from '@/components/note-player';
import { FileAudio, Search } from 'lucide-react';


const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

/** Regex to detect a JSON array of musical notes (e.g. ["C4", "E4", "G4"]) */
const NOTE_ARRAY_RE = /\[\s*"[A-Ga-g][#b]?\d"(?:\s*,\s*"[A-Ga-g][#b]?\d")*\s*\]/;

interface YouTubeVideoResult {
    videoId: string;
    title: string;
    channelTitle: string;
    url: string;
    embedUrl: string;
}

function extractYouTubeVideos(result: unknown): YouTubeVideoResult[] {
    const rawList = Array.isArray(result)
        ? result
        : (result && typeof result === 'object'
            ? ((result as Record<string, unknown>).videos
                ?? (result as Record<string, unknown>).items
                ?? (result as Record<string, unknown>).result
                ?? (result as Record<string, unknown>).results)
            : null);

    if (!Array.isArray(rawList)) return [];

    return rawList
        .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const obj = item as Record<string, unknown>;
            const videoId = typeof obj.videoId === 'string' ? obj.videoId : '';
            const title = typeof obj.title === 'string' ? obj.title : '';
            const channelTitle = typeof obj.channelTitle === 'string' ? obj.channelTitle : '';
            const url = typeof obj.url === 'string' ? obj.url : '';
            const embedUrl = typeof obj.embedUrl === 'string' ? obj.embedUrl : '';

            if (!videoId || !YOUTUBE_VIDEO_ID_RE.test(videoId) || !title) return null;

            return { videoId, title, channelTitle, url, embedUrl };
        })
        .filter((video): video is YouTubeVideoResult => video !== null);
}

interface MessagePart {
    type: string;
    text?: string;
    mediaType?: string;
    url?: string;
    state?: string;
    result?: unknown;
    output?: unknown;
    toolInvocation?: {
        toolName: string;
        state: string;
        args?: Record<string, unknown>;
        result?: unknown;
    };
}

function getToolPayload(part: MessagePart): { toolName: string; state: string; result: unknown } | null {
    if (part.type === 'tool-invocation' && part.toolInvocation) {
        return {
            toolName: part.toolInvocation.toolName,
            state: part.toolInvocation.state,
            result: part.toolInvocation.result,
        };
    }

    if (part.type.startsWith('tool-')) {
        return {
            toolName: part.type.slice(5),
            state: typeof part.state === 'string' ? part.state : 'result',
            result: part.result ?? part.output,
        };
    }

    return null;
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
                                    if (p.type === 'text') {
                                        // Detect note arrays in text and render NotePlayer
                                        const text = p.text ?? '';
                                        const match = text.match(NOTE_ARRAY_RE);
                                        if (match) {
                                            try {
                                                const startIdx = text.indexOf(match[0]);
                                                const before = text.slice(0, startIdx).trim();
                                                const after = text.slice(startIdx + match[0].length).trim();
                                                const notes: string[] = JSON.parse(match[0]);
                                                return (
                                                    <div key={i}>
                                                        {before && <span>{before}</span>}
                                                        <NotePlayer notes={notes} />
                                                        {after && <span className="block mt-2">{after}</span>}
                                                    </div>
                                                );
                                            } catch { /* fall through to plain text */ }
                                        }
                                        return <span key={i}>{text}</span>;
                                    }
                                    const toolPayload = getToolPayload(p);
                                    if (toolPayload) {
                                        const { toolName, state, result } = toolPayload;
                                        const normalizedToolName = toolName.toLowerCase();

                                        if (normalizedToolName === 'analyzepitch' && state === 'result' && result != null) {
                                            const pitchResult = result as { results?: Array<{ target: string; detected: string | null; centsOff: number; hit: boolean; noteScore: number; label: string }>; score?: number };
                                            if (pitchResult.results) {
                                                return (
                                                    <div key={i} className="mt-2 space-y-2">
                                                        <div className="flex items-center gap-2 text-sm font-semibold text-pink-300">
                                                            <Target className="w-4 h-4" />
                                                            音準分析結果
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            {pitchResult.results.map((r, j) => {
                                                                const colors = {
                                                                    excellent: 'text-green-400 border-green-500/30 bg-green-500/10',
                                                                    good: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
                                                                    fair: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10',
                                                                    miss: 'text-red-400 border-red-500/30 bg-red-500/10',
                                                                    undetected: 'text-zinc-500 border-zinc-600/30 bg-zinc-700/10',
                                                                }[r.label] ?? 'text-zinc-400 border-zinc-600/30';
                                                                return (
                                                                    <div key={j} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-mono ${colors}`}>
                                                                        <span>🎵 {r.target} → {r.detected ?? '—'}</span>
                                                                        <span>{r.noteScore}/10 ({r.label}{r.detected ? `, ${r.centsOff > 0 ? '+' : ''}${r.centsOff}¢` : ''})</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                        <div className="text-right text-sm font-bold text-pink-300">
                                                            總分：{pitchResult.score} / 50
                                                        </div>
                                                    </div>
                                                );
                                            }
                                        }

                                        if ((normalizedToolName === 'searchyoutubevideos') && result != null) {
                                            const videos = extractYouTubeVideos(result);

                                            if (videos.length === 0) {
                                                return (
                                                    <div key={i} className="text-xs text-zinc-400 my-1">
                                                        找不到可播放的 YouTube 建議。
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div key={i} className="space-y-3 mt-2">
                                                    {videos.map((video) => (
                                                        <div key={video.videoId} className="rounded-2xl border border-zinc-700 bg-zinc-900/70 p-3">
                                                            <div className="text-sm font-semibold text-zinc-100 line-clamp-2">{video.title}</div>
                                                            {video.channelTitle && (
                                                                <div className="text-xs text-zinc-400 mt-1">{video.channelTitle}</div>
                                                            )}
                                                            <div className="mt-2 overflow-hidden rounded-xl border border-zinc-700">
                                                                <iframe
                                                                    src={video.embedUrl || `https://www.youtube.com/embed/${video.videoId}`}
                                                                    title={video.title}
                                                                    className="w-full aspect-video"
                                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                                                    referrerPolicy="strict-origin-when-cross-origin"
                                                                    allowFullScreen
                                                                />
                                                            </div>
                                                            {video.url && (
                                                                <a
                                                                    href={video.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-block mt-2 text-xs text-indigo-300 hover:text-indigo-200"
                                                                >
                                                                    Open on YouTube
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        }

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
