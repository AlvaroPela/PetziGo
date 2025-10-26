import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';

// Middleware para autenticación con JWT
export const requireAuth = async (req, res, next) => {
  try {
    // Obtener token del header
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Token no proporcionado' });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Obtener usuario de la BD
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.role, u.status,
        CASE 
          WHEN u.role = 'PROVIDER' THEN pp.verified
          ELSE NULL
        END as provider_verified
      FROM users u
      LEFT JOIN provider_profiles pp ON u.id = pp.user_id
      WHERE u.id = ?`,
      [decoded.id]
    );
    
    if (!users.length || users[0].status === 'INACTIVE') {
      return res.status(401).json({ message: 'Token inválido o usuario inactivo' });
    }

    // Agregar usuario a la request
    req.user = users[0];
    next();

  } catch (err) {
    console.error('Error de autenticación:', err);
    res.status(401).json({ message: 'Token inválido' });
  }
};

// Compatibilidad con versiones previas: alias `authRequired` que usa `requireAuth`
export const authRequired = (roles = []) => {
  // Si se llama con roles (como en la versión antigua), devolvemos un middleware
  if (roles && roles.length) {
    // roles puede ser string o array
    const wanted = Array.isArray(roles) ? roles : [roles];
    return async (req, res, next) => {
      // Ejecutar la verificación base
      await requireAuth(req, res, async () => {
        // después de autenticado, comprobar roles
        if (!wanted.includes(req.user.role)) {
          return res.status(403).json({ message: 'Forbidden' });
        }
        next();
      });
    };
  }

  // Si no se pasan roles, devolver requireAuth como middleware directo
  return requireAuth;
};

// Middleware para verificación de roles
export const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No autorizado para esta operación' });
    }
    next();
  }
};

// Middleware para verificar proveedores validados
export const requireVerifiedProvider = (req, res, next) => {
  // Se ocmenta por ahora PENDIENTE
  // if (req.user.role !== 'PROVIDER' || !req.user.provider_verified) {
  //   return res.status(403).json({ 
  //     message: 'Esta operación requiere un proveedor verificado' 
  //   });
  // }
  if (req.user.role !== 'PROVIDER') {
    return res.status(403).json({ 
      message: 'Esta operación requiere un proveedor verificado' 
    });
  }
  next();
};

// Middleware para validar propiedad de recursos
export const requireResourceOwnership = (resourceType) => {
  return async (req, res, next) => {
    const resourceId = req.params.id;
    const userId = req.user.id;

    try {
      let query;
      switch (resourceType) {
        case 'service':
          query = 'SELECT provider_id FROM services WHERE id = ?';
          break;
        case 'product':
          query = 'SELECT provider_id FROM products WHERE id = ?';
          break;
        case 'order':
          query = `SELECT client_id, provider_id FROM orders WHERE id = ?`;
          break;
        default:
          return res.status(400).json({ message: 'Tipo de recurso inválido' });
      }

      const [rows] = await pool.query(query, [resourceId]);
      
      if (!rows.length) {
        return res.status(404).json({ message: 'Recurso no encontrado' });
      }

      const resource = rows[0];
      
      if (resourceType === 'order') {
        if (req.user.role === 'CLIENT' && resource.client_id !== userId) {
          return res.status(403).json({ message: 'No autorizado' });
        }
        if (req.user.role === 'PROVIDER' && resource.provider_id !== userId) {
          return res.status(403).json({ message: 'No autorizado' });
        }
      } else if (resource.provider_id !== userId) {
        return res.status(403).json({ message: 'No autorizado' });
      }

      next();
    } catch (err) {
      console.error('Error verificando propiedad:', err);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  };
};
