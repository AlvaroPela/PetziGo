import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth/AuthProvider"; // ruta según tu proyecto
import { api } from "./lib/api";

function Input({ label, type = "text", value, onChange, placeholder, required, autoComplete }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select
        className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }) {
  const label = STATUS_LABELS[status] || status;
  const style = STATUS_STYLES[status] || "bg-slate-100 text-slate-700";
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{label}</span>;
}

function Card({ title, description, actions, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-sm text-slate-500">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function useCart() {
  const [items, setItems] = useState(() => {
    try {
      const stored = localStorage.getItem("petzigo_cart");
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error(err);
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("petzigo_cart", JSON.stringify(items));
  }, [items]);

  const addItem = (item) => {
    setItems((current) => {
      const existing = current.find((row) => row.type === item.type && row.id === item.id);
      if (existing) {
        return current.map((row) =>
          row.type === item.type && row.id === item.id
            ? { ...row, quantity: row.quantity + item.quantity }
            : row
        );
      }
      return [...current, item];
    });
  };

  const updateQuantity = (itemType, itemId, quantity) => {
    setItems((current) => {
      if (quantity <= 0) {
        return current.filter((row) => !(row.type === itemType && row.id === itemId));
      }
      return current.map((row) =>
        row.type === itemType && row.id === itemId
          ? { ...row, quantity }
          : row
      );
    });
  };

  // devolver solo la API del carrito (antes había código sobrante que devolvía auth)
  return { items, addItem, updateQuantity, setItems };
}

export default function PetziGoUI() {
  const auth = useAuth();
  const [tab, setTab] = useState(() => (auth.token ? "dashboard" : "login"));

  // Añadir navItems para que {navItems.map((t) => (...))} funcione
  const navItems = useMemo(() => {
    const items = [
      { id: "home", label: "Inicio" },
      { id: "register", label: "Registro" },
      { id: "login", label: "Ingresar" },
    ];
    if (auth.token) {
      items.push(
        { id: "dashboard", label: "Dashboard" },
        { id: "services", label: "Servicios" }
      );
    }
    return items;
  }, [auth.token]);

  // Esperar a que el provider valide el token antes de forzar pestañas
  useEffect(() => {
    if (auth.loading) return;

    if (!auth.token && (tab === "dashboard" || tab === "services")) {
      setTab("login");
    } else if (auth.token && (tab === "login" || tab === "register")) {
      setTab("dashboard");
    }
  }, [auth.token, auth.loading, tab]);  

  useEffect(() => {
    if (!auth.token && (tab === "dashboard" || tab === "services")) {
      setTab("login");
    }
  }, [auth.token, tab]);

  // Mientras validamos token, mostramos una pantalla de carga (evita redirecciones prematuras)
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="rounded-lg bg-white p-6 shadow">Validando sesión…</div>
      </div>
    );
  }

  // 👉 si estamos en login, usamos la pantalla full-screen
  if (tab === "login") {
    return (
      <LoginScreen
        auth={auth}
        onDone={() => setTab("dashboard")}
        goRegister={() => setTab("register")}
      />
    );
  }  

  // 👉 resto de pestañas mantienen tu layout con header
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
                  tab === t.id
                    ? "bg-indigo-600 text-white"
                    : "text-gray-700 hover:bg-gray-100"
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
        {tab === "register" && (
          <RegisterCard auth={auth} onDone={() => setTab("login")} />
        )}
        {tab === "dashboard" && <Dashboard auth={auth} />}
        {tab === "services" && <Services auth={auth} />}
      </main>
    </div>
  );
}


function HomeCard() {
  return (
    <Card title="Bienvenido a PetziGo" footer={<span>Versión UI mejorada con guardias de autenticación.</span>}>
      <p className="text-gray-700">
        Regístrate o inicia sesión para acceder al Dashboard y Servicios.
      </p>
    </Card>
  );
}

