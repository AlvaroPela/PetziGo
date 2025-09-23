import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { pool } from '../config/db.js';
import { authRequired } from '../middleware/auth.js';
const router = Router();
// GET profile
router.get('/me', authRequired(['USER','PROVIDER','ADMIN']), async (req,res)=>{
  const [rows] = await pool.query('SELECT id,name,email,role,phone,address FROM users WHERE id=?',[req.user.id]);
  res.json(rows[0]);
});
// PUT update profile
router.put('/me', authRequired(['USER','PROVIDER','ADMIN']), [
  body('name').optional().notEmpty(),
  body('phone').optional().notEmpty(),
  body('address').optional().notEmpty(),
], async (req,res)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({errors: errors.array()});
  const {name,phone,address} = req.body;
  await pool.query('UPDATE users SET name=COALESCE(?,name), phone=COALESCE(?,phone), address=COALESCE(?,address) WHERE id=?',[name,phone,address,req.user.id]);
  res.json({ok:true});
});

export default router;
