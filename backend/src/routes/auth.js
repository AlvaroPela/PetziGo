import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db.js';
const router = Router();
// POST /api/auth/register
router.post('/register',[
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({min:6}),
  body('role').isIn(['USER','PROVIDER','ADMIN'])
], async (req,res)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({errors: errors.array()});
  const {name,email,password,role} = req.body;
  const [rows] = await pool.query('SELECT id FROM users WHERE email=?',[email]);
  if(rows.length) return res.status(409).json({message:'Email ya registrado'});
  const hash = await bcrypt.hash(password,10);
  const [result] = await pool.query('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)',[name,email,hash,role]);
  const token = jwt.sign({id: result.insertId, role}, process.env.JWT_SECRET, {expiresIn:'12h'});
  res.status(201).json({token});
});
// POST /api/auth/login
router.post('/login',[
  body('email').isEmail(),
  body('password').notEmpty()
], async (req,res)=>{
  const errors = validationResult(req);
  if(!errors.isEmpty()) return res.status(400).json({errors: errors.array()});
  const {email,password} = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email=?',[email]);
  if(!rows.length) return res.status(401).json({message:'Credenciales inválidas'});
  const user = rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if(!ok) return res.status(401).json({message:'Credenciales inválidas'});
  const token = jwt.sign({id: user.id, role: user.role}, process.env.JWT_SECRET, {expiresIn:'12h'});
  res.json({token, role:user.role, name:user.name});
});
export default router;
