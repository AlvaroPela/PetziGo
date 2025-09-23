
import React, { useEffect, useMemo, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000/api";

async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message = data?.message || data?.error || `HTTP ${res.status}`;
    throw new Error(message);
  }

  return data;
}

const ROLE_LABELS = {
  USER: "Comprador",
  PROVIDER: "Proveedor",
  ADMIN: "Administrador"
};

const STATUS_LABELS = {
  PENDING: "Pendiente",
  IN_PROCESS: "En proceso",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado"
};

const STATUS_STYLES = {
  PENDING: "bg-amber-100 text-amber-800",
  IN_PROCESS: "bg-sky-100 text-sky-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800"
};

const ORDER_STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));

const ITEM_TYPE_LABELS = {
  PRODUCT: "Producto",
  SERVICE: "Servicio"
};

function Input({ label, type = "text", value, onChange, placeholder, required, autoComplete }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </label>
  );
}

function Select({ label, value, onChange, options, placeholder }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
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
function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);

  const fetchMe = async (overrideToken) => {
    const activeToken = overrideToken ?? token;
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const me = await api("/users/me", { token: activeToken });
      setUser(me);
    } catch (err) {
      console.error(err);
      localStorage.removeItem("token");
      setToken("");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchMe(token);
    } else {
      setUser(null);
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const login = async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    localStorage.setItem("token", data.token);
    setToken(data.token);
    await fetchMe(data.token);
    return data;
  };

  const register = (payload) => api("/auth/register", { method: "POST", body: payload });

  const logout = () => {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
  };

  return { token, user, loading, login, register, logout, refresh: fetchMe };
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

  const removeItem = (itemType, itemId) => {
    setItems((current) => current.filter((row) => !(row.type === itemType && row.id === itemId)));
  };

  const clear = () => setItems([]);

  return { items, addItem, updateQuantity, removeItem, clear };
}

function LoadingState({ message = "Cargando" }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50">
      <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <p className="text-sm font-medium text-slate-600">{message}...</p>
      </div>
    </div>
  );
}

function ErrorMessage({ error }) {
  if (!error) return null;
  return <p className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700">{error}</p>;
}

