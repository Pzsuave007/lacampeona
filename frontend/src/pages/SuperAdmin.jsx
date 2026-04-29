import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Crown, Users, BarChart3, RefreshCw, Plus, Pencil, Trash2, Key, X, Save, Shield, Mic2, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../lib/api";

const ROLE_LABEL = {
  super_admin: "Super Admin",
  admin: "Admin",
  dj: "DJ",
};

const ROLE_COLOR = {
  super_admin: "bg-amber-100 text-amber-800 border-amber-200",
  admin: "bg-orange-100 text-orange-800 border-orange-200",
  dj: "bg-violet-100 text-violet-800 border-violet-200",
};

export default function SuperAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState(() => localStorage.getItem("rl_super_tab") || "users");
  const [users, setUsers] = useState([]);
  const [hosts, setHosts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { mode: 'new'|'edit', user? }
  const [resetting, setResetting] = useState(null); // user
  const [tokenAdv, setTokenAdv] = useState([]);
  const [tokenEv, setTokenEv] = useState([]);

  useEffect(() => { localStorage.setItem("rl_super_tab", tab); }, [tab]);

  useEffect(() => {
    if (user === null) navigate("/login");
    else if (user && user.role !== "super_admin") navigate("/");
  }, [user, navigate]);

  const loadAll = async () => {
    try {
      const [u, h, s, av, ev] = await Promise.all([
        api.get("/super/users"),
        api.get("/hosts"),
        api.get("/super/stats"),
        api.get("/admin/advertisers"),
        api.get("/admin/events"),
      ]);
      setUsers(u.data);
      setHosts(h.data);
      setStats(s.data);
      setTokenAdv(av.data);
      setTokenEv(ev.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error cargando");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user?.role === "super_admin") loadAll(); }, [user]);

  if (!user || user.role !== "super_admin") {
    return <div className="min-h-screen p-10 text-slate-500">…</div>;
  }

  const onDeleteUser = async (u) => {
    if (!confirm(`¿Eliminar a ${u.email}?`)) return;
    try {
      await api.delete(`/super/users/${u.id}`);
      toast.success("Usuario eliminado");
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    }
  };

  const onRotateToken = async (entityType, entity) => {
    if (!confirm(`Regenerar el link público de "${entity.name || entity.title}"? El link viejo dejará de funcionar.`)) return;
    try {
      const { data } = await api.post(`/super/rotate-token/${entityType}/${entity.id}`);
      const url = `${window.location.origin}/reporte/${data.report_token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast.success("Token regenerado y copiado al portapapeles");
      loadAll();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    }
  };

  return (
    <div data-testid="super-admin-page" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 text-xs font-extrabold uppercase tracking-[0.2em] mb-2 border border-amber-200">
            <Crown className="w-3.5 h-3.5" /> Super Admin
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight" data-testid="super-title">
            Centro de control
          </h1>
          <p className="text-slate-500 mt-1">Gestiona usuarios, monitorea la plataforma y mantén el control total.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link to="/admin" data-testid="super-go-admin" className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-white border border-slate-200 hover:border-orange-400">
            <Shield className="w-4 h-4" /> Admin
          </Link>
          <Link to="/dj" data-testid="super-go-dj" className="inline-flex items-center gap-1 px-4 py-2 rounded-full text-sm font-bold bg-white border border-slate-200 hover:border-orange-400">
            <Sparkles className="w-4 h-4" /> Studio DJ
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {[
          { key: "users", label: "Usuarios", icon: Users },
          { key: "stats", label: "Estadísticas", icon: BarChart3 },
          { key: "tools", label: "Herramientas", icon: RefreshCw },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            data-testid={`super-tab-${key}`}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition whitespace-nowrap ${tab === key ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"}`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-slate-500">Cargando…</div>
      ) : tab === "users" ? (
        <UsersTab
          users={users}
          hosts={hosts}
          currentUserId={user.id}
          onNew={() => setEditing({ mode: "new" })}
          onEdit={(u) => setEditing({ mode: "edit", user: u })}
          onDelete={onDeleteUser}
          onResetPassword={(u) => setResetting(u)}
        />
      ) : tab === "stats" ? (
        <StatsTab stats={stats} />
      ) : (
        <ToolsTab advertisers={tokenAdv} events={tokenEv} onRotate={onRotateToken} />
      )}

      {editing && (
        <UserModal
          mode={editing.mode}
          initial={editing.user}
          hosts={hosts}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); loadAll(); }}
        />
      )}
      {resetting && (
        <PasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSaved={() => setResetting(null)}
        />
      )}
    </div>
  );
}

