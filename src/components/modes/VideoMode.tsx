import React from 'react';
import { BaseStudyModeProps } from '../../types';

interface VideoModeProps extends BaseStudyModeProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  setIsPlaying: (playing: boolean) => void;
}

export const VideoMode: React.FC<VideoModeProps> = ({
  lesson,
  segments,
  activeSegmentIndex,
  onJumpToSegment,
  videoRef,
  setIsPlaying
}) => {
  const isVideoSource = lesson.audio_url.endsWith('.mp4') || lesson.video_url;
  const activeSegment = segments[activeSegmentIndex] || { text: '', start: 0, end: 0 };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-4 sm:p-6">
      <div className="relative aspect-video max-w-2xl mx-auto rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-xl">
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
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-indigo-950 to-slate-950 p-6 text-center space-y-3">
            <div className="w-16 h-16 bg-rose-500/20 text-rose-400 rounded-full flex items-center justify-center text-3xl">
              🎬
            </div>
            <h3 className="text-base font-black text-white">{lesson.title}</h3>
            <p className="text-xs text-slate-400">오디오 스트리밍과 실시간 싱크 자막이 함께 재생됩니다.</p>
          </div>
        )}
      </div>

      <div className="p-4 bg-indigo-950/40 border border-indigo-900/60 rounded-2xl text-center space-y-1">
        <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">
          현재 재생 중인 문장 (Sentence {activeSegmentIndex + 1} / {segments.length})
        </span>
        <p className="text-base sm:text-lg font-black text-white">
          "{activeSegment.text}"
        </p>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-slate-950/80 rounded-2xl border border-slate-800">
        {segments.map((seg, idx) => {
          const isCurrent = idx === activeSegmentIndex;
          return (
            <div
              key={idx}
              onClick={() => onJumpToSegment(idx)}
              className={`p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                isCurrent
                  ? 'bg-indigo-600 text-white font-bold shadow-md'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
              }`}
            >
              <span className="truncate flex-1 pr-2">
                <span className="font-mono opacity-60 mr-2">{idx + 1}.</span>
                {seg.text}
              </span>
              <span className="font-mono text-[10px] opacity-60">
                {Math.floor(seg.start)}s
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
