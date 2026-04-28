import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const StationContext = createContext(null);

export function StationProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [active, setActive] = useState(null);

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

  useEffect(() => {
    loadSettings();
    loadActive();
    const id = setInterval(loadActive, 10000);
    return () => clearInterval(id);
  }, [loadSettings, loadActive]);

  return (
    <StationContext.Provider value={{ settings, active, loadSettings, loadActive }}>
      {children}
    </StationContext.Provider>
  );
}

export function useStation() {
  const ctx = useContext(StationContext);
  if (!ctx) throw new Error("useStation must be used inside StationProvider");
  return ctx;
}
