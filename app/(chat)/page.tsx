'use client';

import React, { useState, useRef } from 'react';
import { Mic, Waves, Send, Square } from 'lucide-react';
import { useChat } from '@ai-sdk/react';

export default function Home() {
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const { messages, sendMessage, status } = useChat();
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    sendMessage({ parts: [{ type: 'text', text: input }], role: 'user' });
    setInput('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const mimeType = mediaRecorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach((track) => track.stop());

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          sendMessage({
            role: 'user',
            parts: [
              { type: 'text', text: input || 'Here is my vocal recording. How does it sound?' },
              { type: 'file', mediaType: mimeType, url: dataUrl },
            ],
          });
          setInput('');
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone', err);
      alert('Could not access microphone. Please ensure permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <main className="flex flex-col items-center justify-between min-h-screen bg-zinc-950 text-white font-sans p-6 overflow-hidden relative">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative z-10 flex flex-col items-center space-y-6 text-center max-w-3xl w-full flex-grow pt-4">
        <header className="space-y-4 shrink-0">
          <div className="inline-flex items-center justify-center p-3 bg-zinc-900 border border-zinc-800 rounded-2xl mb-2 shadow-xl">
            <Waves className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white to-zinc-400 bg-clip-text text-transparent pb-2">
            Maicrophone
          </h1>
          <p className="text-base text-zinc-400 font-medium">
            Your personal AI Vocal Coach.
          </p>
        </header>

        {/* Chat Messages Area */}
        <div className="flex-1 w-full overflow-y-auto space-y-4 p-4 text-left font-medium max-h-[50vh]">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 border border-zinc-800/50 bg-zinc-900/50 backdrop-blur-md rounded-[3rem] w-full max-w-md mx-auto shadow-2xl gap-8 mt-4">
              <button 
                type="button"
                onClick={toggleRecording}
                className={`group relative flex items-center justify-center w-32 h-32 rounded-full transition-all duration-500 shadow-[0_0_40px_rgba(79,70,229,0.3)] focus:outline-none focus:ring-4 focus:ring-indigo-500/50
                  ${isRecording ? 'bg-red-600 hover:bg-red-500 hover:scale-105 hover:shadow-[0_0_80px_rgba(220,38,38,0.5)]' : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 hover:shadow-[0_0_80px_rgba(79,70,229,0.5)]'}
                `}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {/* Ripple effect rings */}
                <div className={`absolute inset-0 rounded-full border-2 ${isRecording ? 'border-red-400/30' : 'border-indigo-400/30'} group-hover:animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite]`} />
                <div className={`absolute inset-0 rounded-full border-2 ${isRecording ? 'border-red-400/10' : 'border-indigo-400/10'} group-hover:animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] delay-150`} />
                
                {isRecording ? <Square className="w-12 h-12 text-white/90 drop-shadow-md group-hover:scale-110 transition-transform duration-300 fill-current" strokeWidth={1.5} /> : <Mic className="w-12 h-12 text-white/90 drop-shadow-md group-hover:scale-110 transition-transform duration-300" strokeWidth={1.5} />}
              </button>
              
              <div className="space-y-2 text-center">
                <h2 className="text-xl font-semibold text-white">{isRecording ? "Listening..." : "Ready when you are"}</h2>
                <p className="text-sm text-zinc-500">{isRecording ? "Tap the square to analyze audio." : "Tap the mic to start your vocal warm-up."}</p>
              </div>
            </div>
          ) : (
            messages.map((m) => (
              m.role !== 'system' && (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 rounded-3xl max-w-[85%] ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-zinc-800/80 text-zinc-200 border border-zinc-700 rounded-bl-none'}`}>
                    {Array.isArray(m.parts) ? m.parts.map((p, i) => {
                       if (p.type === 'text') return <span key={i}>{p.text}</span>;
                       return null;
                    }) : null}
                  </div>
                </div>
              )
            ))
          )}
          {isLoading && (
            <div className="flex justify-start">
               <div className="p-4 rounded-3xl max-w-[85%] bg-zinc-800/80 text-zinc-400 border border-zinc-700 rounded-bl-none animate-pulse">
                Thinking...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 w-full max-w-3xl shrink-0 pb-4">
        <form onSubmit={handleSubmit} className="relative flex items-center bg-zinc-900 border border-zinc-800 rounded-full shadow-2xl p-2 gap-2">
           <button 
              type="button"
              onClick={toggleRecording}
              className={`p-3 rounded-full transition-colors flex-shrink-0 ${
                isRecording 
                  ? 'text-red-500 bg-red-500/20 hover:bg-red-500/30 animate-pulse' 
                  : 'text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700'
              }`}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <Square className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Ask your vocal coach anything..."
              className="flex-1 bg-transparent border-none text-white focus:ring-0 px-2 py-2 text-base outline-none placeholder:text-zinc-500"
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
        </form>
      </div>
    </main>
  );
}
