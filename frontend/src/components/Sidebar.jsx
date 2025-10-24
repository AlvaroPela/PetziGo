import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function Sidebar() {
  const location = useLocation();
  const { user } = useAuth();

  const menuItems = [
    { name: 'Panel', path: '/dashboard', icon: '📊' },
    { name: 'Servicios', path: '/services', icon: '🐾' },
    { name: 'Productos', path: '/products', icon: '🦴' },
    { name: 'Mascotas', path: '/pets', icon: '🐱' },
    { name: 'Buscar', path: '/search', icon: '🔍' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="bg-purple-900 text-white h-screen w-64 fixed left-0 top-0 overflow-y-auto">
      <div className="p-4">
        <Link to="/" className="flex items-center space-x-2 mb-8">
          <span className="text-2xl">PZ</span>
          <span className="text-xl font-semibold">PetziGo</span>
        </Link>

        <nav className="space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.path}
              to={user ? item.path : '/login'}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                isActive(item.path)
                  ? 'bg-purple-700 text-white'
                  : 'hover:bg-purple-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-purple-900">
        {user ? (
          <div className="flex items-center space-x-3 p-3">
            <span className="text-xl">👤</span>
            <span className="truncate">{user.name || user.email}</span>
          </div>
        ) : (
          <Link
            to="/login"
            className="flex items-center space-x-3 p-3 hover:bg-purple-800 rounded-lg transition-colors"
          >
            <span className="text-xl">🔑</span>
            <span>Iniciar Sesión</span>
          </Link>
        )}
      </div>
    </div>
  );
}