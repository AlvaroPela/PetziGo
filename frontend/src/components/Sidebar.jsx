import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Compute dashboard path based on role (falls back to /dashboard)
  const dashboardPath = user ? (user.role === 'CLIENT' ? '/client' : user.role === 'PROVIDER' ? '/provider' : user.role === 'ADMIN' ? '/admin' : '/dashboard') : '/dashboard';

  // Construir dinámicamente el menú según el rol del usuario
  const menuItems = [];
  // Panel siempre (protegido)
  menuItems.push({ name: 'Panel', path: dashboardPath, icon: '📊', protected: true });

  // Servicios y Productos están disponibles para todos los perfiles
  menuItems.push({ name: 'Servicios', path: '/services', icon: '🐾', protected: false });
  menuItems.push({ name: 'Productos', path: '/products', icon: '🦴', protected: false });
  // Buscar está disponible para todos los perfiles (incluye Provider)
  menuItems.push({ name: 'Buscar', path: '/search', icon: '🔍', protected: true, onlyRole: ['CLIENT', 'ADMIN'] });

  // Admin-only quick link to user management
  // Admin-only quick link to user management (now as array)
  menuItems.push({ name: 'Usuarios (Admin)', path: '/admin/users', icon: '👥', protected: true, onlyRole: ['ADMIN'] });
  // Mascotas sólo para clientes (now as array)
  menuItems.push({ name: 'Mascotas', path: '/client/pets', icon: '🐱', protected: true, onlyRole: ['CLIENT'] });

  const isActive = (path) => location.pathname === path;

  // Helper: human-friendly labels for roles
  const ROLE_LABEL = {
    CLIENT: 'Clientes',
    PROVIDER: 'Proveedores',
    ADMIN: 'Administradores',
  };

  // All badges as opaque gray (user requested "gris opacos")
  const roleBadgeClass = () => 'bg-gray-700/80 text-white';

  const roleListToText = (roles) => {
    if (!roles) return '';
    const arr = Array.isArray(roles) ? roles : [roles];
    return arr.map((r) => ROLE_LABEL[r] || r).join(', ');
  };

  function handleClick(item) {
    // Normalize allowed roles (if any)
    const allowedRoles = item.onlyRole ? (Array.isArray(item.onlyRole) ? item.onlyRole : [item.onlyRole]) : null;

    if (allowedRoles) {
      if (!user) {
        // redirect to login and preserve return path
        navigate('/login', { state: { from: location.pathname } });
        return;
      }
      if (!allowedRoles.includes(user.role)) {
        // show popup with readable roles
        window.alert('Acceso restringido: esta opción está disponible solo para: ' + roleListToText(allowedRoles));
        return;
      }
      // Special: if navigating to search, set a forced 5s UI-loading flag (stored in localStorage)
      if (item.path === '/search') {
        try { localStorage.setItem('search_forced_until', String(Date.now() + 5000)); } catch (e) {}
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
                    // Normalize onlyRole to an array when present
                    const allowedRoles = item.onlyRole ? (Array.isArray(item.onlyRole) ? item.onlyRole : [item.onlyRole]) : null;
                    // Determine disabled state
                    let disabled = false;
                    if (allowedRoles) {
                      if (!user) disabled = true;
                      else disabled = !allowedRoles.includes(user.role);
                    } else {
                      disabled = item.protected && !user;
                    }
            return (
              <div key={item.path} className={`px-2`}>
                <button
                  onClick={() => handleClick(item)}
                  title={item.name}
                  className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left ${isActive(item.path) ? 'bg-violet-900 text-white font-semibold' : 'hover:bg-violet-900'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  disabled={disabled}
                >
                  <span className="text-xl">{item.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm truncate">{item.name}</div>
                    {/* Badges below the name (gris opacos).
                        Do not show badges when the current user already has one of the allowed roles. */}
                    {allowedRoles && (!user || !allowedRoles.includes(user.role)) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {allowedRoles.map((r) => (
                          <span key={r} className={`${roleBadgeClass()} text-[11px] px-2 py-0.5 rounded`}>{ROLE_LABEL[r] || r}</span>
                        ))}
                      </div>
                    )}
                  </div>
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