function SuccessMessage({ message }) {
  if (!message) return null;
  return <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-700">{message}</p>;
}
export default function PetziGoUI() {
  const auth = useAuth();
  const cart = useCart();
  const [tab, setTab] = useState(auth.token ? "loading" : "login");

  const isLogged = Boolean(auth.token);
  const role = auth.user?.role;

  const navItems = useMemo(() => {
    if (!isLogged) {
      return [
        { id: "login", label: "Ingresar" },
        { id: "register", label: "Crear cuenta" }
      ];
    }
    if (role === "USER") {
      return [
        { id: "catalog", label: "Catalogo" },
        { id: "cart", label: "Carrito" },
        { id: "orders", label: "Pedidos" },
        { id: "profile", label: "Mis datos" }
      ];
    }
    if (role === "PROVIDER") {
      return [
        { id: "overview", label: "Resumen" },
        { id: "products", label: "Productos" },
        { id: "services", label: "Servicios" },
        { id: "orders", label: "Pedidos" },
        { id: "documents", label: "Documentos" }
      ];
    }
    if (role === "ADMIN") {
      return [
        { id: "dashboard", label: "Dashboard" },
        { id: "users", label: "Usuarios" },
        { id: "pending", label: "Pendientes" },
        { id: "orders", label: "Pedidos" },
        { id: "reviews", label: "Resenas" }
      ];
    }
    return [];
  }, [isLogged, role]);

  useEffect(() => {
    if (!isLogged) {
      if (tab !== "login" && tab !== "register") {
        setTab("login");
      }
      return;
    }
    if (auth.loading || !role) {
      setTab("loading");
      return;
    }
    const validTabs = navItems.map((item) => item.id);
    if (!validTabs.includes(tab)) {
      setTab(validTabs[0] || "loading");
    }
  }, [isLogged, auth.loading, role, navItems, tab]);

  if (!isLogged) {
    return (
      <AuthScreens
        tab={tab}
        setTab={setTab}
        auth={auth}
      />
    );
  }

  if (auth.loading || !auth.user || tab === "loading") {
    return <LoadingState />;
  }

  const headerTitle = ROLE_LABELS[role] ? `${ROLE_LABELS[role]}: ${auth.user.name}` : auth.user.name;

  let content = null;

  if (role === "USER") {
    if (tab === "catalog") content = <BuyerCatalog auth={auth} cart={cart} />;
    if (tab === "cart") content = <BuyerCart auth={auth} cart={cart} />;
    if (tab === "orders") content = <OrdersPanel auth={auth} scope="buyer" title="Mis pedidos" />;
    if (tab === "profile") content = <ProfileEditor auth={auth} />;
  } else if (role === "PROVIDER") {
    if (tab === "overview") content = <ProviderOverview auth={auth} />;
    if (tab === "products") content = <ProviderProductsManager auth={auth} />;
    if (tab === "services") content = <ProviderServicesManager auth={auth} />;
    if (tab === "orders") content = <OrdersPanel auth={auth} scope="provider" title="Pedidos recibidos" canUpdateStatus />;
    if (tab === "documents") content = <ProviderDocumentsPanel auth={auth} />;
  } else if (role === "ADMIN") {
    if (tab === "dashboard") content = <AdminDashboardPanel auth={auth} />;
    if (tab === "users") content = <AdminUsersPanel auth={auth} />;
    if (tab === "pending") content = <AdminPendingPanel auth={auth} />;
    if (tab === "orders") content = <OrdersPanel auth={auth} scope="admin" title="Pedidos" canUpdateStatus />;
    if (tab === "reviews") content = <AdminReviewsPanel auth={auth} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-bold text-white">
              PZ
            </span>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">PetziGo</p>
              <h1 className="text-sm font-semibold text-slate-900">{headerTitle}</h1>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                  tab === item.id
                    ? "bg-indigo-600 text-white shadow"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={() => {
                auth.logout();
                setTab("login");
              }}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        {content}
      </main>
    </div>
  );
}
function AuthScreens({ tab, setTab, auth }) {
  const [success, setSuccess] = useState("");

  if (tab === "register") {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-4xl px-4 py-10">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">Crear cuenta</h1>
              <p className="text-sm text-slate-500">Registra tu perfil como comprador o proveedor.</p>
            </div>
            <button
              onClick={() => setTab("login")}
              className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              Ya tengo cuenta
            </button>
          </div>
          <RegisterForm auth={auth} onSuccess={(msg) => { setSuccess(msg); setTab("login"); }} />
          <SuccessMessage message={success} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-50 md:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-indigo-700 p-10 text-indigo-50 md:flex">
        <div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-bold">PZ</span>
          <h2 className="mt-6 text-2xl font-semibold">Gestiona tus servicios y productos</h2>
          <p className="mt-3 text-sm text-indigo-100">Centraliza pedidos, documentos y catalogos en una sola plataforma.</p>
        </div>
        <p className="text-xs text-indigo-200">{new Date().getFullYear()} PetziGo</p>
      </aside>
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md space-y-6">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Hola de nuevo</h1>
            <p className="text-sm text-slate-500">Ingresa para administrar tu cuenta.</p>
          </div>
          <LoginForm auth={auth} onGoRegister={() => setTab("register")} />
        </div>
      </section>
    </div>
  );
}

