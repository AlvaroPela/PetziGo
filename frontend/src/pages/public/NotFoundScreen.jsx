import React from "react";
import { Link } from "react-router-dom"; // O 'Navigate' si prefieres

export default function NotFoundScreen() {
	return (
		<>
			{/* Definimos la animación 'float' aquí mismo.
        Tailwind la detectará si usas la clase 'animate-float'.
      */}
			<style>
				{`
          @keyframes float {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-15px); /* Ajusta qué tanto 'flota' */
            }
          }

          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}
			</style>

			<div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 text-center p-6">
				<div className="max-w-md">
					{/* 1. Gráfico Animado */}
					<div className="animate-float text-8xl md:text-9xl mb-6">🐶</div>

					{/* 2. Código de Error Temático */}
					<h1 className="text-8xl md:text-9xl font-bold text-violet-700 mb-4">
						4<span className="text-emerald-500">🐾</span>4
					</h1>

					{/* 3. Título */}
					<h2 className="text-3xl font-semibold text-gray-900 mb-3">¡Ups! Página no encontrada</h2>

					{/* 4. Mensaje Amigable */}
					<p className="text-lg text-gray-600 mb-8">
						Parece que nuestro rastreador ha perdido el rastro. No te preocupes, te ayudamos a volver a casa.
					</p>

					{/* 5. Botón de Acción (Call to Action) */}
					<Link
						to="/" // O '/dashboard'
						className="inline-block rounded-xl bg-violet-700 px-6 py-3 font-semibold text-white shadow-lg hover:bg-violet-800 transition-colors duration-200"
					>
						Volver al Inicio
					</Link>
				</div>
			</div>
		</>
	);
}
