import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const StationContext = createContext(null);

export function StationProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState(null);
  const [liveHost, setLiveHost] = useState(null);

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

  useEffect(() => {
    loadSettings();
    loadActive();
    loadLiveHost();
    const id = setInterval(() => {
      loadActive();
      loadLiveHost();
    }, 10000);
    return () => clearInterval(id);
  }, [loadSettings, loadActive, loadLiveHost]);

  return (
    <StationContext.Provider
      value={{ settings, active, liveHost, loadSettings, loadActive, loadLiveHost }}
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