function LoginForm({ auth, onGoRegister }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await auth.login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Ingresar" description="Accede con tu correo y contrasena">
      <form onSubmit={submit} className="space-y-4">
        <Input label="Correo" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Input label="Contrasena" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />
        <ErrorMessage error={error} />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Ingresando..." : "Entrar"}
        </button>
      </form>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>No tienes cuenta?</span>
        <button onClick={onGoRegister} className="font-semibold text-indigo-600 hover:underline">Crear cuenta</button>
      </div>
    </Card>
  );
}
function RegisterForm({ auth, onSuccess }) {
  const [userType, setUserType] = useState("USER");
  const [fullName, setFullName] = useState("");
  const [legalRepresentative, setLegalRepresentative] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isProvider = userType === "PROVIDER";
  const passwordMatch = password && confirmPassword && password === confirmPassword;

  const canSubmit = () => {
    if (!email || !phone || !address || !password || !confirmPassword || !passwordMatch) return false;
    if (isProvider) {
      return legalRepresentative && companyName && taxId;
    }
    return fullName.length > 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        role: userType,
        email,
        phone,
        address,
        password,
        confirmPassword,
        name: isProvider ? undefined : fullName,
        legalRepresentative: isProvider ? legalRepresentative : undefined,
        companyName: isProvider ? companyName : undefined,
        taxId: isProvider ? taxId : undefined
      };
      await auth.register(payload);
      onSuccess?.("Cuenta creada, inicia sesion");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Registro" description="Completa la informacion segun tu tipo de usuario">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Select
            label="Tipo de usuario"
            value={userType}
            onChange={setUserType}
            options={[
              { value: "USER", label: "Comprador" },
              { value: "PROVIDER", label: "Proveedor" }
            ]}
          />
        </div>
        {!isProvider && (
          <Input label="Nombre completo" value={fullName} onChange={setFullName} required placeholder="Ej: Ana Torres" />
        )}
        {isProvider && (
          <>
            <Input label="Representante legal" value={legalRepresentative} onChange={setLegalRepresentative} required placeholder="Nombre completo" />
            <Input label="Razon social" value={companyName} onChange={setCompanyName} required placeholder="Nombre de la empresa" />
            <Input label="NIT" value={taxId} onChange={setTaxId} required placeholder="900000000-0" />
          </>
        )}
        <Input label="Correo" type="email" value={email} onChange={setEmail} required autoComplete="email" />
        <Input label="Telefono" value={phone} onChange={setPhone} required placeholder="Celular o fijo" />
        <div className="md:col-span-2">
          <Input label="Direccion" value={address} onChange={setAddress} required placeholder="Calle, numero y ciudad" />
        </div>
        <Input label="Contrasena" type="password" value={password} onChange={setPassword} required autoComplete="new-password" />
        <Input label="Confirmar contrasena" type="password" value={confirmPassword} onChange={setConfirmPassword} required autoComplete="new-password" />
        <div className="md:col-span-2 text-sm text-slate-500">
          {!passwordMatch && confirmPassword && <span className="text-rose-600">Las contrasenas no coinciden.</span>}
          {password.length > 0 && password.length < 6 && <span className="text-amber-600">La contrasena debe tener minimo 6 caracteres.</span>}
        </div>
        <div className="md:col-span-2">
          <ErrorMessage error={error} />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={!canSubmit() || loading}
            className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Registrando..." : "Crear cuenta"}
          </button>
        </div>
      </form>
    </Card>
  );
}
function BuyerCatalog({ auth, cart }) {
  const [products, setProducts] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [productsData, servicesData] = await Promise.all([
          api("/products"),
          api("/services")
        ]);
        setProducts(Array.isArray(productsData) ? productsData : []);
        setServices(Array.isArray(servicesData) ? servicesData : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const addProduct = (item, type) => {
    cart.addItem({
      type,
      id: item.id,
      name: type === "PRODUCT" ? item.name : item.title,
      description: item.description,
      price: Number(item.price || 0),
      quantity: 1
    });
  };

  return (
    <div className="space-y-6">
      <Card title="Catalogo" description="Explora productos y servicios disponibles">
        <ErrorMessage error={error} />
        {loading ? (
          <p className="text-sm text-slate-500">Cargando catalogo...</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Productos</h3>
              <div className="space-y-4">
                {products.length === 0 && <p className="text-sm text-slate-500">No hay productos disponibles.</p>}
                {products.map((product) => (
                  <div key={`product-${product.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{product.name}</h4>
                        <p className="text-sm text-slate-500">{product.description}</p>
                        <p className="mt-1 text-sm text-slate-600">Proveedor: {product.companyName || product.providerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-indigo-600">${Number(product.price).toFixed(2)}</p>
                        <button
                          onClick={() => addProduct(product, "PRODUCT")}
                          className="mt-2 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Agregar al carrito
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Servicios</h3>
              <div className="space-y-4">
                {services.length === 0 && <p className="text-sm text-slate-500">No hay servicios disponibles.</p>}
                {services.map((service) => (
                  <div key={`service-${service.id}`} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900">{service.title}</h4>
                        <p className="text-sm text-slate-500">{service.description}</p>
                        <p className="mt-1 text-sm text-slate-600">Proveedor: {service.companyName || service.providerName}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-indigo-600">${Number(service.price).toFixed(2)}</p>
                        <button
                          onClick={() => addProduct(service, "SERVICE")}
                          className="mt-2 rounded-lg bg-indigo-600 px-3 py-1 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Agregar al carrito
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </Card>
    </div>
  );
}
function BuyerCart({ auth, cart }) {
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const total = cart.items.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const checkout = async () => {
    if (cart.items.length === 0) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      for (const item of cart.items) {
        await api("/orders", {
          method: "POST",
          token: auth.token,
          body: {
            itemType: item.type,
            itemId: item.id,
            quantity: item.quantity
          }
        });
      }
      cart.clear();
      setSuccess("Pedidos enviados correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Carrito" description="Gestiona tus pedidos antes de confirmar">
      <ErrorMessage error={error} />
      <SuccessMessage message={success} />
      {cart.items.length === 0 ? (
        <p className="text-sm text-slate-500">Tu carrito esta vacio.</p>
      ) : (
        <div className="space-y-4">
          {cart.items.map((item) => (
            <div key={`${item.type}-${item.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.name}</p>
                <p className="text-xs text-slate-500">{ITEM_TYPE_LABELS[item.type]}  -  ${item.price.toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => cart.updateQuantity(item.type, item.id, item.quantity - 1)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  -
                </button>
                <span className="text-sm font-medium">{item.quantity}</span>
                <button
                  onClick={() => cart.updateQuantity(item.type, item.id, item.quantity + 1)}
                  className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                >
                  +
                </button>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-indigo-600">${(item.price * item.quantity).toFixed(2)}</p>
                <button
                  onClick={() => cart.removeItem(item.type, item.id)}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-sm font-semibold text-slate-700">Total</span>
            <span className="text-sm font-semibold text-indigo-600">${total.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={checkout}
              disabled={loading || cart.items.length === 0}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Confirmar pedidos"}
            </button>
            <button
              onClick={() => cart.clear()}
              disabled={loading || cart.items.length === 0}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-60"
            >
              Vaciar carrito
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function OrdersPanel({ auth, scope, title, canUpdateStatus = false }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ status: "", itemType: "", from: "", to: "" });
  const [updating, setUpdating] = useState({});

  const loadOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set("status", filters.status);
      if (filters.itemType) params.set("itemType", filters.itemType);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const query = params.toString();
      let path = "/orders/me";
      if (scope === "admin") path = "/orders";
      const data = await api(`${path}${query ? `?${query}` : ""}`, { token: auth.token });
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.itemType, filters.from, filters.to, scope]);

  const updateStatus = async (orderId, status) => {
    setUpdating((curr) => ({ ...curr, [orderId]: true }));
    try {
      await api(`/orders/${orderId}/status`, {
        method: "PATCH",
        token: auth.token,
        body: { status }
      });
      await loadOrders();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating((curr) => ({ ...curr, [orderId]: false }));
    }
  };

  return (
    <Card title={title} description="Aplica filtros por fecha y estado">
      <div className="grid gap-4 md:grid-cols-4">
        <Select
          label="Estado"
          value={filters.status}
          onChange={(value) => setFilters((curr) => ({ ...curr, status: value }))}
          options={ORDER_STATUS_OPTIONS}
          placeholder="Todos"
        />
        <Select
          label="Tipo"
          value={filters.itemType}
          onChange={(value) => setFilters((curr) => ({ ...curr, itemType: value }))}
          options={[
            { value: "PRODUCT", label: "Producto" },
            { value: "SERVICE", label: "Servicio" }
          ]}
          placeholder="Todos"
        />
        <Input
          label="Desde"
          type="date"
          value={filters.from}
          onChange={(value) => setFilters((curr) => ({ ...curr, from: value }))}
        />
        <Input
          label="Hasta"
          type="date"
          value={filters.to}
          onChange={(value) => setFilters((curr) => ({ ...curr, to: value }))}
        />
      </div>
      <ErrorMessage error={error} />
      {loading ? (
        <p className="text-sm text-slate-500">Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-slate-500">No hay pedidos que coincidan con los filtros.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-100 text-left text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Tipo</th>
                {(scope === "provider" || scope === "admin") && <th className="px-3 py-2">Comprador</th>}
                {scope === "admin" && <th className="px-3 py-2">Proveedor</th>}
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2 text-right">Cantidad</th>
                {canUpdateStatus && <th className="px-3 py-2 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {orders.map((order) => {
                const itemName = order.itemType === "PRODUCT" ? order.productName : order.serviceTitle;
                return (
                  <tr key={order.id}>
                    <td className="px-3 py-3 text-xs text-slate-500">{new Date(order.requestedAt).toLocaleString()}</td>
                    <td className="px-3 py-3 text-sm font-medium text-slate-800">{itemName || "-"}</td>
                    <td className="px-3 py-3 text-xs text-slate-500">{ITEM_TYPE_LABELS[order.itemType] || order.itemType}</td>
                    {(scope === "provider" || scope === "admin") && (
                      <td className="px-3 py-3 text-xs text-slate-500">{order.buyerName || order.buyerEmail}</td>
                    )}
                    {scope === "admin" && (
                      <td className="px-3 py-3 text-xs text-slate-500">{order.providerCompany || order.providerName}</td>
                    )}
                    <td className="px-3 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold text-slate-700">{order.quantity}</td>
                    {canUpdateStatus && (
                      <td className="px-3 py-3 text-right">
                        <select
                          value={order.status}
                          onChange={(event) => updateStatus(order.id, event.target.value)}
                          disabled={updating[order.id]}
                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
                        >
                          {ORDER_STATUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
function ProfileEditor({ auth }) {
  const { user } = auth;
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    legalRepresentative: "",
    companyName: "",
    taxId: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        phone: user.phone || "",
        address: user.address || "",
        legalRepresentative: user.legalRepresentative || "",
        companyName: user.companyName || "",
        taxId: user.taxId || ""
      });
    }
  }, [user]);

  const handleChange = (key, value) => {
    setForm((curr) => ({ ...curr, [key]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const payload = {};
      ["name", "phone", "address", "legalRepresentative", "companyName", "taxId"].forEach((key) => {
        if (form[key] !== undefined && form[key] !== user[key]) {
          payload[key] = form[key];
        }
      });
      if (Object.keys(payload).length === 0) {
        setSuccess("No hay cambios para guardar.");
      } else {
        await api("/users/me", { method: "PUT", token: auth.token, body: payload });
        setSuccess("Datos actualizados.");
        await auth.refresh(auth.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const isProvider = user.role === "PROVIDER";

  return (
    <Card title="Mis datos" description="Actualiza tu informacion de contacto">
      <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
        <Input label={isProvider ? "Razon social" : "Nombre"} value={isProvider ? form.companyName : form.name} onChange={(value) => handleChange(isProvider ? "companyName" : "name", value)} />
        <Input label="Telefono" value={form.phone} onChange={(value) => handleChange("phone", value)} />
        <div className="md:col-span-2">
          <Input label="Direccion" value={form.address} onChange={(value) => handleChange("address", value)} />
        </div>
        {isProvider && (
          <>
            <Input label="Representante legal" value={form.legalRepresentative} onChange={(value) => handleChange("legalRepresentative", value)} />
            <Input label="NIT" value={form.taxId} onChange={(value) => handleChange("taxId", value)} />
          </>
        )}
        <div className="md:col-span-2">
          <ErrorMessage error={error} />
          <SuccessMessage message={success} />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {loading ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </form>
    </Card>
  );
}

function ProviderOverview({ auth }) {
  const [metrics, setMetrics] = useState({ pending: 0, inProcess: 0, completed: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await api("/orders/me", { token: auth.token });
        if (Array.isArray(data)) {
          const counts = data.reduce((acc, order) => {
            if (order.status === "PENDING") acc.pending += 1;
            if (order.status === "IN_PROCESS") acc.inProcess += 1;
            if (order.status === "DELIVERED") acc.completed += 1;
            return acc;
          }, { pending: 0, inProcess: 0, completed: 0 });
          setMetrics(counts);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth.token]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card title="Pendientes" description="Pedidos sin gestionar">
        <p className="text-3xl font-semibold text-amber-600">{loading ? "-" : metrics.pending}</p>
      </Card>
      <Card title="En proceso" description="Pedidos en curso">
        <p className="text-3xl font-semibold text-sky-600">{loading ? "-" : metrics.inProcess}</p>
      </Card>
      <Card title="Entregados" description="Pedidos completados">
        <p className="text-3xl font-semibold text-emerald-600">{loading ? "-" : metrics.completed}</p>
      </Card>
    </div>
  );
}
function ProviderProductsManager({ auth }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", description: "", price: "", stock: "0", visible: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/products/mine", { token: auth.token });
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/products", {
        method: "POST",
        token: auth.token,
        body: {
          name: form.name,
          description: form.description,
          price: Number(form.price || 0),
          stock: Number(form.stock || 0),
          visible: form.visible
        }
      });
      setForm({ name: "", description: "", price: "", stock: "0", visible: true });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (id, visible) => {
    try {
      await api(`/products/${id}/visibility`, {
        method: "PATCH",
        token: auth.token,
        body: { visible: !visible }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Eliminar producto?")) return;
    try {
      await api(`/products/${id}`, { method: "DELETE", token: auth.token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card title="Mis productos" description="Crea y controla la visibilidad">
      <ErrorMessage error={error} />
      {loading ? (
        <p className="text-sm text-slate-500">Cargando productos...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500">Aun no has registrado productos.</p>
      ) : (
        <div className="space-y-3">
          {list.map((product) => (
            <div key={product.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{product.name}</p>
                <p className="text-xs text-slate-500">Stock: {product.stock}  -  ${Number(product.price).toFixed(2)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={product.visible ? "DELIVERED" : "CANCELLED"} />
                <button onClick={() => toggleVisibility(product.id, product.visible)} className="text-xs font-semibold text-indigo-600 hover:underline">
                  {product.visible ? "Ocultar" : "Publicar"}
                </button>
                <button onClick={() => remove(product.id)} className="text-xs font-semibold text-rose-600 hover:underline">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700">Nuevo producto</h3>
        </div>
        <Input label="Nombre" value={form.name} onChange={(value) => setForm((curr) => ({ ...curr, name: value }))} required />
        <Input label="Precio" type="number" value={form.price} onChange={(value) => setForm((curr) => ({ ...curr, price: value }))} required />
        <TextArea label="Descripcion" value={form.description} onChange={(value) => setForm((curr) => ({ ...curr, description: value }))} />
        <Input label="Stock" type="number" value={form.stock} onChange={(value) => setForm((curr) => ({ ...curr, stock: value }))} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={form.visible}
            onChange={(e) => setForm((curr) => ({ ...curr, visible: e.target.checked }))}
          />
          Visible para compradores
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar producto"}
          </button>
        </div>
      </form>
    </Card>
  );
}
function ProviderServicesManager({ auth }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", price: "", available: true, visible: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/services/mine", { token: auth.token });
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/services", {
        method: "POST",
        token: auth.token,
        body: {
          title: form.title,
          description: form.description,
          price: Number(form.price || 0),
          available: form.available,
          visible: form.visible
        }
      });
      setForm({ title: "", description: "", price: "", available: true, visible: true });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleVisibility = async (id, visible) => {
    try {
      await api(`/services/${id}/visibility`, {
        method: "PATCH",
        token: auth.token,
        body: { visible: !visible }
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Ocultar servicio?")) return;
    try {
      await api(`/services/${id}`, { method: "DELETE", token: auth.token });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Card title="Mis servicios" description="Controla disponibilidad y visibilidad">
      <ErrorMessage error={error} />
      {loading ? (
        <p className="text-sm text-slate-500">Cargando servicios...</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500">Aun no has registrado servicios.</p>
      ) : (
        <div className="space-y-3">
          {list.map((service) => (
            <div key={service.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{service.title}</p>
                <p className="text-xs text-slate-500">${Number(service.price).toFixed(2)}  -  {service.available ? "Disponible" : "No disponible"}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={service.visible ? "DELIVERED" : "CANCELLED"} />
                <button onClick={() => toggleVisibility(service.id, service.visible)} className="text-xs font-semibold text-indigo-600 hover:underline">
                  {service.visible ? "Ocultar" : "Publicar"}
                </button>
                <button onClick={() => remove(service.id)} className="text-xs font-semibold text-rose-600 hover:underline">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <h3 className="text-sm font-semibold text-slate-700">Nuevo servicio</h3>
        </div>
        <Input label="Titulo" value={form.title} onChange={(value) => setForm((curr) => ({ ...curr, title: value }))} required />
        <Input label="Precio" type="number" value={form.price} onChange={(value) => setForm((curr) => ({ ...curr, price: value }))} required />
        <TextArea label="Descripcion" value={form.description} onChange={(value) => setForm((curr) => ({ ...curr, description: value }))} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.available} onChange={(e) => setForm((curr) => ({ ...curr, available: e.target.checked }))} />
          Disponible
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.visible} onChange={(e) => setForm((curr) => ({ ...curr, visible: e.target.checked }))} />
          Visible
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar servicio"}
          </button>
        </div>
      </form>
    </Card>
  );
}
function ProviderDocumentsPanel({ auth }) {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ documentType: "IDENTIFICATION", fileUrl: "", observations: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api("/documents/me", { token: auth.token });
      setDocs(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/documents", {
        method: "POST",
        token: auth.token,
        body: form
      });
      setForm({ documentType: "IDENTIFICATION", fileUrl: "", observations: "" });
      await load();
      await auth.refresh(auth.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Documentos" description="Envio y seguimiento de requisitos">
      <ErrorMessage error={error} />
      {loading ? (
        <p className="text-sm text-slate-500">Cargando documentos...</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-slate-500">Aun no has enviado documentos.</p>
      ) : (
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{doc.documentType}</p>
                  <p className="text-xs text-slate-500">URL: <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{doc.fileUrl}</a></p>
                  {doc.observations && <p className="text-xs text-amber-600">Observaciones: {doc.observations}</p>}
                </div>
                <StatusBadge status={doc.status === "REQUESTED" ? "PENDING" : doc.status === "SUBMITTED" ? "IN_PROCESS" : doc.status === "APPROVED" ? "DELIVERED" : "CANCELLED"} />
              </div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
        <Select
          label="Tipo de documento"
          value={form.documentType}
          onChange={(value) => setForm((curr) => ({ ...curr, documentType: value }))}
          options={[
            { value: "IDENTIFICATION", label: "Identificacion" },
            { value: "LEGAL", label: "Legal" },
            { value: "BANK", label: "Bancario" },
            { value: "OTHER", label: "Otro" }
          ]}
        />
        <Input label="URL del documento" value={form.fileUrl} onChange={(value) => setForm((curr) => ({ ...curr, fileUrl: value }))} required placeholder="https://..." />
        <div className="md:col-span-2">
          <TextArea label="Observaciones" value={form.observations} onChange={(value) => setForm((curr) => ({ ...curr, observations: value }))} />
        </div>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Enviando..." : "Enviar documento"}
          </button>
        </div>
      </form>
    </Card>
  );
}
function AdminDashboardPanel({ auth }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api("/orders", { token: auth.token });
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth.token]);

  const totals = orders.reduce(
    (acc, order) => {
      acc.byStatus[order.status] = (acc.byStatus[order.status] || 0) + 1;
      acc.byType[order.itemType] = (acc.byType[order.itemType] || 0) + 1;
      return acc;
    },
    { byStatus: {}, byType: {} }
  );

  return (
    <div className="space-y-6">
      <Card title="Resumen de pedidos" description="Conteo por estado">
        <ErrorMessage error={error} />
        {loading ? (
          <p className="text-sm text-slate-500">Cargando informacion...</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ORDER_STATUS_OPTIONS.map((option) => (
              <div key={option.value} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">{option.label}</p>
                <p className="text-2xl font-semibold text-slate-800">{totals.byStatus[option.value] || 0}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Pedidos por tipo" description="Productos vs servicios">
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(ITEM_TYPE_LABELS).map(([value, label]) => (
            <div key={value} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-2xl font-semibold text-slate-800">{totals.byType[value] || 0}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AdminUsersPanel({ auth }) {
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ role: "PROVIDER", status: "", search: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filters.role) params.set("role", filters.role);
      if (filters.status) params.set("status", filters.status);
      if (filters.search) params.set("search", filters.search);
      const data = await api(`/users${params.toString() ? `?${params}` : ""}`, { token: auth.token });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.role, filters.status]);

  const updateStatus = async (id, status) => {
    setUpdating(true);
    try {
      await api(`/users/${id}/status`, { method: "PATCH", token: auth.token, body: { status } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const updateDocs = async (id, documentsStatus) => {
    setUpdating(true);
    try {
      await api(`/users/${id}/documents`, { method: "PATCH", token: auth.token, body: { documentsStatus } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Card title="Usuarios" description="Gestion de compradores y proveedores">
      <div className="grid gap-4 md:grid-cols-4">
        <Select
          label="Tipo"
          value={filters.role}
          onChange={(value) => setFilters((curr) => ({ ...curr, role: value }))}
          options={[
            { value: "PROVIDER", label: "Proveedores" },
            { value: "USER", label: "Compradores" },
            { value: "ADMIN", label: "Administradores" }
          ]}
        />
        <Select
          label="Estado"
          value={filters.status}
          onChange={(value) => setFilters((curr) => ({ ...curr, status: value }))}
          options={[
            { value: "ACTIVE", label: "Activo" },
            { value: "INACTIVE", label: "Inactivo" }
          ]}
          placeholder="Todos"
        />
        <div className="md:col-span-2">
          <Input
            label="Busqueda"
            value={filters.search}
            onChange={(value) => setFilters((curr) => ({ ...curr, search: value }))}
            placeholder="Nombre, correo, razon social"
          />
        </div>
        <div className="md:col-span-2">
          <button
            onClick={load}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Buscar
          </button>
        </div>
      </div>
      <ErrorMessage error={error} />
      {loading ? (
        <p className="text-sm text-slate-500">Cargando usuarios...</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-slate-500">No se encontraron usuarios.</p>
      ) : (
        <div className="space-y-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{user.name}</p>
                  <p className="text-xs text-slate-500">{user.email}  -  {ROLE_LABELS[user.role] || user.role}</p>
                  {user.companyName && <p className="text-xs text-slate-500">Razon social: {user.companyName}  -  NIT: {user.taxId}</p>}
                  <p className="text-xs text-slate-500">Documentos: {user.documentsStatus}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => updateStatus(user.id, user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}
                    disabled={updating}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    {user.status === "ACTIVE" ? "Deshabilitar" : "Habilitar"}
                  </button>
                  {user.role === "PROVIDER" && (
                    <button
                      onClick={() => updateDocs(user.id, user.documentsStatus === "APPROVED" ? "REQUESTED" : "APPROVED")}
                      disabled={updating}
                      className="text-xs font-semibold text-emerald-600 hover:underline"
                    >
                      {user.documentsStatus === "APPROVED" ? "Solicitar nuevamente" : "Aprobar documentos"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
function AdminPendingPanel({ auth }) {
  const [docs, setDocs] = useState([]);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState("");

  const load = async () => {
    setError("");
    try {
      const [docsData, ordersData] = await Promise.all([
        api("/documents?status=REQUESTED", { token: auth.token }),
        api("/orders?status=PENDING", { token: auth.token })
      ]);
      setDocs(Array.isArray(docsData) ? docsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const updateDoc = async (id, status) => {
    try {
      await api(`/documents/${id}/status`, { method: "PATCH", token: auth.token, body: { status } });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <ErrorMessage error={error} />
      <Card title="Documentos pendientes" description="Solicitudes en revision">
        {docs.length === 0 ? (
          <p className="text-sm text-slate-500">No hay documentos pendientes.</p>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => (
              <div key={doc.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{doc.userName}</p>
                    <p className="text-xs text-slate-500">{doc.documentType}  -  {doc.fileUrl}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => updateDoc(doc.id, "APPROVED")} className="text-xs font-semibold text-emerald-600 hover:underline">Aprobar</button>
                    <button onClick={() => updateDoc(doc.id, "REJECTED")} className="text-xs font-semibold text-rose-600 hover:underline">Rechazar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Card title="Pedidos pendientes" description="Pedidos sin gestionar">
        {orders.length === 0 ? (
          <p className="text-sm text-slate-500">No hay pedidos pendientes.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Pedido #{order.id}</p>
                    <p className="text-xs text-slate-500">{ITEM_TYPE_LABELS[order.itemType]}  -  {order.buyerName || order.buyerEmail}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function AdminReviewsPanel({ auth }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await api("/reviews", { token: auth.token });
        setReviews(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [auth.token]);

  return (
    <Card title="Resenas" description="Opiniones de usuarios">
      <ErrorMessage error={error} />
      {loading ? (
        <p className="text-sm text-slate-500">Cargando resenas...</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-slate-500">Aun no hay resenas registradas.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Pedido #{review.orderId}</p>
                  <p className="text-xs text-slate-500">{review.userName}</p>
                  <p className="text-xs text-slate-500">{review.comment || "Sin comentario"}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{review.rating}/5</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
