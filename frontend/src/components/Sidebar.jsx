import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Compute dashboard path based on role (falls back to /dashboard)
  const dashboardPath = user ? (user.role === 'CLIENT' ? '/client' : user.role === 'PROVIDER' ? '/provider' : user.role === 'ADMIN' ? '/admin' : '/dashboard') : '/dashboard';

  const menuItems = [
    { name: 'Panel', path: dashboardPath, icon: '📊', protected: true },
    { name: 'Servicios', path: '/services', icon: '🐾', protected: false },
    { name: 'Productos', path: '/products', icon: '🦴', protected: false },
    // Admin-only quick link to user management
    { name: 'Usuarios (Admin)', path: '/admin/users', icon: '👥', protected: true, onlyRole: 'ADMIN' },
    // Mascotas sólo para clientes
    { name: 'Mascotas', path: '/client/pets', icon: '🐱', protected: true, onlyRole: 'CLIENT' },
    { name: 'Buscar', path: '/search', icon: '🔍', protected: false },
  ];

  const isActive = (path) => location.pathname === path;

  function handleClick(item) {
    // If item has role restriction
    if (item.onlyRole) {
      if (!user) {
        // redirect to login and preserve return path
        navigate('/login', { state: { from: location.pathname } });
        return;
      }
      if (user.role !== item.onlyRole) {
        // show small hint: user not authorized
        window.alert('Acceso restringido: opción disponible solo para ' + item.onlyRole.toLowerCase());
        return;
      }
      navigate(item.path);
      return;
    }

    if (item.protected) {
      if (!user) {
        navigate('/login', { state: { from: location.pathname } });
        return;
      }
    }

    navigate(item.path);
  }

  return (
    <div className="bg-violet-800 text-white h-screen w-64 fixed left-0 top-0 overflow-y-auto">
      <div className="p-4">
        <Link to="/" className="flex items-center space-x-2 mb-8">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20 font-bold">PZ</span>
          <span className="text-xl font-semibold tracking-tight">PetziGo</span>
        </Link>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const disabled = item.onlyRole ? (!user || user.role !== item.onlyRole) : (item.protected && !user);
            return (
              <div key={item.path} className={`px-2`}>
                <button
                  onClick={() => handleClick(item)}
                  title={disabled ? (item.onlyRole ? `Disponible solo para ${item.onlyRole}` : 'Necesitas iniciar sesión') : item.name}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${isActive(item.path) ? 'bg-violet-900 text-white font-semibold' : 'hover:bg-violet-900'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  disabled={disabled}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="flex-1">{item.name}</span>
                  {disabled && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">{!user ? 'Login' : item.onlyRole}</span>
                  )}
                </button>
              </div>
            );
          })}
        </nav>
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 bg-violet-800">
        {user ? (
          // Make the user card clickable and navigate to the appropriate profile path depending on role
          <button
            onClick={() => {
              const profilePath = user.role === 'PROVIDER' ? '/provider/profile' : user.role === 'CLIENT' ? '/client/profile' : '/admin';
              navigate(profilePath);
            }}
            className="w-full flex items-center space-x-3 p-3 hover:bg-violet-900 rounded-lg transition-colors text-left"
            title="Ver y editar mi perfil"
          >
            <span className="text-xl">👤</span>
            <div className="truncate">
              <div className="text-sm font-semibold">{user.name || user.email}</div>
              <div className="text-xs text-violet-200">{user.role}</div>
            </div>
          </button>
        ) : (
          <Link to="/login" className="flex items-center space-x-3 p-3 hover:bg-violet-900 rounded-lg transition-colors">
            <span className="text-xl">🔑</span>
            <span>Iniciar Sesión</span>
          </Link>
        )}
      </div>
    </div>
  );
}