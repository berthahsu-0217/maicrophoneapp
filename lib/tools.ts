import { tool } from 'ai';
import { z } from 'zod';

export function makeTools() {
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
    };
}
