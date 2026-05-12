'use client';

import { ChevronDown } from 'lucide-react';
import { useRef, useState } from 'react';

export const MODEL_OPTIONS = [
    // — Gemini 3.x —
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', description: '最新最強' },
    { id: 'gemini-3-pro-preview', label: 'Gemini 3 Pro', description: '次世代' },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', description: '次世代快速' },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', description: '超輕量' },
    // — Gemini 2.5 —
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: '強大' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: '快速（預設）' },
    { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', description: '輕量' },
    // — Gemini 2.0 —
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', description: '穩定' },
    { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', description: '最輕量' }
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]['id'];

export const DEFAULT_MODEL: ModelId = 'gemini-2.5-flash';

interface ModelSelectorProps {
    value: ModelId;
    onChange: (model: ModelId) => void;
}

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const current = MODEL_OPTIONS.find(m => m.id === value) ?? MODEL_OPTIONS[0];

    return (
        <div ref={ref} className="relative inline-block">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all hover:scale-105"
                style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(240,235,248,0.6)',
                }}
            >
                <span>🤖</span>
                <span>{current.label}</span>
                <ChevronDown className="w-3 h-3" />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div
                        className="absolute right-0 top-full mt-1 z-50 rounded-xl py-1 shadow-2xl min-w-[200px]"
                        style={{
                            background: 'rgba(20,15,30,0.95)',
                            border: '1px solid rgba(255,255,255,0.12)',
                            backdropFilter: 'blur(20px)',
                        }}
                    >
                        {MODEL_OPTIONS.map((model) => (
                            <button
                                key={model.id}
                                onClick={() => { onChange(model.id); setOpen(false); }}
                                className="w-full text-left px-3 py-2 flex items-center justify-between gap-3 transition-colors"
                                style={{
                                    color: model.id === value ? '#8B5CF6' : 'rgba(240,235,248,0.7)',
                                    background: model.id === value ? 'rgba(139,92,246,0.1)' : 'transparent',
                                }}
                                onMouseEnter={(e) => { if (model.id !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                                onMouseLeave={(e) => { if (model.id !== value) e.currentTarget.style.background = 'transparent'; }}
                            >
                                <div>
                                    <div className="text-xs font-medium">{model.label}</div>
                                    <div className="text-[10px]" style={{ color: 'rgba(240,235,248,0.35)' }}>{model.description}</div>
                                </div>
                                {model.id === value && <span className="text-xs">✓</span>}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
