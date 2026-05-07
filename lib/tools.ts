import { tool } from 'ai';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;

const SCORE_COLUMNS: Record<string, string> = {
    pitch: 'score_pitch',
    rhythm: 'score_rhythm',
    expression: 'score_expression',
    technique: 'score_technique',
    stability: 'score_stability',
};

const TITLES: [number, string][] = [
    [200, '麥克風稱霸者'],
    [150, '歌唱精靈'],
    [100, '音樂行者'],
    [50, '初出茅廬'],
    [0, '大音痴是你'],
];

function computeTitle(total: number): string {
    return (TITLES.find(([min]) => total >= min) ?? TITLES[TITLES.length - 1])[1];
}

export function makeTools(userId?: string) {
    const executeYouTubeSearch = async ({ query, maxResults = 3 }: { query: string; maxResults?: number }) => {
        const apiKey = process.env.YOUTUBE_API_KEY;
        if (!apiKey) {
            return [];
        }

        const practiceHints = /(無歌詞|純音樂|伴奏|卡拉|karaoke|instrumental|off vocal|no lyrics)/i;
        const searchQuery = practiceHints.test(query)
            ? query
            : `${query} karaoke instrumental 無歌詞 伴奏`;

        const params = new URLSearchParams({
            part: 'snippet',
            type: 'video',
            maxResults: String(Math.min(Math.max(maxResults, 1), 5)),
            q: searchQuery,
            key: apiKey,
            videoEmbeddable: 'true',
            videoSyndicated: 'true',
            safeSearch: 'moderate',
        });

        const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`, {
            signal: AbortSignal.timeout(10_000),
        });

        if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
        const data = await res.json();

        const candidates = (data?.items ?? [])
            .map((item: any) => {
                const videoId = item?.id?.videoId;
                if (!videoId || !YOUTUBE_VIDEO_ID_RE.test(videoId)) return null;

                return {
                    videoId,
                    title: item?.snippet?.title ?? '',
                    channelTitle: item?.snippet?.channelTitle ?? '',
                    description: item?.snippet?.description ?? '',
                    thumbnailUrl: item?.snippet?.thumbnails?.medium?.url ?? item?.snippet?.thumbnails?.default?.url ?? '',
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    embedUrl: `https://www.youtube.com/embed/${videoId}`,
                };
            })
            .filter(Boolean);

        if (candidates.length === 0) return [];

        // Double-check embeddability with videos.list to avoid iframe "Video unavailable".
        const ids = candidates.map((v: any) => v.videoId).join(',');
        const verifyParams = new URLSearchParams({
            part: 'status',
            id: ids,
            key: apiKey,
        });

        const verifyRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${verifyParams}`, {
            signal: AbortSignal.timeout(10_000),
        });

        if (!verifyRes.ok) return candidates;

        const verifyData = await verifyRes.json();
        const embeddableIds = new Set(
            (verifyData?.items ?? [])
                .filter((item: any) => item?.status?.embeddable === true)
                .map((item: any) => item?.id)
                .filter((id: unknown) => typeof id === 'string' && YOUTUBE_VIDEO_ID_RE.test(id as string)),
        );

        return candidates.filter((video: any) => embeddableIds.has(video.videoId));
    };

    return {
        searchByLyrics: tool({
            description:
                'Search KKBOX for songs matching a lyrics query. Returns song name, artist, album, URL, and a lyrics snippet.',
            inputSchema: z.object({
                query: z.string().describe('The lyrics text to search for'),
                terr: z.string().optional().describe('Territory code (default: "tw")'),
                lang: z.string().optional().describe('Language code (default: "tc")'),
            }),
            execute: async ({
                query,
                terr = 'tw',
                lang = 'tc',
            }) => {
                const params = new URLSearchParams({ q: query, terr, lang });
                const res = await fetch(
                    `https://www.kkbox.com/api/search/lyrics?${params}`,
                    { signal: AbortSignal.timeout(10_000) },
                );
                if (!res.ok) throw new Error(`KKBOX API error: ${res.status}`);
                const data = await res.json();

                if (data?.status !== 'OK') return [];

                return (data.data?.result ?? []).slice(0, 3).map((item: any) => ({
                    songName: item.name ?? '',
                    artistName: item.album?.artist?.name ?? '',
                    albumName: item.album?.name ?? '',
                    songUrl: item.url ?? '',
                    lyricsSnippet: item.lyrics?.text ?? '',
                }));
            },
        }),
        searchYouTubeVideos: tool({
            description:
                'Search YouTube for vocal practice tracks (karaoke/instrumental/no-lyrics). Returns playable video options.',
            inputSchema: z.object({
                query: z.string().describe('Song name or user practice request, e.g. 身騎白馬 無歌詞版'),
                maxResults: z.number().int().min(1).max(5).optional().describe('How many videos to return (default: 3)'),
            }),
            execute: executeYouTubeSearch,
        }),
        uploadScore: tool({
            description:
                'Upload a score for the user after analyzing their singing. Call this once per score dimension. Only call after you have analyzed an audio recording.',
            inputSchema: z.object({
                scoreType: z.enum(['pitch', 'rhythm', 'expression', 'technique', 'stability']).describe('Which dimension to score'),
                score: z.number().int().min(0).max(50).describe('Score from 0-50 for this dimension'),
                reason: z.string().describe('Brief reason for this score'),
            }),
            execute: async ({ scoreType, score, reason }) => {
                if (!userId) return { success: false, error: 'No userId provided' };

                const column = SCORE_COLUMNS[scoreType];
                if (!column) return { success: false, error: 'Invalid scoreType' };

                // Get current score
                const { data: user, error: fetchError } = await supabase
                    .from('users')
                    .select('score_pitch, score_rhythm, score_expression, score_technique, score_stability')
                    .eq('id', userId)
                    .single() as { data: any; error: any };

                if (fetchError || !user) return { success: false, error: 'User not found' };

                const currentScore = (user as any)[column] as number;
                if (score <= currentScore) {
                    return { success: true, updated: false, message: `Score ${score} not higher than current best ${currentScore}`, scoreType, score, reason };
                }

                // Calculate new total for title
                const newScores = {
                    score_pitch: user.score_pitch,
                    score_rhythm: user.score_rhythm,
                    score_expression: user.score_expression,
                    score_technique: user.score_technique,
                    score_stability: user.score_stability,
                    [column]: score,
                };
                const total = Object.values(newScores).reduce((a, b) => a + b, 0);
                const title = computeTitle(total);

                const { error: updateError } = await supabase
                    .from('users')
                    .update({ [column]: score, title, updated_at: new Date().toISOString() })
                    .eq('id', userId);

                if (updateError) return { success: false, error: 'Update failed' };

                return { success: true, updated: true, scoreType, score, previousScore: currentScore, newTotal: total, newTitle: title, reason };
            },
        }),
    };
}
