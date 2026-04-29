import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Radio } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";

function formatErr(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  if (typeof detail?.msg === "string") return detail.msg;
  return String(detail);
}

export default function Login() {
  const { t } = useLanguage();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@radiolatina.fm");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const u = await login(email, password);
      toast.success("¡Bienvenido!");
      if (u?.role === "super_admin") navigate("/super");
      else if (u?.role === "dj") navigate("/dj");
      else navigate("/admin");
    } catch (e) {
      const msg = formatErr(e?.response?.data?.detail) || t.auth.invalid;
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="login-page" className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-11 h-11 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
            <Radio className="w-5 h-5 text-slate-900" strokeWidth={2.5} />
          </span>
          <div>
            <h1 className="text-2xl font-black text-slate-900">{t.auth.loginTitle}</h1>
            <p className="text-sm text-slate-500">{t.auth.loginSubtitle}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
              {t.auth.email}
            </label>
            <input
              data-testid="login-email-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">
              {t.auth.password}
            </label>
            <input
              data-testid="login-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
            />
          </div>

          {err && (
            <div data-testid="login-error" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {err}
            </div>
          )}

          <button
            data-testid="login-submit-btn"
            type="submit"
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white font-bold rounded-full px-6 py-3 transition active:scale-95 shadow-[0_8px_30px_rgba(234,88,12,0.3)]"
          >
            <LogIn className="w-5 h-5" />
            {busy ? t.auth.loggingIn : t.auth.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
