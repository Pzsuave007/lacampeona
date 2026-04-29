import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

const TOKEN_KEY = "rl_access_token";

export function getStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
export function setStoredToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

export const api = axios.create({
  baseURL: API,
});

// Attach Bearer token from localStorage on every request (works around
// the proxy adding `Access-Control-Allow-Origin: *` which kills httpOnly
// cookies in the browser).
api.interceptors.request.use((config) => {
  const t = getStoredToken();
  if (t) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

// Clear session on real 401 from API. Login endpoint is excluded so
// a wrong-password attempt doesn't kick the user out.
api.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    if (status === 401 && !url.includes("/auth/login")) {
      try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem("rl_user");
      } catch { /* ignore */ }
    }
    return Promise.reject(error);
  }
);

export function bannerUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${API}/files/${pathOrUrl}`;
}

export function waLink(number, message) {
  if (!number) return "";
  const clean = String(number).replace(/[^0-9]/g, "");
  const text = encodeURIComponent(message || "");
  return `https://wa.me/${clean}${text ? `?text=${text}` : ""}`;
}

export function telLink(number) {
  if (!number) return "";
  return `tel:${String(number).replace(/\s+/g, "")}`;
}

export function mapsLink(adv) {
  if (!adv) return "";
  if (adv.maps_url) return adv.maps_url;
  if (adv.address) return `https://maps.google.com/?q=${encodeURIComponent(adv.address)}`;
  return "";
}
