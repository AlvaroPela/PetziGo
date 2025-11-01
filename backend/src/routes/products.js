import { Router } from "express";
import { body, param, query, validationResult } from "express-validator";
import { pool } from "../config/db.js";
import { authRequired, requireResourceOwnership } from "../middleware/auth.js";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuración de subida de imágenes de productos
const productsUploadDir = path.join(__dirname, "../../uploads/products");
try { fs.mkdirSync(productsUploadDir, { recursive: true }); } catch {}

const productsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, productsUploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
    cb(null, name);
  }
});

const imageUpload = multer({
  storage: productsStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    if (ok) return cb(null, true);
    cb(new Error("Formato de imagen no permitido (usa JPG, PNG o WEBP)"));
  }
});

const router = Router();

/**
 * Helper: map DB row to product object shape expected by frontend
 */
function mapProductRow(row) {
	return {
		id: row.id,
		name: row.name,
		description: row.description,
		image_url: row.image_url || null,
		price: Number(row.price),
		stock: row.stock,
		category: row.category,
		invima_registration: row.invima_registration,
		// Coerción robusta: MySQL BOOLEAN puede venir como 0/1 o true/false
		active: row.active ? 1 : 0,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		providerName: row.providerName,
		companyName: row.companyName,
	};
}

/**
 * GET /products
 * - soporta filtros: category, min_price, max_price, search, provider_id
 * - paginación: page, limit
 * Respuesta: { products: [...], meta: { page, limit, total } }
 */
router.get('/', [  
  query('min_price').optional().isFloat({ min: 0 }),
  query('max_price').optional().isFloat({ min: 0 }),
  query('rating').optional().isFloat({ min: 1, max: 5 }),
  query('search').optional().trim()
], async (req, res) => {
  console.log('[products] GET / - query:', req.query);
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

    const { category, min_price, max_price, rating, search, provider_id } = req.query;
    // PENDIENTE para cuando se implemnte la activacion y desactivacions del provedor
    // let query = `
    //   SELECT s.*, u.name as provider_name, 
    //          pp.average_rating, pp.total_reviews,
    //          pp.location_lat, pp.location_lng
    //   FROM services s
    //   INNER JOIN users u ON s.provider_id = u.id
    //   INNER JOIN provider_profiles pp ON s.provider_id = pp.user_id
    //   WHERE s.active = 1 AND u.status = 'ACTIVE' AND pp.verified = 1
    // `;

		let query = `
			SELECT p.*, u.name as provider_name, 
             pp.average_rating, pp.total_reviews,
             pp.location_lat, pp.location_lng
			FROM products p
			INNER JOIN users u ON p.provider_id = u.id
			INNER JOIN provider_profiles pp ON p.provider_id = pp.user_id
			WHERE p.active = 1
				AND u.status = 'ACTIVE'
				AND pp.verified = 1
    `;

    const values = [];

    if (category) {
      query += ` AND p.category = ?`;
      values.push(category);
    }

    if (min_price) {
      query += ` AND p.price >= ?`;
      values.push(min_price);
    }

    if (max_price) {
      query += ` AND p.price <= ?`;
      values.push(max_price);
    }

    if (rating) {
      query += ` AND pp.average_rating >= ?`;
      values.push(rating);
    }

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      values.push(`%${search}%`, `%${search}%`);
    }

     if (provider_id) {
      query += ` AND p.provider_id = ?`;
      values.push(provider_id);
    }

    query += ` ORDER BY pp.average_rating DESC, p.created_at DESC`;

    const [products] = await pool.query(query, values);

  console.log('[products] found', Array.isArray(products) ? products.length : 0, 'products');
  res.json({ products });

  } catch (err) {
    console.error('Error al obtener products:', err);
    res.status(500).json({
      message: 'Error al obtener products'
    });
  }
});

// Obtener un producto específico
// Nota: rutas estáticas deben ir antes que rutas dinámicas (/:id)
// para evitar colisiones como GET /products/mine que podría
// coincidir con ":id" si está definido antes.
router.get('/mine', authRequired("PROVIDER"), async (req, res) => {
	try {
		const [rows] = await pool.query(
			`SELECT id, name, description, image_url, price, stock, category, invima_registration,
			  active, created_at AS createdAt, updated_at AS updatedAt
	   FROM products
	   WHERE provider_id = ?
	   ORDER BY created_at DESC`,
			[req.user.id]
		);
		res.json(rows.map(mapProductRow));
	} catch (err) {
		console.error("GET /products/mine error:", err);
		res.status(500).json({ message: "Error interno" });
	}
});

