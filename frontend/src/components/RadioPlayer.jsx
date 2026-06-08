import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Volume2, VolumeX, Radio } from "lucide-react";
import { useStation } from "../contexts/StationContext";
import { useLanguage } from "../contexts/LanguageContext";
import { bannerUrl } from "../lib/api";

const FALLBACK_LOGO = "/logos/la-campeona-880am.png";

export default function RadioPlayer() {
  const { settings, nowPlaying } = useStation();
  const { t } = useLanguage();
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [error, setError] = useState(false);
  const [artworkBroken, setArtworkBroken] = useState(false);

  // Reset artwork-broken when image changes
  useEffect(() => {
    setArtworkBroken(false);
  }, [nowPlaying?.image]);

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

  // Poll now-playing every 20s (handled by StationContext now)
  // (removed local polling — uses shared `nowPlaying` from useStation)

  // ---- MOBILE FIX #1: auto-reconnect when the stream stalls/errors ----
  // Mobile networks (WiFi <-> 4G handoff, weak signal) cause brief drops
  // that kill the stream forever unless we re-load() and play() again.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    let retryCount = 0;
    let retryTimer = null;

    const reconnect = () => {
      if (!playing) return;
      retryCount += 1;
      if (retryCount > 6) return; // give up after ~30s of retries
      const delay = Math.min(5000, 500 * retryCount);
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        try {
          el.load();
          el.play().catch(() => {});
        } catch {}
      }, delay);
    };

    const onStall = () => reconnect();
    const onError = () => reconnect();
    const onEnded = () => reconnect();
    const onPlaying = () => {
      retryCount = 0;
      clearTimeout(retryTimer);
    };

    el.addEventListener("stalled", onStall);
    el.addEventListener("error", onError);
    el.addEventListener("ended", onEnded);
    el.addEventListener("playing", onPlaying);
    return () => {
      el.removeEventListener("stalled", onStall);
      el.removeEventListener("error", onError);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("playing", onPlaying);
      clearTimeout(retryTimer);
    };
  }, [playing]);

  // ---- MOBILE FIX #2: Media Session API (lock screen + background) ----
  // Tells iOS/Android "I'm playing media" so the OS doesn't kill the audio
  // when the screen locks. Also shows nice lock-screen controls.
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const stationName = settings?.station_name || "KWIP La Campeona";
    const artworkUrl = nowPlaying.image || FALLBACK_LOGO;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: nowPlaying.title || stationName,
        artist: nowPlaying.artist || stationName,
        album: stationName,
        artwork: [
          { src: artworkUrl, sizes: "256x256", type: "image/jpeg" },
          { src: artworkUrl, sizes: "512x512", type: "image/jpeg" },
        ],
      });
      navigator.mediaSession.setActionHandler("play", () => {
        audioRef.current?.play().catch(() => {});
        setPlaying(true);
      });
      navigator.mediaSession.setActionHandler("pause", () => {
        audioRef.current?.pause();
        setPlaying(false);
      });
      navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    } catch {
      /* ignore — older browsers */
    }
  }, [nowPlaying.title, nowPlaying.artist, nowPlaying.image, playing, settings?.station_name]);

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
  const fallbackNowPlaying = settings?.now_playing || "—";
  const streamUrl = settings?.stream_url || "";

  // Use live metadata if available, otherwise fallback to manual setting
  // Detect station-info masquerading as a song (Streaming Pulse returns artist="KWIP", title="AM 880" etc)
  const looksLikeStation = (s = "") => {
    const up = String(s).toUpperCase();
    return /\bKWIP\b|\bAM\s*8?80\b|\bFM\s*10?3\.?9\b|\b103\.9\b|LA\s+CAMPEONA/.test(up);
  };
  const realSong = !!(
    nowPlaying.title &&
    nowPlaying.artist &&
    !looksLikeStation(nowPlaying.title) &&
    !looksLikeStation(nowPlaying.artist)
  );
  const customArtwork = settings?.default_artwork ? bannerUrl(settings.default_artwork) : "";
  const effectiveArtwork = realSong ? nowPlaying.image : (customArtwork || nowPlaying.image);

  // Only show the live "title • artist" line when it's a REAL song
  const showArtwork = (realSong && effectiveArtwork && !artworkBroken)
    || (!realSong && customArtwork && !artworkBroken);
  const primaryLine = realSong
    ? [nowPlaying.title, nowPlaying.artist].filter(Boolean).join(" • ")
    : fallbackNowPlaying;
  const secondaryLine = stationName;

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
          {/* Logo / artwork */}
          <div className="relative shrink-0">
            <div
              className={`w-14 h-14 rounded-full bg-white flex items-center justify-center overflow-hidden ring-2 ring-amber-300/60 shadow-md ${
                playing ? "vinyl-spin" : ""
              }`}
              data-testid="player-artwork"
            >
              {showArtwork ? (
                <img
                  src={effectiveArtwork}
                  alt={nowPlaying.title || "Now playing"}
                  className="w-full h-full object-cover"
                  onError={() => setArtworkBroken(true)}
                />
              ) : (
                <img
                  src={FALLBACK_LOGO}
                  alt="La Campeona"
                  className="w-full h-full object-contain p-1"
                />
              )}
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
            <div className="font-extrabold text-base sm:text-lg truncate" data-testid="now-playing-text" title={primaryLine}>
              {primaryLine}
            </div>
            <div className="text-xs text-slate-300 truncate">{secondaryLine}</div>
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
          playsInline
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