function UsersTab({ users, hosts, currentUserId, onNew, onEdit, onDelete, onResetPassword }) {
  const hostName = (slug) => hosts.find((h) => h.slug === slug)?.name || (slug ? `(${slug})` : "");
  return (
    <section data-testid="super-users-tab">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-slate-900">{users.length} usuarios</h2>
        <button
          data-testid="super-new-user-btn"
          onClick={onNew}
          className="inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95 shadow-[0_8px_30px_rgba(234,88,12,0.3)]"
        >
          <Plus className="w-4 h-4" /> Nuevo usuario
        </button>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-600">
            <tr>
              <th className="text-left px-4 py-3">Nombre</th>
              <th className="text-left px-4 py-3">Correo</th>
              <th className="text-left px-4 py-3">Rol</th>
              <th className="text-left px-4 py-3">Host vinculado</th>
              <th className="text-right px-4 py-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid={`super-user-row-${u.id}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-bold text-slate-900">{u.name}</td>
                <td className="px-4 py-3 text-slate-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold uppercase px-2 py-1 rounded-full border ${ROLE_COLOR[u.role] || "bg-slate-100 text-slate-700"}`}>
                    {ROLE_LABEL[u.role] || u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.role === "dj" ? hostName(u.host_slug) || <span className="text-amber-600 text-xs">⚠️ sin asignar</span> : "—"}</td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1">
                    <button data-testid={`super-edit-user-${u.id}`} onClick={() => onEdit(u)} className="p-2 rounded-full hover:bg-slate-100 text-slate-600" title="Editar"><Pencil className="w-4 h-4" /></button>
                    <button data-testid={`super-pwd-user-${u.id}`} onClick={() => onResetPassword(u)} className="p-2 rounded-full hover:bg-amber-50 text-amber-700" title="Cambiar contraseña"><Key className="w-4 h-4" /></button>
                    <button
                      data-testid={`super-del-user-${u.id}`}
                      onClick={() => onDelete(u)}
                      disabled={u.id === currentUserId}
                      className="p-2 rounded-full hover:bg-red-50 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title={u.id === currentUserId ? "No puedes eliminarte" : "Eliminar"}
                    ><Trash2 className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function StatsTab({ stats }) {
  if (!stats) return null;
  const cards = [
    { label: "Usuarios", value: stats.users.total, sub: Object.entries(stats.users.by_role).map(([k, v]) => `${v} ${ROLE_LABEL[k] || k}`).join(" · ") },
    { label: "Hosts (DJs)", value: stats.content.hosts },
    { label: "Anunciantes", value: stats.content.advertisers },
    { label: "Eventos", value: stats.content.events },
    { label: "Borradores totales", value: stats.content.drafts_total, sub: `${stats.content.drafts_30d} en últimos 30 días` },
    { label: "Impresiones (30d)", value: stats.engagement_30d.impressions.toLocaleString() },
    { label: "Clicks (30d)", value: stats.engagement_30d.clicks.toLocaleString() },
    { label: "CTR (30d)", value: `${(stats.engagement_30d.ctr * 100).toFixed(1)}%` },
  ];
  return (
    <section data-testid="super-stats-tab" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{c.label}</div>
          <div className="text-3xl font-black text-slate-900 mt-1">{c.value}</div>
          {c.sub && <div className="text-xs text-slate-500 mt-1">{c.sub}</div>}
        </div>
      ))}
    </section>
  );
}

