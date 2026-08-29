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
}) => {
  const isVideoSource = (lesson.audio_url && lesson.audio_url.endsWith('.mp4')) || !!lesson.video_url;
  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };
  
  const [showStoryboard, setShowStoryboard] = useState<boolean>(true);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  // Rotate Storyboard image dynamically based on active segment progression
  useEffect(() => {
    if (segments.length > 0) {
      const idx = Math.floor((activeSegmentIndex / segments.length) * DEFAULT_STORYBOARD_IMAGES.length) % DEFAULT_STORYBOARD_IMAGES.length;
      setCurrentImageIndex(idx);
    }
  }, [activeSegmentIndex, segments.length]);

  // 🎯 Auto-Scroll strictly within script container to keep active sentence centered
  useEffect(() => {
    if (scrollContainerRef.current && activeSegmentIndex >= 0) {
      const container = scrollContainerRef.current;
      const el = document.getElementById(`video-seg-${activeSegmentIndex}`);
      if (el) {
        const elOffset = el.offsetTop - container.offsetTop;
        const targetScroll = elOffset - (container.clientHeight / 2) + (el.clientHeight / 2);
        container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
      }
    }
  }, [activeSegmentIndex]);

  const filteredSegments = segments.filter(seg =>
    seg.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-4 sm:p-6">
      {/* ─── 2-Column Side-by-Side Responsive Studio Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        
        {/* 🎬 Left Column: Video Player / Dynamic Visual Storyboard (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl group select-none flex items-center justify-center">
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
              <div className="relative w-full h-full overflow-hidden flex flex-col items-center justify-between p-4 sm:p-6">
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
                  <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-[10px] font-black backdrop-blur-md flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping inline-block"></span>
                    🎧 오디오 스토리보드
                  </span>

                  <button
                    type="button"
                    onClick={() => setShowStoryboard(!showStoryboard)}
                    className="px-2 py-0.5 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-lg text-[10px] font-bold backdrop-blur-md transition-all cursor-pointer flex items-center gap-1"
                    title="상황별 배경 이미지 켜기/끄기"
                  >
                    {showStoryboard ? '🖼️ 배경 끄기' : '🖼️ 배경 켜기'}
                  </button>
                </div>

                {/* Center: Glowing Focus Caption & Dialogue Card */}
                <div className="relative z-10 max-w-lg text-center space-y-2 my-auto">
                  <div className="inline-block p-3 sm:p-5 bg-slate-900/85 border border-slate-700/70 rounded-2xl shadow-2xl backdrop-blur-xl animate-in zoom-in-95">
                    <span className="text-[10px] font-mono font-black text-indigo-400 uppercase tracking-widest block mb-1">
                      Sentence {activeSegmentIndex + 1} of {segments.length}
                    </span>
                    <h3 className="text-sm sm:text-base md:text-lg font-black text-white leading-relaxed tracking-wide drop-shadow-md">
                      "{activeSegment.text}"
                    </h3>
                  </div>
                </div>

                {/* Bottom: Animated Neon Waveform Equalizer */}
                <div className="relative z-10 w-full flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1 h-5">
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

                  <span className="text-[10px] font-mono text-slate-400 font-bold bg-slate-900/80 px-2 py-0.5 rounded-md border border-slate-800">
                    {Math.floor(activeSegment.start)}s ~ {Math.floor(activeSegment.end)}s
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 📜 Right Column: Synchronized Interactive Subtitles / Script (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col bg-slate-950/90 border border-slate-800/90 rounded-2xl p-3.5 shadow-inner">
          {/* Header & Search */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm">📜</span>
              <span className="text-xs font-black text-white">대본 & 자막 타임라인</span>
            </div>
            <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/60 px-2 py-0.5 rounded-full">
              총 {segments.length}문장
            </span>
          </div>

          {/* Quick Search */}
          <div className="mb-2">
            <input
              type="text"
              placeholder="대본 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl text-xs text-white outline-none placeholder:text-slate-600 transition-colors"
            />
          </div>

          {/* Scrollable Subtitle Sentences with Auto-Scroll & Instant Jump */}
          <div
            ref={scrollContainerRef}
            className="flex-1 max-h-[380px] sm:max-h-[420px] overflow-y-auto space-y-1.5 custom-scrollbar pr-1"
          >
            {filteredSegments.length === 0 ? (
              <p className="text-center py-10 text-slate-500 text-xs">일치하는 대본이 없습니다.</p>
            ) : (
              filteredSegments.map((seg) => {
                const originalIdx = segments.findIndex(s => s === seg || (s.start === seg.start && s.end === seg.end));
                const isCurrent = originalIdx === activeSegmentIndex;
                return (
                  <div
                    key={originalIdx}
                    id={`video-seg-${originalIdx}`}
                    onClick={() => onJumpToSegment(originalIdx)}
                    className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all flex items-start justify-between gap-2 border ${
                      isCurrent
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black shadow-lg shadow-indigo-600/30 scale-101 border-indigo-400'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-700'
                    }`}
                    title="클릭하면 해당 구간으로 비디오 이동"
                  >
                    <span className="flex-1 leading-relaxed flex items-start gap-1.5">
                      <span className="font-mono text-[10px] opacity-70 mt-0.5 w-5 flex-shrink-0">
                        {originalIdx + 1}.
                      </span>
                      <span>{seg.text}</span>
                    </span>
                    <span className="font-mono text-[10px] opacity-70 px-1.5 py-0.5 rounded bg-black/40 flex-shrink-0">
                      {Math.floor(seg.start)}s
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
