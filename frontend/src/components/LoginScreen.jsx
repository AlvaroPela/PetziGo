import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input, Button } from "./FormComponents";
import { toast } from "react-toastify";

export default function LoginScreen({ auth, onDone, redirectTo = "/dashboard" }) {
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
			toast.success("¡Bienvenido de vuelta!");
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
		<section className="flex items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-md">
				{/* Hero / bienvenida */}
				<div className="mb-6">
					<h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-gray-900">Hola, bienvenido</h1>
					<p className="mt-2 text-gray-600">Ingresa con tu cuenta para gestionar tus servicios.</p>
				</div>

				{/* Tarjeta de login */}
				<div className="rounded-2xl bg-white shadow border p-6 space-y-4">
					<form onSubmit={submit} className="space-y-4">
						<Input label="Email" type="email" value={email} onChange={setEmail} placeholder="tucorreo@ejemplo.com" autoComplete="email" required />
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

						<Button disabled={loading} className="w-full" variant="primary">
							{loading ? "Ingresando…" : "Entrar"}
						</Button>
					</form>

					<div className="flex items-center justify-between text-sm pt-2">
						<button type="button" onClick={() => navigate("/register")} className="text-violet-800 hover:underline">
							¿No tienes cuenta? Crear cuenta
						</button>
					</div>
				</div>
			</div>
		</section>
	);
}
