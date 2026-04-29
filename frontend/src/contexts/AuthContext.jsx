import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, setStoredToken, getStoredToken } from "../lib/api";

const AuthContext = createContext(null);
const USER_KEY = "rl_user";

function readUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function writeUser(u) {
  try {
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  } catch { /* ignore */ }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = checking, null = guest

  const refresh = useCallback(async () => {
    const token = getStoredToken();
    const cached = readUser();
    if (!token || !cached) {
      setUser(null);
      return;
    }
    // Trust the cached user. Real 401s from any API call will trigger
    // the response interceptor to clear the session.
    setUser(cached);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    if (data.access_token) setStoredToken(data.access_token);
    writeUser(data.user);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (e) { /* ignore */ }
    setStoredToken("");
    writeUser(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