// Obtener un producto específico por id numérico
router.get('/:id', [param('id').isInt({ min: 1 })], async (req, res) => {
	console.log('[products] GET /:id - id:', req.params.id);
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({ errors: errors.array() });
		}

		const productId = req.params.id;

		const [[productRow]] = await pool.query(
			`SELECT p.*, u.name as provider_name, pp.business_description, pp.average_rating, pp.total_reviews, pp.location_lat, pp.location_lng, pp.verified
			 FROM products p
			 INNER JOIN users u ON p.provider_id = u.id
			 INNER JOIN provider_profiles pp ON p.provider_id = pp.user_id
			 WHERE p.id = ? AND p.active = 1 AND u.status = 'ACTIVE' AND pp.verified = 1`,
			[productId]
		);

		if (!productRow) {
			console.warn('[products] product not found id:', productId);
			return res.status(404).json({ message: 'Producto no encontrado' });
		}

		// Obtener reseñas del proveedor (si aplica)
		const [reviews] = await pool.query(
			`SELECT r.rating, r.comment, r.created_at, u.name as client_name
			 FROM reviews r
			 INNER JOIN users u ON r.client_id = u.id
			 WHERE r.provider_id = ? AND r.status = 'APPROVED'
			 ORDER BY r.created_at DESC
			 LIMIT 10`,
			[productRow.provider_id]
		);

		const product = {
			id: productRow.id,
			name: productRow.name,
			description: productRow.description,
			image_url: productRow.image_url || null,
			price: Number(productRow.price),
			stock: productRow.stock,
			category: productRow.category,
			invima_registration: productRow.invima_registration,
			provider_name: productRow.provider_name,
			business_description: productRow.business_description,
			average_rating: productRow.average_rating,
			total_reviews: productRow.total_reviews,
			location_lat: productRow.location_lat,
			location_lng: productRow.location_lng,
			reviews,
		};

		res.json({ product });
	} catch (err) {
		console.error('Error al obtener producto:', err);
		res.status(500).json({ message: 'Error al obtener producto' });
	}
});

/**
 * Validaciones comunes
 */
const productValidations = [
	body("name").trim().notEmpty().withMessage("El nombre es obligatorio"),
	body("description").trim().notEmpty().withMessage('La descripción es requerida').isLength({ min: 100 }).withMessage('La descripción debe tener al menos 100 caracteres'),
	body("category").trim().notEmpty().withMessage("La categoría es obligatoria"),
	body("price").isFloat({ min: 0 }).withMessage("El precio debe ser un número positivo"),
	body("stock").optional().isInt({ min: 0 }).withMessage("El stock debe ser un entero positivo"),
	body("invima_registration").optional().trim().isLength({ max: 100 }).withMessage("INVIMA demasiado largo"),
	// active puede venir como 0/1 o true/false; validamos que sea 0/1 opcionalmente
	body("active")
		.optional()
		.custom((v) => {
			// aceptar 0/1, '0'/'1', true/false
			if (v === 0 || v === 1 || v === "0" || v === "1" || v === true || v === false) return true;
			throw new Error("active debe ser booleano 0/1");
		}),
];

/**
 * POST /products
 */
