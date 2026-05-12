'use client';

import { ArrowLeft, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';

interface Recording {
    id: string;
    public_url: string;
    mime_type: string | null;
    duration_seconds: number | null;
    created_at: string;
}

function formatDuration(seconds: number | null): string {
    if (!seconds) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function RecordingsPage() {
    const user = useAuth();
    const [recordings, setRecordings] = useState<Recording[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (!user) return;
        fetch(`/api/recordings?userId=${user.userId}`)
            .then((r) => r.json())
            .then((data) => setRecordings(data.recordings ?? []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [user]);

    const togglePlay = (rec: Recording) => {
        if (playingId === rec.id) {
            audioRef.current?.pause();
            setPlayingId(null);
            return;
        }
        if (audioRef.current) {
            audioRef.current.pause();
        }
        const audio = new Audio(rec.public_url);
        audio.onended = () => setPlayingId(null);
        audio.play();
        audioRef.current = audio;
        setPlayingId(rec.id);
    };

    if (!user) return null;

    return (
        <main className="min-h-screen text-white relative overflow-hidden" style={{ backgroundColor: '#0D0A14' }}>
            {/* Background glows */}
            <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                <div className="absolute top-[-15%] right-[-15%] w-[500px] h-[500px] rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)' }} />
                <div className="absolute bottom-[-15%] left-[-15%] w-[500px] h-[500px] rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)' }} />
            </div>

            <div className="relative z-10 max-w-lg mx-auto px-5 pb-10">
                {/* Header */}
                <header className="flex items-center gap-3 pt-8 mb-6">
                    <Link href="/" className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                        <ArrowLeft className="w-4 h-4 text-white/60" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-extrabold"
                            style={{
                                background: 'linear-gradient(135deg, #22C55E, #8B5CF6)',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                            }}>
                            森林迴響
                        </h1>
                        <p className="text-xs" style={{ color: 'rgba(240,235,248,0.35)' }}>聆聽你的歷史錄音 🌲</p>
                    </div>
                </header>

                {/* Content */}
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="w-6 h-6 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                    </div>
                ) : recordings.length === 0 ? (
                    <div className="text-center py-20">
                        <p className="text-4xl mb-3">🌿</p>
                        <p className="text-sm" style={{ color: 'rgba(240,235,248,0.4)' }}>
                            還沒有錄音紀錄，去挑戰關卡吧！
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {recordings.map((rec, idx) => (
                            <div key={rec.id}
                                className="flex items-center gap-3 p-3 rounded-xl transition-all"
                                style={{
                                    background: playingId === rec.id ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${playingId === rec.id ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                                }}>
                                {/* Play button */}
                                <button onClick={() => togglePlay(rec)}
                                    className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition"
                                    style={{
                                        background: playingId === rec.id
                                            ? 'linear-gradient(135deg, #22C55E, #16A34A)'
                                            : 'rgba(34,197,94,0.15)',
                                        border: '1px solid rgba(34,197,94,0.3)',
                                    }}>
                                    {playingId === rec.id
                                        ? <Pause className="w-4 h-4 text-white" />
                                        : <Play className="w-4 h-4 text-green-400 ml-0.5" />}
                                </button>
                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-white/80">
                                        錄音 #{recordings.length - idx}
                                    </p>
                                    <p className="text-xs" style={{ color: 'rgba(240,235,248,0.35)' }}>
                                        {formatDate(rec.created_at)}
                                    </p>
                                </div>
                                {/* Duration */}
                                <span className="text-xs font-mono" style={{ color: 'rgba(240,235,248,0.3)' }}>
                                    {formatDuration(rec.duration_seconds)}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}