function ToolsTab({ advertisers, events, onRotate }) {
  return (
    <section data-testid="super-tools-tab" className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-black text-slate-900 mb-1">🔄 Rotar tokens públicos</h3>
        <p className="text-sm text-slate-500 mb-4">Si el link público de reportes (`/reporte/...`) se filtró, regenera el token. El viejo dejará de funcionar al instante.</p>
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Anunciantes</h4>
          {advertisers.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{a.name}</div>
                <div className="text-xs text-slate-500 truncate">/reporte/{(a.report_token || "").slice(0, 8)}…</div>
              </div>
              <button
                data-testid={`super-rotate-adv-${a.id}`}
                onClick={() => onRotate("advertiser", a)}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 inline-flex items-center gap-1"
              ><RefreshCw className="w-3 h-3" /> Rotar</button>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Eventos</h4>
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-slate-900 truncate">{e.title}</div>
                <div className="text-xs text-slate-500 truncate">/reporte/{(e.report_token || "").slice(0, 8)}…</div>
              </div>
              <button
                data-testid={`super-rotate-ev-${e.id}`}
                onClick={() => onRotate("event", e)}
                className="text-xs font-bold px-3 py-1.5 rounded-full bg-amber-100 text-amber-800 hover:bg-amber-200 inline-flex items-center gap-1"
              ><RefreshCw className="w-3 h-3" /> Rotar</button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="font-black text-slate-900 mb-1">🔗 Atajos rápidos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Link to="/admin" className="block bg-orange-50 hover:bg-orange-100 border-2 border-transparent hover:border-orange-300 rounded-xl p-4 transition">
            <Shield className="w-6 h-6 text-orange-600 mb-2" />
            <div className="font-black text-slate-900">Admin Dashboard</div>
            <div className="text-xs text-slate-600">Anunciantes, eventos, locutores y reportes</div>
          </Link>
          <Link to="/dj" className="block bg-violet-50 hover:bg-violet-100 border-2 border-transparent hover:border-violet-300 rounded-xl p-4 transition">
            <Sparkles className="w-6 h-6 text-violet-600 mb-2" />
            <div className="font-black text-slate-900">Content Studio</div>
            <div className="text-xs text-slate-600">Crear posts con IA para redes</div>
          </Link>
          <a href="/" className="block bg-emerald-50 hover:bg-emerald-100 border-2 border-transparent hover:border-emerald-300 rounded-xl p-4 transition">
            <ExternalLink className="w-6 h-6 text-emerald-600 mb-2" />
            <div className="font-black text-slate-900">Ver sitio público</div>
            <div className="text-xs text-slate-600">Lo que ven tus oyentes</div>
          </a>
        </div>
      </div>
    </section>
  );
}

function UserModal({ mode, initial, hosts, onClose, onSaved }) {
  const editing = mode === "edit" && initial;
  const [email, setEmail] = useState(editing?.email || "");
  const [name, setName] = useState(editing?.name || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(editing?.role || "dj");
  const [hostSlug, setHostSlug] = useState(editing?.host_slug || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      if (editing) {
        await api.patch(`/super/users/${initial.id}`, { name, role, host_slug: hostSlug });
      } else {
        if (!password || password.length < 6) {
          toast.error("Contraseña mínima 6 caracteres");
          setBusy(false);
          return;
        }
        await api.post("/super/users", { email, name, password, role, host_slug: hostSlug });
      }
      toast.success("Guardado");
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto" data-testid="super-user-modal">
      <div className="w-full max-w-md bg-white sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-black text-lg text-slate-900">{editing ? "Editar usuario" : "Nuevo usuario"}</h2>
          <button data-testid="super-modal-close" onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Correo</label>
            <input
              data-testid="super-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!editing}
              className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition disabled:bg-slate-50 disabled:text-slate-500"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Nombre</label>
            <input
              data-testid="super-user-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
            />
          </div>
          {!editing && (
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Contraseña inicial</label>
              <input
                data-testid="super-user-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition font-mono"
              />
            </div>
          )}
          <div>
            <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Rol</label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {Object.entries(ROLE_LABEL).map(([k, v]) => (
                <button
                  key={k}
                  data-testid={`super-role-${k}`}
                  onClick={() => setRole(k)}
                  className={`px-3 py-2 rounded-xl text-sm font-bold transition ${role === k ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
                >{v}</button>
              ))}
            </div>
          </div>
          {role === "dj" && (
            <div>
              <label className="text-xs font-bold uppercase tracking-[0.2em] text-slate-600">Vincular a Host (DJ)</label>
              <select
                data-testid="super-user-host"
                value={hostSlug}
                onChange={(e) => setHostSlug(e.target.value)}
                className="mt-1 w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition"
              >
                <option value="">— Sin vincular —</option>
                {hosts.map((h) => (
                  <option key={h.slug} value={h.slug}>{h.name} {h.show_name ? `· ${h.show_name}` : ""}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">El DJ verá el dashboard del host vinculado y solo sus borradores.</p>
            </div>
          )}
          <div className="flex items-center gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
            <button
              data-testid="super-user-save"
              onClick={save}
              disabled={busy || !email.trim() || !name.trim()}
              className="ml-auto inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5 transition active:scale-95"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PasswordModal({ user, onClose, onSaved }) {
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (pw.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setBusy(true);
    try {
      await api.post(`/super/users/${user.id}/password`, { password: pw });
      toast.success(`Contraseña actualizada para ${user.email}`);
      onSaved();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" data-testid="super-pwd-modal">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black text-lg text-slate-900">Cambiar contraseña</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-slate-600 mb-3">Para <span className="font-bold">{user.email}</span></p>
        <input
          data-testid="super-new-password"
          type="text"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Nueva contraseña"
          autoFocus
          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:border-orange-500 focus:outline-none transition font-mono"
        />
        <div className="flex items-center gap-2 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded-full text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200">Cancelar</button>
          <button
            data-testid="super-pwd-save"
            onClick={submit}
            disabled={busy || pw.length < 6}
            className="ml-auto inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-full px-5 py-2.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            Actualizar
          </button>
        </div>
      </div>
    </div>
  );
}