router.post("/", authRequired("PROVIDER"), productValidations, async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { name, description = "", category, price, stock = 0, invima_registration = null, active = 1 } = req.body;

		const activeFlag = active === 0 || active === "0" || active === false ? 0 : 1;

		const [result] = await pool.query(
			`INSERT INTO products (provider_id, name, description, price, stock, invima_registration, category, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[req.user.id, name, description, price, stock, invima_registration, category, activeFlag]
		);

		// devolver el producto creado con datos del proveedor
		const [rows] = await pool.query(
			`SELECT p.id, p.name, p.description, p.image_url, p.price, p.stock, p.category, p.invima_registration,
              p.active, p.created_at AS createdAt, p.updated_at AS updatedAt
       FROM products p
       LEFT JOIN provider_profiles pp ON pp.user_id = p.provider_id
       LEFT JOIN users u ON u.id = p.provider_id
       WHERE p.id = ?`,
			[result.insertId]
		);

		const product = rows[0] ? mapProductRow(rows[0]) : { id: result.insertId };
		res.status(201).json({ product });
	} catch (err) {
		console.error("POST /products error:", err);
		res.status(500).json({ message: "Error interno" });
	}
});

/**
 * PUT /products/:id
 * - Actualiza producto (ownership check)
 */
router.put("/:id", authRequired("PROVIDER"), [param("id").isInt({ min: 1 }), ...productValidations], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { id } = req.params;
		const { name, description = "", category, price, stock = 0, invima_registration = null, active = 1 } = req.body;

		const [ownership] = await pool.query("SELECT id FROM products WHERE id = ? AND provider_id = ?", [id, req.user.id]);
		if (!ownership.length) return res.status(404).json({ message: "Producto no encontrado" });

		const activeFlag = active === 0 || active === "0" || active === false ? 0 : 1;

		await pool.query(
			`UPDATE products
         SET name = ?, description = ?, price = ?, stock = ?, invima_registration = ?, category = ?, active = ?, updated_at = NOW()
         WHERE id = ?`,
			[name, description, price, stock, invima_registration, category, activeFlag, id]
		);

		const [rows] = await pool.query(
			`SELECT p.id, p.name, p.description, p.image_url, p.price, p.stock, p.category, p.invima_registration,
                p.active, p.created_at AS createdAt, p.updated_at AS updatedAt
         FROM products p
         LEFT JOIN provider_profiles pp ON pp.user_id = p.provider_id
         LEFT JOIN users u ON u.id = p.provider_id
         WHERE p.id = ?`,
			[id]
		);

		const product = rows[0] ? mapProductRow(rows[0]) : null;
		res.json({ product });
	} catch (err) {
		console.error("PUT /products/:id error:", err);
		res.status(500).json({ message: "Error interno" });
	}
});

/**
 * PATCH /products/:id/active
 * - Cambiar bandera active (ownership check)
 */
router.patch(
	"/:id/active",
	authRequired("PROVIDER"),
	[
		param("id").isInt({ min: 1 }),
		body("active").custom((v) => {
			if (v === 0 || v === 1 || v === "0" || v === "1" || v === true || v === false) return true;
			throw new Error("active debe ser booleano 0/1");
		}),
	],
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

			const { id } = req.params;
			const { active } = req.body;
			const activeFlag = active === 0 || active === "0" || active === false ? 0 : 1;

			const [ownership] = await pool.query("SELECT id FROM products WHERE id = ? AND provider_id = ?", [id, req.user.id]);
			if (!ownership.length) return res.status(404).json({ message: "Producto no encontrado" });

			await pool.query("UPDATE products SET active = ?, updated_at = NOW() WHERE id = ?", [activeFlag, id]);

			res.json({ ok: true, active: activeFlag });
		} catch (err) {
			console.error("PATCH /products/:id/active error:", err);
			res.status(500).json({ message: "Error interno" });
		}
	}
);

/**
 * DELETE /products/:id
 * - Soft delete: set active = 0
 */
router.delete("/:id", authRequired("PROVIDER"), [param("id").isInt({ min: 1 })], async (req, res) => {
	try {
		const errors = validationResult(req);
		if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

		const { id } = req.params;
		const [ownership] = await pool.query("SELECT id FROM products WHERE id = ? AND provider_id = ?", [id, req.user.id]);
		if (!ownership.length) return res.status(404).json({ message: "Producto no encontrado" });

		await pool.query("UPDATE products SET active = 0, updated_at = NOW() WHERE id = ?", [id]);
		// 204 no content
		res.status(204).send();
	} catch (err) {
		console.error("DELETE /products/:id error:", err);
		res.status(500).json({ message: "Error interno" });
	}
});

// Subir imagen de un producto (propietario)
router.post('/:id/image', authRequired(), requireResourceOwnership('product'), imageUpload.single('image'), async (req, res) => {
	try {
		if (!req.file) return res.status(400).json({ message: 'No se envió ninguna imagen' });
		const productId = req.params.id;
		const imageUrl = `/uploads/products/${req.file.filename}`;
		await pool.query('UPDATE products SET image_url = ?, updated_at = NOW() WHERE id = ?', [imageUrl, productId]);
		res.status(200).json({ ok: true, imageUrl });
	} catch (err) {
		console.error('Error subiendo imagen de producto:', err);
		res.status(500).json({ message: 'Error subiendo imagen de producto' });
	}
});

export default router;
