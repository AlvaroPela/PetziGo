// src/auth/AuthProvider.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!token);

  const fetchMe = useCallback(async (overrideToken) => {
    const activeToken = overrideToken ?? token ?? localStorage.getItem("token");
    if (!activeToken) {
      setUser(null);
      setLoading(false);
      return null;
    }
    setLoading(true);
    try {
      const me = await api("/users/me", { token: activeToken });
      if (!me) {
        throw new Error("No se pudo obtener la información del usuario");
      }
      setUser(me);
      return me;
    } catch (err) {
      // No mostramos el error si es 404 - significa que el usuario no existe o token inválido
      if (!err.message?.includes("Not Found")) {
        console.error("Error al obtener datos del usuario:", err.message);
      }
      localStorage.removeItem("token");
      setToken("");
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    // Si hay token al montar, intentar validar y traer user
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, [token, fetchMe]);

  // Heartbeat de ubicación cada 10s para proveedores autenticados
  // Opción de simulación (dev): mover ~5 metros por tick sin pedir geolocalización real
  useEffect(() => {
    if (!user || user.role !== 'PROVIDER') return;
    let timerId;
    let stopped = false;

    // Toggle de simulación: define localStorage.setItem('simulateGps', '1') para activarla
    const simulate = (
      (typeof window !== 'undefined' && localStorage.getItem('simulateGps') === '1') ||
      (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV === true)
    );
    // Punto inicial para la simulación (Medellín aprox.)
    let simLat = 6.1689793;
    let simLng = -75.59018112;

    const metersToLat = (m) => m / 111111; // ~ metros a grados lat
    const metersToLng = (m, lat) => m / (111111 * Math.cos((lat || 0) * Math.PI / 180)); // ~ metros a grados lng

    const sendSimulated = async () => {
      // Caminata rápida: ~25 metros por tick (10s) ≈ ~9 km/h
      const distanceM = 25;
      const angle = Math.random() * 2 * Math.PI;
      const dLat = metersToLat(distanceM * Math.cos(angle));
      const dLng = metersToLng(distanceM * Math.sin(angle), simLat);
      simLat += dLat;
      simLng += dLng;
      try {
        await api('/providers/me/location', { method: 'POST', body: { latitude: simLat, longitude: simLng } });
      } catch {}
    };

    const sendReal = () => new Promise((resolve) => {
      if (!('geolocation' in navigator)) return resolve();
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const { latitude, longitude } = pos.coords || {};
            if (typeof latitude === 'number' && typeof longitude === 'number') {
              await api('/providers/me/location', { method: 'POST', body: { latitude, longitude } });
            }
          } catch {}
          resolve();
        },
        () => resolve(),
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
      );
    });

    const loop = async () => {
      if (stopped) return;
      if (simulate) {
        await sendSimulated();
      } else {
        await sendReal();
      }
      if (stopped) return;
      timerId = setTimeout(loop, 10000); // 10s
    };
    loop();
    return () => { stopped = true; if (timerId) clearTimeout(timerId); };
  }, [user]);

  const login = useCallback(async (email, password) => {
    try {
      const data = await api("/auth/login", { method: "POST", body: { email, password } });
      if (!data?.token) {
        throw new Error("No se recibió el token de acceso");
      }
      localStorage.setItem("token", data.token);
      setToken(data.token);
      
      try {
        const userData = await fetchMe(data.token);
        if (!userData) {
          throw new Error("No se pudo obtener la información del usuario");
        }
        // Si todo sale bien, actualizamos el usuario
        setUser(userData);
        return data;
      } catch (userError) {
        // Si falla obtener datos del usuario, limpiamos todo y relanzamos
        localStorage.removeItem("token");
        setToken("");
        setUser(null);
        throw new Error(userError.message === 'Not Found' 
          ? "Error al obtener datos del usuario. Por favor intenta de nuevo." 
          : userError.message);
      }
    } catch (error) {
      // Asegurarnos de que el error tenga un mensaje amigable
      throw new Error(
        error.message === 'Not Found' 
          ? "No se pudo acceder a tu cuenta. Por favor verifica tus credenciales." 
          : error.message || "Error al iniciar sesión. Por favor intenta de nuevo."
      );
    }
  }, [fetchMe]);

  const register = useCallback((payload) => api("/auth/register", { method: "POST", body: payload }), []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken("");
    setUser(null);
  }, []);

  const value = {
    token,
    user,
    loading,
    login,
    register,
    logout,
    refresh: fetchMe,
    setTokenManually: (t) => {
      if (t) {
        localStorage.setItem("token", t);
        setToken(t);
      } else {
        localStorage.removeItem("token");
        setToken("");
      }
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}