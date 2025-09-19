import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
const router = Router();
// POST create order (user)
router.post('/', authRequired('USER'), [
  body('serviceId').isInt({min:1})
], async (req,res)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({errors: errors.array()});
  const {serviceId} = req.body;
  const [result] = await pool.query('INSERT INTO orders (user_id, service_id, status) VALUES (?,?,?)',[req.user.id, serviceId, 'PENDING']);
  res.status(201).json({id: result.insertId, status:'PENDING'});
});
// GET my orders
router.get('/me', authRequired(['USER','PROVIDER']), async (req,res)=>{
  if(req.user.role === 'USER'){
    const [rows] = await pool.query('SELECT * FROM orders WHERE user_id=?',[req.user.id]);
    return res.json(rows);
  } else {
    const [rows] = await pool.query('SELECT o.* FROM orders o JOIN services s ON s.id=o.service_id WHERE s.provider_id=?',[req.user.id]);
    return res.json(rows);
  }
});
export default router;
