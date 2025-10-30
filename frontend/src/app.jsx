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
import ServiceBooking from "./pages/public/ServiceBooking";
import PaymentsResult from "./pages/public/PaymentsResult";
import PaymentsWaiting from "./pages/public/PaymentsWaiting";
import ProductDetails from "./pages/public/ProductDetails";
import ProductPurchase from "./pages/public/ProductPurchase";
import LoginScreen from "./components/LoginScreen";
import ServicesPage from "./pages/public/ServicesPage";
import RegisterPage from "./pages/auth/Register";

// Client Pages
import ClientDashboard from "./pages/client/Dashboard";
import PetManagement from "./pages/client/PetManagement";
import RequireRole from "./auth/RequireRole";

// Provider Pages
import ProviderDashboard from "./pages/provider/Dashboard";
import ProviderProfile from "./pages/provider/Profile";

// Admin Pages
import AdminDashboard from "./pages/admin/Dashboard";
import UserManagement from "./pages/admin/UserManagement";
import NotFoundScreen from "./pages/public/NotFoundScreen";
import ProductsPage from "./pages/public/ProductsPage";
import DashboardRedirect from './auth/DashboardRedirect';

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
					<Route path="services/:id/book" element={<ServiceBooking />} />
					<Route path="payments/wait" element={<PaymentsWaiting />} />
					<Route path="payments/success" element={<PaymentsResult />} />
					<Route path="products/:id" element={<ProductDetails />} />
					<Route path="products/:id/buy" element={<ProductPurchase />} />
					<Route path="services" element={<ServicesPage />} />
					<Route path="dashboard" element={<DashboardRedirect />} />

					<Route path="products" element={<ProductsPage />} />					

					{/* Protected Client Routes */}
					<Route path="client" element={<RequireRole allowedRoles={["CLIENT"]} />}>
						<Route index element={<ClientDashboard />} />
						<Route path="pets" element={<PetManagement />} />
					</Route>

					{/* Protected Provider Routes */}
					<Route path="provider" element={<RequireRole allowedRoles={["PROVIDER"]} />}>
						<Route index element={<ProviderDashboard />} />
						<Route path="profile" element={<ProviderProfile />} />
					</Route>

					{/* Protected Admin Routes */}
					<Route path="admin" element={<RequireRole allowedRoles={["ADMIN"]} />}>
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