function RegisterCard({ auth, onDone, notify }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const valid = useMemo(() => {
    const emailOk = /.+@.+\..+/.test(email);
    const pwOk = password.length >= 6;
    return name && emailOk && pwOk;
  }, [name, email, password]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(""); setOk(false);
    try {
      await auth.register({ name, email, password, role });

      // ✅ Mensaje de éxito
      setOk(true);
      // (Opcional) toast global si has pasado notify desde PetziGoUI
      notify?.("ok", "Se ha registrado exitosamente");

      // Ir al login (como ya hacías)
      onDone?.();
    } catch (err) {
      setError(err.message || "No se pudo crear el usuario");
      notify?.("error", err.message || "No se pudo crear el usuario");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Registro de usuario">
      <form onSubmit={submit} className="space-y-3">
        <Input label="Nombre" value={name} onChange={setName} placeholder="Ej: Erika Rico" required />
        <Input label="Email" value={email} onChange={setEmail} placeholder="tucorreo@ejemplo.com" type="email" required autoComplete="email" />
        <Input label="Contraseña" value={password} onChange={setPassword} placeholder="Mínimo 6 caracteres" type="password" required autoComplete="new-password" />
        <Select
          label="Rol"
          value={role}
          onChange={setRole}
          options={[
            { value: "USER", label: "Usuario" },
            { value: "PROVIDER", label: "Proveedor" },
          ]}
        />

        {/* ❌ Error si algo falla */}
        {error && <p className="text-sm text-rose-600">{error}</p>}

        {/* ✅ Éxito con el texto solicitado */}
        {ok && <p className="text-sm text-emerald-600">Se ha registrado exitosamente</p>}

        <button
          disabled={!valid || loading}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {loading ? "Registrando…" : "Crear cuenta"}
        </button>
      </form>
   </Card>
 );
}


function LoginScreen({ auth, onDone, goRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await auth.login(email, password);
      onDone?.();
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid md:grid-cols-[320px,1fr] bg-gray-50">
      {/* Barra lateral marca */}
      <aside className="bg-violet-700 text-white p-6 md:p-8 flex flex-col">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 font-bold">
            PZ
          </span>
          <span className="text-xl font-semibold tracking-tight">PetziGo</span>
        </div>

        <nav className="mt-10 space-y-3 text-violet-100/90">
          <div className="font-medium">Panel</div>
          <div className="opacity-80">Servicios</div>
          <div className="opacity-80">Productos</div>
        </nav>

        <div className="mt-auto pt-8 text-xs opacity-80">
          © {new Date().getFullYear()} PetziGo
        </div>
      </aside>

      {/* Panel derecho: Login */}
      <section className="flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-md">
          {/* Hero / bienvenida */}
          <div className="mb-6">
            <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">
              Hola, bienvenido
            </h1>
            <p className="mt-2 text-gray-600">
              Ingresa con tu cuenta para gestionar tus servicios.
            </p>
          </div>

          {/* Tarjeta de login */}
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
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Tu contraseña"
                autoComplete="current-password"
                required
              />
              {error && <p className="text-sm text-rose-600">{error}</p>}

              <button
                disabled={loading}
                className="w-full rounded-xl bg-violet-700 px-4 py-2.5 font-semibold text-white hover:bg-violet-800 disabled:opacity-50"
              >
                {loading ? "Ingresando…" : "Entrar"}
              </button>
            </form>

            <div className="flex items-center justify-between text-sm pt-2">
              <button
                type="button"
                onClick={goRegister}
                className="text-violet-700 hover:underline"
              >
                ¿No tienes cuenta? Crear cuenta
              </button>
              {/* opcional: enlace recuperar */}
              {/* <button className="text-gray-600 hover:underline">Olvidé mi contraseña</button> */}
            </div>
          </div>

          {/* Chips / destacados (opcional, estilo de la maqueta) */}
          <div className="mt-6">
            <h2 className="text-base font-semibold text-gray-900">
              Servicios destacados
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-xl bg-emerald-100 px-3 py-1.5 text-sm text-emerald-900">
                <span className="text-lg">🐾</span> Consulta veterinaria
              </span>
              <span className="inline-flex items-center gap-2 rounded-xl bg-indigo-100 px-3 py-1.5 text-sm text-indigo-900">
                <span className="text-lg">🐾</span> Paseo canino
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
   );
}


function Dashboard() {
  const { user, token, refresh } = useAuth();
  const [me, setMe] = useState(user || null);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        // 1) obtener el "me" (si no viene del contexto, pedir refresh que devuelve el usuario)
        const meRes = user || (await refresh()); // refresh() devuelve la info o null
        if (mounted) setMe(meRes);

        // 2) obtener órdenes (usa token; api() también toma token de localStorage si no se pasa)
        if (!token) {
          throw new Error("No autenticado");
        }
        const data = await api("/orders", { token });
        if (mounted) setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Dashboard load error:", err);
        if (mounted) setError(err.message || "Error cargando datos");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (token) load();
    else {
      setMe(null);
      setOrders([]);
    }

    return () => { mounted = false; };
  }, [token, user, refresh]);

  if (!token) return (
    <Card title="Dashboard">
      <p className="text-gray-600">Debes iniciar sesión para ver esta sección.</p>
    </Card>
  );

  return (
    <Card title="Dashboard">
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? <p>Cargando…</p> : (
        me ? (
          <div className="space-y-2">
            <p><span className="font-medium">Nombre:</span> {me.name}</p>
            <p><span className="font-medium">Email:</span> {me.email}</p>
            <p><span className="font-medium">Rol:</span> {me.role}</p>
            <div className="flex gap-2 pt-2">
              <button onClick={() => refresh()} className="rounded-xl bg-gray-100 px-3 py-2 hover:bg-gray-200">Refrescar</button>
            </div>

            {/* ejemplo simple para mostrar órdenes */}
            <div className="pt-4">
              <h3 className="font-semibold">Órdenes</h3>
              {orders.length === 0 ? <p className="text-gray-600">No hay órdenes.</p> :
                <ul className="mt-2 space-y-2">
                  {orders.map(o => <li key={o.id} className="text-sm">#{o.id} — {o.status}</li>)}
                </ul>
              }
            </div>
          </div>
        ) : <p className="text-gray-600">Cargando usuario…</p>
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

  useEffect(() => {
    const loadServices = async () => {
      setError("");
      try {
        const data = await api("/services", auth.token ? { token: auth.token } : {});
        setList(Array.isArray(data) ? data : []);
      } catch (e) {
        setError(e.message);
      }
    };
    if (auth.token) loadServices();
  }, [auth.token]);

  if (!auth.token) return (
    <Card title="Servicios">
      <p className="text-gray-600">Debes iniciar sesión para ver y crear servicios.</p>
    </Card>
  );

  const createService = async (e) => {
    e?.preventDefault?.();
    setError("");
    try {
      await api("/services", { method: "POST", token: auth.token, body: { title, description, price: Number(price) } });
      setTitle(""); setDescription(""); setPrice("0");
      const data = await api("/services", { token: auth.token });
      setList(Array.isArray(data) ? data : []);
    } catch (e) { setError(e.message); }
  };

  return (
    <Card title="Servicios">
      {error && <p className="text-sm text-red-600">{error}</p>}
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

      <form onSubmit={createService} className="mt-4 grid gap-3">
        <p className="text-sm font-medium text-gray-700">Crear servicio (requiere rol PROVIDER)</p>
        <Input label="Título" value={title} onChange={setTitle} required />
        <Input label="Descripción" value={description} onChange={setDescription} required />
        <Input label="Precio" type="number" value={price} onChange={setPrice} required />
        <button className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white">Guardar</button>
      </form>
    </Card>
  );
}