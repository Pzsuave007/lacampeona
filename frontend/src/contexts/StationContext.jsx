import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const StationContext = createContext(null);

export function StationProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState(null);
  const [liveHost, setLiveHost] = useState(null);
  const [nowPlaying, setNowPlaying] = useState({ title: "", artist: "", image: "", ok: false });

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get("/settings");
      setSettings(data);
    } catch (e) {
      // ignore
    }
  }, []);

  const loadActive = useCallback(async () => {
    try {
      const { data } = await api.get("/active");
      setActive(data.advertiser);
    } catch (e) {
      // ignore
    }
  }, []);

  const loadLiveHost = useCallback(async () => {
    try {
      const { data } = await api.get("/live-host");
      setLiveHost(data.host);
    } catch (e) {
      // ignore
    }
  }, []);

  const loadNowPlaying = useCallback(async () => {
    try {
      const { data } = await api.get("/now-playing");
      setNowPlaying(data || { title: "", artist: "", image: "", ok: false });
    } catch (e) {
      setNowPlaying({ title: "", artist: "", image: "", ok: false });
    }
  }, []);

  useEffect(() => {
    loadSettings();
    loadActive();
    loadLiveHost();
    loadNowPlaying();
    // Poll active advertiser every 5 seconds for snappy spot rotation
    // Poll live host every 30 seconds (changes are slower)
    // Poll now-playing every 20 seconds
    const adId = setInterval(loadActive, 5000);
    const hostId = setInterval(loadLiveHost, 30000);
    const npId = setInterval(loadNowPlaying, 20000);
    return () => {
      clearInterval(adId);
      clearInterval(hostId);
      clearInterval(npId);
    };
  }, [loadSettings, loadActive, loadLiveHost, loadNowPlaying]);

  return (
    <StationContext.Provider
      value={{ settings, active, liveHost, nowPlaying, loadSettings, loadActive, loadLiveHost }}
    >
      {children}
    </StationContext.Provider>
  );
}

export function useStation() {
  const ctx = useContext(StationContext);
  if (!ctx) throw new Error("useStation must be used inside StationProvider");
  return ctx;
}
