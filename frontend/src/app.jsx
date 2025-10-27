import React from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { BrowserRouter } from 'react-router-dom';

// Layouts
import Layout from "./components/Layout";

// Public Pages
import LandingPage from "./pages/public/LandingPage";
import SearchPage from "./pages/public/SearchPage";
import ServiceDetails from "./pages/public/ServiceDetails";
import LoginScreen from "./components/LoginScreen";
import ServicesPage from "./pages/public/ServicesPage";
import RegisterPage from "./pages/auth/Register";

// Client Pages
import ClientDashboard from "./pages/client/Dashboard";
import PetManagement from "./pages/client/PetManagement";

// Provider Pages
import ProviderDashboard from "./pages/provider/Dashboard";
import ProviderProfile from "./pages/provider/Profile";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import NotFoundScreen from "./pages/public/NotFoundScreen";
import ProductsPage from "./pages/public/ProductsPage";

export function App() {
	const auth = useAuth();

	if (auth.loading) {
		return (
			<div className="min-h-screen flex items-center justify-center">
				<div className="rounded-lg bg-white p-6 shadow">Validando sesión…</div>
			</div>
		);
	}

	return (
		<BrowserRouter>
			<Routes>
				<Route path="/" element={<Layout />}>
					{/* Public Routes */}
					<Route index element={<LandingPage />} />
					<Route path="search" element={<SearchPage />} />

					
					<Route path="login" element={<LoginScreen auth={auth} />} />
					<Route path="register" element={<RegisterPage />} />

					<Route path="services/:id" element={<ServiceDetails />} />
					<Route path="services" element={<ServicesPage />} />

					<Route path="products" element={<ProductsPage />} />

					{/* Protected Client Routes */}
					<Route path="client" element={auth.token && auth.user?.role === "CLIENT" ? <ClientDashboard /> : <LoginScreen auth={auth} />}>
						<Route index element={<ClientDashboard />} />
						<Route path="pets" element={<PetManagement />} />
					</Route>

					{/* Protected Provider Routes */}
					<Route path="provider" element={auth.token && auth.user?.role === "PROVIDER" ? <ProviderDashboard /> : <LoginScreen auth={auth} />}>
						<Route index element={<ProviderDashboard />} />
						<Route path="profile" element={<ProviderProfile />} />
					</Route>

					{/* Protected Admin Routes */}
					<Route path="admin" element={auth.token && auth.user?.role === "ADMIN" ? <AdminDashboard /> : <LoginScreen auth={auth} />}>
						<Route index element={<AdminDashboard />} />
						<Route path="users" element={<UserManagement />} />
					</Route>

          <Route path="*" element={<NotFoundScreen />} />
				</Route>
			</Routes>
		</BrowserRouter>
	);
}

export default App;
