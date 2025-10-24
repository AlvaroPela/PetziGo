import React from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "./auth/AuthProvider.jsx";
import App from "./app.jsx";
import "./index.css";
// Estilos necesarios para Leaflet (mapas)
import 'leaflet/dist/leaflet.css';

createRoot(document.getElementById("root")).render(
	<React.StrictMode>
		<AuthProvider>
			<App />
			
		</AuthProvider>
	</React.StrictMode>
);
