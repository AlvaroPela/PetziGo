import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from './FormComponents';
import { toast } from 'react-toastify';

export default function LoginScreen({ auth, onDone, redirectTo = '/dashboard' }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); 
    setError("");
    try {
      await auth.login(email, password);
      toast.success('¡Bienvenido de vuelta!');
      if (onDone) {
        onDone();
      } else {
        navigate(redirectTo);
      }
    } catch (err) {
      setError(err.message);
      toast.error(err.message);
    } finally { 
      setLoading(false);
    }
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
                onClick={() => navigate('/register')}
                className="text-violet-700 hover:underline"
              >
                ¿No tienes cuenta? Crear cuenta
              </button>
            </div>
          </div>

          {/* Chips / destacados */}
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