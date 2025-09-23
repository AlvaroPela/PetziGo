import React, { useEffect, useMemo, useState } from "react";

/* ========= API helper ========= */
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

async function api(path, { method = "GET", body, token } = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const message = data?.message || data?.error || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return data;
  } catch (e) {
    if (e instanceof TypeError) {
      throw new Error("No se pudo conectar con la API.");
    }
    throw e;
  }
}

/* ========= UI helpers ========= */
function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
  autoComplete,
  right, // nodo opcional (botón/ícono a la derecha)
  name,
  className = "",
}) {
  return (
    <label className="block">
      {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
      <div className="relative">
        <input
          name={name}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          className={`mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 ${right ? "pr-12" : ""} ${className}`}
        />
        {right && (
          <div className="absolute inset-y-0 right-2 mt-1 flex items-center">{right}</div>
        )}
      </div>
    </label>
  );
}

function Card({ title, children, footer }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
      {footer && <div className="mt-4 border-t pt-3 text-sm text-gray-500">{footer}</div>}
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  const base = "fixed top-4 right-4 z-50 rounded-xl px-4 py-2 shadow text-white";
  const tone = toast.type === "error" ? "bg-rose-600" : "bg-emerald-600";
  return <div className={`${base} ${tone}`}>{toast.msg}</div>;
}

/* ========= Utilidades de validación ========= */
function validateEmail(v) {
  return /.+@.+\..+/.test(String(v).toLowerCase());
}
function strength(pw) {
  const rules = [/.{8,}/.test(pw), /[a-z]/.test(pw), /[A-Z]/.test(pw), /\d/.test(pw), /[^A-Za-z0-9]/.test(pw)];
  const score = rules.filter(Boolean).length; // 0..5
  const labels = ["Muy débil", "Débil", "Aceptable", "Buena", "Fuerte", "Excelente"];
  const colors = ["bg-rose-500", "bg-orange-500", "bg-amber-500", "bg-yellow-500", "bg-emerald-500", "bg-emerald-600"];
  return { score, label: labels[score], color: colors[score], width: `${(score / 5) * 100}%` };
}

/* ========= Register full-screen (ÚNICA definición) ========= */
function RegisterScreen({ auth, onDone, notify, goLogin }) {
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [docType, setDocType] = useState("CC");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("USER");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [accept, setAccept] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const el = document.querySelector('input[name="name"]');
    if (el) el.focus();
  }, []);

  const emailOk = validateEmail(email);
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneOk = phoneDigits.length >= 8;          // ajusta a 10 si quieres exigir 10 dígitos
  const addressOk = address.trim().length >= 5;
  const passOk = password.length >= 6 && password === confirm;
  const nameOk = name.trim().length >= 2;
  const lastOk = lastName.trim().length >= 2;

  const s = strength(password);
  const valid = nameOk && lastOk && emailOk && phoneOk && addressOk && passOk && accept;

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(""); setOk(false);
    try {
      await auth.register({
        name,
        lastName,
        email,
        password,
        role,
        documentType: docType,
        address,
        phone: phoneDigits
      });
      setOk(true);
      notify?.("ok", "Se ha registrado exitosamente");
      setTimeout(() => onDone?.(), 900);
    } catch (err) {
      setError(err.message || "No se pudo crear el usuario");
      notify?.("error", err.message || "No se pudo crear el usuario");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-[320px,1fr] bg-gray-50">
      <aside className="bg-violet-700 text-white p-6 md:p-8 flex flex-col">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 font-bold">PZ</span>
          <span className="text-xl font-semibold tracking-tight">PetziGo</span>
        </div>
        <div className="mt-auto pt-8 text-xs opacity-80">© {new Date().getFullYear()} PetziGo</div>
      </aside>

      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-2xl">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Crear cuenta</h1>
            <p className="mt-2 text-gray-600">Regístrate para gestionar tus servicios y reservas.</p>
          </div>

          <div className="rounded-2xl bg-white shadow border p-6">
            <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input name="name" label="Nombre" value={name} onChange={setName}
                     placeholder="Ej: Erika" required className={!nameOk && name ? "border-rose-400" : ""}/>
              <Input label="Apellido" value={lastName} onChange={setLastName}
                     placeholder="Ej: Rico" required className={!lastOk && lastName ? "border-rose-400" : ""}/>

              <Input label="Email" type="email" value={email} onChange={setEmail}
                     placeholder="tucorreo@ejemplo.com" autoComplete="email" required
                     className={email && !emailOk ? "border-rose-400" : ""}/>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">Tipo de documento</span>
                <select
                  value={docType}
                  onChange={(e)=>setDocType(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="CC">Cédula de ciudadanía (CC)</option>
                  <option value="CE">Cédula de extranjería (CE)</option>
                  <option value="PA">Pasaporte (PA)</option>
                  <option value="NIT">NIT</option>
                </select>
              </label>

              <Input label="Dirección" value={address} onChange={setAddress}
                     placeholder="Calle 123 #45-67" required
                     className={!addressOk && address ? "border-rose-400" : ""}/>
              <Input label="Celular" value={phone}
                     onChange={(v)=>setPhone(v.replace(/[^0-9+ ]/g,''))}
                     placeholder="3001234567" required
                     className={!phoneOk && phone ? "border-rose-400" : ""}/>

              {/* Contraseña */}
              <div className="md:col-span-1">
                <Input
                  label="Contraseña"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                  required
                  right={<button type="button" onClick={()=>setShowPw(v=>!v)}
                         className="text-xs rounded-lg bg-gray-100 px-2 py-1 hover:bg-gray-200">
                         {showPw ? "Ocultar" : "Mostrar"}</button>}
                />
                <div className="mt-2 h-2 w-full rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full ${s.color}`} style={{ width: s.width }} />
                </div>
                <p className="mt-1 text-xs text-gray-500">Seguridad: {s.label}</p>
              </div>

              <div className="md:col-span-1">
                <Input
                  label="Confirmar contraseña"
                  type={showPw2 ? "text" : "password"}
                  value={confirm}
                  onChange={setConfirm}
                  placeholder="Repite tu contraseña"
                  autoComplete="new-password"
                  required
                  className={confirm && confirm !== password ? "border-rose-400" : ""}
                  right={<button type="button" onClick={()=>setShowPw2(v=>!v)}
                         className="text-xs rounded-lg bg-gray-100 px-2 py-1 hover:bg-gray-200">
                         {showPw2 ? "Ocultar" : "Mostrar"}</button>}
                />
                {confirm && confirm !== password && (
                  <p className="mt-1 text-xs text-rose-600">Las contraseñas no coinciden.</p>
                )}
              </div>

              {/* Rol */}
              <div className="md:col-span-2">
                <span className="text-sm font-medium text-gray-700">Rol</span>
                <div className="mt-2 inline-flex rounded-xl border bg-gray-50 p-1">
                  {[
                    { id: "USER", label: "Usuario" },
                    { id: "PROVIDER", label: "Proveedor" },
                  ].map((r) => (
                    <button
                      type="button"
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`px-4 py-2 text-sm rounded-lg ${role===r.id ? "bg-white shadow font-semibold" : "text-gray-700 hover:bg-white/70"}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Términos */}
              <div className="md:col-span-2 flex items-center gap-2">
                <input id="accept" type="checkbox" checked={accept} onChange={(e)=>setAccept(e.target.checked)}
                       className="h-4 w-4 rounded border-gray-300" />
                <label htmlFor="accept" className="text-sm text-gray-700">Acepto los términos y condiciones</label>
              </div>

              {/* Mensajes */}
              {error && <div className="md:col-span-2"><p className="text-sm text-rose-600">{error}</p></div>}
              {ok &&    <div className="md:col-span-2"><p className="text-sm text-emerald-600">Se ha registrado exitosamente</p></div>}

              {/* Botones */}
              <div className="md:col-span-2 flex flex-col sm:flex-row gap-3 pt-2">
                <button type="submit" disabled={!valid || loading}
                        className="flex-1 rounded-xl bg-violet-700 px-4 py-2.5 font-semibold text-white hover:bg-violet-800 disabled:opacity-50">
                  {loading ? "Creando cuenta…" : "Crear cuenta"}
                </button>
                <button type="button" onClick={goLogin}
                        className="rounded-xl bg-gray-100 px-4 py-2.5 font-semibold text-gray-800 hover:bg-gray-200">
                  Ya tengo cuenta
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ========= Auth hook ========= */
function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);

  const login = async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    localStorage.setItem("token", data.token);
    setToken(data.token);
    return data;
  };

  const register = async (payload) => {
    return api("/auth/register", { method: "POST", body: payload });
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
  };

  const fetchMe = async () => {
    if (!token) return;
    try {
      const me = await api("/users/me", { token });
      setUser(me);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return { token, user, login, register, logout, refresh: fetchMe };
}

/* ========= Login full-screen ========= */
function LoginScreen({ auth, onDone, goRegister, notify }) {
  const [email, setEmail] = useState(localStorage.getItem("remember_email") || "");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(!!localStorage.getItem("remember_email"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const el = document.querySelector('input[type="email"]');
    if (el) el.focus();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await auth.login(email, password);
      if (remember) localStorage.setItem("remember_email", email);
      else localStorage.removeItem("remember_email");
      notify?.("ok", "¡Bienvenido!");
      onDone?.();
    } catch (err) {
      setError(err.message || "Error al ingresar");
      notify?.("error", err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-[320px,1fr] bg-gray-50">
      {/* Sidebar */}
      <aside className="bg-violet-700 text-white p-6 md:p-8 flex flex-col">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 font-bold">
            PZ
          </span>
          <span className="text-xl font-semibold tracking-tight">PetziGo</span>
        </div>
        <div className="mt-auto pt-8 text-xs opacity-80">© {new Date().getFullYear()} PetziGo</div>
      </aside>

      {/* Panel */}
      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
              Hola, bienvenido
            </h1>
            <p className="mt-2 text-gray-600">Ingresa con tu cuenta para gestionar tus servicios.</p>
          </div>

          <div className="rounded-2xl bg-white shadow border p-6 space-y-4">
            <form onSubmit={submit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
                required
              />
              <Input
                label="Contraseña"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={setPassword}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                required
                right={
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="text-xs rounded-lg bg-gray-100 px-2 py-1 hover:bg-gray-200"
                  >
                    {showPw ? "Ocultar" : "Mostrar"}
                  </button>
                }
              />

              <div className="flex items-center justify-between text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  Recordar correo
                </label>
              </div>

              {error && <p className="text-sm text-rose-600">{error}</p>}

              <button
                disabled={loading}
                className="w-full rounded-xl bg-violet-700 px-4 py-2.5 font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {loading ? "Ingresando…" : "Entrar"}
              </button>
            </form>

            <div className="flex items-center justify-between text-sm pt-2">
              <button type="button" onClick={goRegister} className="text-violet-700 hover:underline">
                ¿No tienes cuenta? Crear cuenta
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ========= Resto de secciones (home, dashboard, services) ========= */
function HomeCard() {
  return (
    <Card title="Bienvenido a PetziGo" footer={<span>Versión UI con guardias de autenticación.</span>}>
      <p className="text-gray-700">Regístrate o inicia sesión para acceder al Dashboard y Servicios.</p>
    </Card>
  );
}

function Dashboard({ auth }) {
  const [me, setMe] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const data = await api("/users/me", { token: auth.token });
        setMe(data);
      } catch (e) {
        setError(e.message);
      }
    };
    if (auth.token) load();
  }, [auth.token]);

  if (!auth.token)
    return (
      <Card title="Dashboard">
        <p className="text-gray-600">Debes iniciar sesión para ver esta sección.</p>
      </Card>
    );

  return (
    <Card title="Dashboard">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {me ? (
        <div className="space-y-2">
          <p><span className="font-medium">Nombre:</span> {me.name} {me.lastName ? ` ${me.lastName}` : ""}</p>
          <p><span className="font-medium">Email:</span> {me.email}</p>
          <p><span className="font-medium">Rol:</span> {me.role}</p>
          {me.documentType && <p><span className="font-medium">Documento:</span> {me.documentType}</p>}
          {me.address && <p><span className="font-medium">Dirección:</span> {me.address}</p>}
          {me.phone && <p><span className="font-medium">Celular:</span> {me.phone}</p>}
          <div className="flex gap-2 pt-2">
            <button onClick={() => auth.refresh()} className="rounded-xl bg-gray-100 px-3 py-2 hover:bg-gray-200">Refrescar</button>
          </div>
        </div>
      ) : (
        <p className="text-gray-600">Cargando…</p>
      )}
    </Card>
  );
}

function Services({ auth }) {
  const [list, setList] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("0");
  const [error, setError] = useState("");

  const isProvider = auth.user?.role === "PROVIDER" || auth.user?.role === "ADMIN";

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const data = await api("/services", auth.token ? { token: auth.token } : {});
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      }
    };
    if (auth.token) load();
  }, [auth.token]);

  if (!auth.token)
    return (
      <Card title="Servicios">
        <p className="text-gray-600">Debes iniciar sesión para ver y crear servicios.</p>
      </Card>
    );

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api("/services", { method: "POST", token: auth.token, body: { title, description, price: Number(price) } });
      setTitle("");
      setDescription("");
      setPrice("0");
      const data = await api("/services", { token: auth.token });
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <Card title="Servicios">
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <ul className="divide-y">
        {list.map((s) => (
          <li key={s.id} className="py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-gray-600">{s.description}</p>
              </div>
              <span className="rounded-lg bg-gray-100 px-2 py-1 text-sm">${s.price}</span>
            </div>
          </li>
        ))}
        {list.length === 0 && <p className="py-2 text-gray-600">No hay servicios.</p>}
      </ul>

      {isProvider ? (
        <form onSubmit={create} className="mt-4 grid gap-3">
          <p className="text-sm font-medium text-gray-700">Crear servicio (requiere rol PROVIDER)</p>
          <Input label="Título" value={title} onChange={setTitle} required />
          <Input label="Descripción" value={description} onChange={setDescription} required />
          <Input label="Precio" type="number" value={price} onChange={setPrice} required />
          <button className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">Guardar</button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-gray-600">
          Inicia sesión con rol <span className="font-semibold">PROVIDER</span> para crear servicios.
        </p>
      )}
    </Card>
  );
}

/* ========= App principal ========= */
export default function PetziGoUI() {
  const auth = useAuth();
  const [tab, setTab] = useState("login");
  const [toast, setToast] = useState(null);
  const notify = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 2200);
  };

  // Guardia: si no hay token, forzar login en pestañas protegidas
  useEffect(() => {
    if (!auth.token && (tab === "dashboard" || tab === "services")) setTab("login");
  }, [auth.token, tab]);

  const navItems = useMemo(() => {
    const items = [
      { id: "home", label: "Inicio" },
      { id: "register", label: "Registro" },
      { id: "login", label: "Ingresar" },
    ];
    if (auth.token) items.push({ id: "dashboard", label: "Dashboard" }, { id: "services", label: "Servicios" });
    return items;
  }, [auth.token]);

  // Pantallas full-screen
  if (tab === "login") {
    return (
      <>
        <LoginScreen auth={auth} onDone={() => setTab("dashboard")} goRegister={() => setTab("register")} notify={notify} />
        <Toast toast={toast} />
      </>
    );
  }
  if (tab === "register") {
    return (
      <>
        <RegisterScreen auth={auth} onDone={() => setTab("login")} goLogin={() => setTab("login")} notify={notify} />
        <Toast toast={toast} />
      </>
    );
  }

  // Layout normal
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-10 border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-indigo-600 font-bold text-white">
              PZ
            </span>
            <h1 className="text-xl font-semibold">PetziGo</h1>
          </div>
          <nav className="flex items-center gap-2">
            {navItems.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium ${
                  tab === t.id ? "bg-indigo-600 text-white" : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
            {auth.token && (
              <button
                onClick={() => {
                  auth.logout();
                  setTab("login");
                }}
                className="ml-2 rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
              >
                Salir
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 p-4 md:grid-cols-2">
        {tab === "home" && <HomeCard />}
        {tab === "dashboard" && <Dashboard auth={auth} />}
        {tab === "services" && <Services auth={auth} />}
      </main>

      <Toast toast={toast} />
    </div>
  );
}
