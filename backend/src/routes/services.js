import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
const router = Router();
// GET list services (public)
router.get('/', async (_req,res)=>{
  const [rows] = await pool.query('SELECT s.id, s.title, s.description, s.price, s.available, u.name as providerName FROM services s JOIN users u ON u.id=s.provider_id WHERE s.active=1');
  res.json(rows);
});
// POST create service (provider)
router.post('/', authRequired('PROVIDER'), [
  body('title').notEmpty(),
  body('description').notEmpty(),
  body('price').isFloat({min:0})
], async (req,res)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({errors: errors.array()});
  const {title,description,price,available=true} = req.body;
  const [result] = await pool.query('INSERT INTO services (provider_id,title,description,price,available,active) VALUES (?,?,?,?,?,1)',[req.user.id,title,description,price,available]);
  res.status(201).json({id: result.insertId});
});
export default router;
