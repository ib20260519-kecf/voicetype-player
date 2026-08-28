import React, { useState, useEffect } from 'react';
import { BaseStudyModeProps } from '../../types';

interface VideoModeProps extends BaseStudyModeProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setIsPlaying: (playing: boolean) => void;
}

// 🎨 High-Quality Contextual Storyboard Images for Audio Lessons
const DEFAULT_STORYBOARD_IMAGES = [
  'https://images.unsplash.com/photo-1556742049-0a67e55722c0?auto=format&fit=crop&w=1200&q=80', // Hotel/Airport Check-in Desk
  'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80', // Conversation & Meeting
  'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=80', // Travel & Airport
  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1200&q=80', // Business Reception
  'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80', // Education & Communication
];

export const VideoMode: React.FC<VideoModeProps> = ({
  lesson,
  segments,
  activeSegmentIndex,
  onJumpToSegment,
  videoRef,
  setIsPlaying,
  isPlaying = false,
  onTogglePlay
}) => {
  const isVideoSource = (lesson.audio_url && lesson.audio_url.endsWith('.mp4')) || !!lesson.video_url;
  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };
  
  const [showStoryboard, setShowStoryboard] = useState<boolean>(true);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);

  // Rotate Storyboard image dynamically based on active segment progression
  useEffect(() => {
    if (segments.length > 0) {
      const idx = Math.floor((activeSegmentIndex / segments.length) * DEFAULT_STORYBOARD_IMAGES.length) % DEFAULT_STORYBOARD_IMAGES.length;
      setCurrentImageIndex(idx);
    }
  }, [activeSegmentIndex, segments.length]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-4 sm:p-6">
      {/* ─── Media Display Area (Video vs Dynamic Storyboard Canvas) ─── */}
      <div className="relative aspect-video max-w-2xl mx-auto rounded-3xl overflow-hidden bg-black border border-slate-800 shadow-2xl group select-none">
        {isVideoSource ? (
          <video
            ref={videoRef as any}
            src={lesson.video_url || lesson.audio_url}
            className="w-full h-full object-contain"
            controls
            playsInline
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
        ) : (
          /* 🎨 Dynamic Visual Storyboard & Ambient Podcast Canvas for MP3 Audio */
          <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between p-6 sm:p-8">
            {/* Background Storyboard Image with Ken Burns Zoom Effect */}
            {showStoryboard && (
              <div className="absolute inset-0 z-0 overflow-hidden">
                <img
                  key={currentImageIndex}
                  src={DEFAULT_STORYBOARD_IMAGES[currentImageIndex]}
                  alt="Contextual Scene"
                  className="w-full h-full object-cover animate-in fade-in zoom-in-105 duration-1000 scale-105 transition-transform ease-out"
                />
                {/* Dark Gradient Overlay for Maximum Subtitle Readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/75 to-slate-950/60 backdrop-blur-[1.5px]" />
              </div>
            )}

            {/* Top Bar: Audio Mode Badge + Storyboard Toggle */}
            <div className="relative z-10 w-full flex items-center justify-between">
              <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[11px] font-black backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping inline-block"></span>
                🎧 스마트 오디오 스토리보드
              </span>

              <button
                type="button"
                onClick={() => setShowStoryboard(!showStoryboard)}
                className="px-2.5 py-1 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-xl text-[10px] font-bold backdrop-blur-md transition-all cursor-pointer flex items-center gap-1"
                title="상황별 배경 이미지 켜기/끄기"
              >
                {showStoryboard ? '🖼️ 배경 끄기' : '🖼️ 비주얼 배경 켜기'}
              </button>
            </div>

            {/* Center: Glowing Focus Caption & Dialogue Card */}
            <div className="relative z-10 max-w-xl text-center space-y-3 my-auto">
              <div className="inline-block p-4 sm:p-6 bg-slate-900/85 border border-slate-700/70 rounded-3xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95">
                <span className="text-[10px] font-mono font-black text-indigo-400 uppercase tracking-widest block mb-2">
                  Sentence {activeSegmentIndex + 1} of {segments.length}
                </span>
                <h3 className="text-base sm:text-xl md:text-2xl font-black text-white leading-relaxed tracking-wide drop-shadow-md">
                  "{activeSegment.text}"
                </h3>
              </div>
            </div>

            {/* Bottom: Animated Neon Waveform Equalizer */}
            <div className="relative z-10 w-full flex items-center justify-between pt-2">
              <div className="flex items-center gap-1.5 h-6">
                {[40, 70, 90, 60, 100, 50, 80, 65, 95, 45, 85, 30].map((h, i) => (
                  <span
                    key={i}
                    style={{
                      height: isPlaying ? `${h}%` : '20%',
                      transition: 'height 0.2s ease-in-out'
                    }}
                    className={`w-1 rounded-full ${
                      isPlaying
                        ? 'bg-gradient-to-t from-indigo-500 via-purple-500 to-pink-500 animate-pulse'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              <span className="text-[11px] font-mono text-slate-400 font-bold bg-slate-900/80 px-2.5 py-0.5 rounded-lg border border-slate-800">
                {Math.floor(activeSegment.start)}s ~ {Math.floor(activeSegment.end)}s
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Timeline Interactive Script List ─── */}
      <div className="space-y-1.5 max-h-52 overflow-y-auto p-2 bg-slate-950/90 rounded-2xl border border-slate-800/80 shadow-inner">
        {segments.map((seg, idx) => {
          const isCurrent = idx === activeSegmentIndex;
          return (
            <div
              key={idx}
              onClick={() => onJumpToSegment(idx)}
              className={`p-3 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                isCurrent
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black shadow-lg shadow-indigo-600/30 scale-101'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <span className="truncate flex-1 pr-3 flex items-center gap-2">
                <span className="font-mono text-[11px] opacity-70 w-6">{idx + 1}.</span>
                <span className="truncate">{seg.text}</span>
              </span>
              <span className="font-mono text-[10px] opacity-70 px-2 py-0.5 rounded-md bg-black/30">
                {Math.floor(seg.start)}s
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
