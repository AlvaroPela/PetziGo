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
      setUser(me);
      return me;
    } catch (err) {
      // Si token inválido -> limpiar
      console.error("fetchMe error:", err);
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

  const login = useCallback(async (email, password) => {
    const data = await api("/auth/login", { method: "POST", body: { email, password } });
    if (!data?.token) throw new Error("No token recibido del servidor");
    localStorage.setItem("token", data.token);
    setToken(data.token);
    // fetchMe actualizará user
    await fetchMe(data.token);
    return data;
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