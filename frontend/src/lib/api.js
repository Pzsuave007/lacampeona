import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;
export const API = `${BASE}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

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
