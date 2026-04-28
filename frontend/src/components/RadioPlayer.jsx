import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Radio } from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";

export default function RadioPlayer() {
  const { settings } = useStation();
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = muted;
    }
  }, [volume, muted]);

  // When stream URL changes, reset
  useEffect(() => {
    setError(false);
    if (audioRef.current) {
      audioRef.current.load();
      if (playing) {
        audioRef.current.play().catch(() => setError(true));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.stream_url]);

  const toggle = async () => {
    if (!audioRef.current) return;
    try {
      if (playing) {
        audioRef.current.pause();
        setPlaying(false);
      } else {
        await audioRef.current.play();
        setPlaying(true);
        setError(false);
      }
    } catch (e) {
      setError(true);
      setPlaying(false);
    }
  };

  const stationName = settings?.station_name || "KWIP La Campeona";
  const nowPlaying = settings?.now_playing || "—";
  const streamUrl = settings?.stream_url || "";

  return (
    <div
      data-testid="radio-player"
      className="fixed bottom-0 left-0 right-0 z-50 sm:bottom-4 sm:left-4 sm:right-4 mx-auto max-w-5xl"
    >
      {error && (
        <div
          className="absolute left-3 right-3 sm:left-6 sm:right-6 -top-8 px-3 py-1.5 text-[11px] text-red-100 bg-red-700/95 rounded-full text-center shadow-lg"
          data-testid="player-error"
        >
          Stream unavailable. Verify the stream URL in admin settings.
        </div>
      )}
      <div className="bg-slate-900 text-white sm:rounded-3xl shadow-2xl shadow-orange-900/30 border border-white/5 overflow-hidden">
        <div className="flex items-center gap-4 p-3 sm:p-4">
          {/* Logo / live indicator */}
          <div className="relative shrink-0">
            <div
              className={`w-14 h-14 rounded-full bg-white flex items-center justify-center overflow-hidden ring-2 ring-amber-300/60 shadow-md ${
                playing ? "vinyl-spin" : ""
              }`}
            >
              <img
                src="https://customer-assets.emergentagent.com/job_radio-ads-hub/artifacts/nebxp78j_logo_old_remake_fm-2018.png"
                alt="La Campeona"
                className="w-full h-full object-contain p-1"
              />
            </div>
          </div>

          {/* Now playing */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="inline-flex items-center gap-1 bg-red-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-white live-dot" />
                {t.live.label}
              </span>
              <span className="text-[10px] uppercase tracking-[0.2em] text-orange-300 font-bold">
                {t.live.nowPlaying}
              </span>
              {/* EQ bars - always rendered (opacity) so player height stays stable */}
              <span
                className={`flex items-end gap-0.5 h-3 text-orange-300 transition-opacity ${
                  playing ? "opacity-100" : "opacity-0"
                }`}
                aria-hidden="true"
              >
                <span className="eq-bar" style={{ width: 2, height: 10 }} />
                <span className="eq-bar" style={{ width: 2, height: 10 }} />
                <span className="eq-bar" style={{ width: 2, height: 10 }} />
              </span>
            </div>
            <div className="font-extrabold text-base sm:text-lg truncate" data-testid="now-playing-text">
              {nowPlaying}
            </div>
            <div className="text-xs text-slate-300 truncate">{stationName}</div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              data-testid="player-mute-btn"
              onClick={() => setMuted((m) => !m)}
              className="hidden sm:flex w-11 h-11 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition active:scale-95"
              aria-label={muted ? t.live.unmute : t.live.mute}
            >
              {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="hidden md:block w-24 accent-orange-500"
              aria-label="Volume"
              data-testid="player-volume-slider"
            />
            <button
              data-testid="player-play-btn"
              onClick={toggle}
              className="w-14 h-14 rounded-full bg-orange-500 hover:bg-orange-600 transition active:scale-95 shadow-[0_8px_30px_rgba(234,88,12,0.5)] flex items-center justify-center"
              aria-label={playing ? t.live.pause : t.live.play}
            >
              {playing ? (
                <Pause className="w-6 h-6 text-white" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
              )}
            </button>
          </div>
        </div>
        <audio
          ref={audioRef}
          src={streamUrl}
          preload="none"
          crossOrigin="anonymous"
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
