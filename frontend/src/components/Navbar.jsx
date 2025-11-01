import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

const Navbar = () => {
	const { user, logout } = useAuth();

	return (
		<nav className="bg-white shadow-lg">
			<div className="max-w-7xl mx-auto px-4">
				<div className="flex justify-between h-16">
					<div className="flex">
						<div className="flex-shrink-0 flex items-center">
							<Link to="/" className="text-2xl font-bold text-petzi">
								PetziGo
							</Link>
						</div>
						<div className="hidden md:ml-6 md:flex md:space-x-8">
							<Link to="/search" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900">
								Buscar
							</Link>
							<Link to="/services" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
								Servicios
							</Link>
							<Link to="/products" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
								Productos
							</Link>
							{user?.role === 'ADMIN' && (
								<Link to="/admin/users" className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900">
									Admin
								</Link>
							)}
						</div>
					</div>
					<div className="flex items-center">
						{user ? (
							<div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-petzi bg-white hover:bg-gray-100">
								{user.name}
							</div>
						) : (
							<Link
								to="/login"
								className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-petzi bg-white hover:bg-gray-100"
							>
								Iniciar Sesión
							</Link>
						)}

						{user ? (
							<button
								onClick={logout}
								className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800"
							>
								Cerrar sesión
							</button>
						) : (
							<Link
								to="/register"
								className="ml-3 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-violet-700 hover:bg-violet-800"
							>
								Registrarse
							</Link>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
};

export default Navbar;
