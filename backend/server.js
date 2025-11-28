/* eslint-disable no-undef */
/* eslint-env node */
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { validateCPF } = require('./utils');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configure these values for your XAMPP/MySQL local setup (adjust if needed)
const DB_CONFIG = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'usinagemlimmar'
};

// JWT secret (set via env var in production)
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

// Simple SSE clients list
const sseClients = [];

// Função para inicializar o banco de dados
async function initializeDatabase(force = false) {
  try {
    // Tentar conectar ao MySQL
    const conn = await mysql.createConnection({
      host: DB_CONFIG.host,
      port: DB_CONFIG.port,
      user: DB_CONFIG.user,
      password: DB_CONFIG.password
    });

    // If force is provided, drop and recreate the database to ensure schema alignment
    if (force) {
      try {
        await conn.query(`DROP DATABASE IF EXISTS ${DB_CONFIG.database}`);
        console.log(`Dropped database ${DB_CONFIG.database} (force=true)`);
      } catch (err) {
        console.error('Erro ao dropar database (force):', err.message);
      }
    }

    // Criar banco se não existir e selecionar
    await conn.query(`CREATE DATABASE IF NOT EXISTS ${DB_CONFIG.database}`);
    await conn.query(`USE ${DB_CONFIG.database}`);

    // Ler e executar o arquivo init.sql
    const fs = require('fs');
    const path = require('path');
    const initSql = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
    
    // Dividir o arquivo em comandos individuais e executá-los
    const commands = initSql.split(';').filter(cmd => cmd.trim());
    for (let cmd of commands) {
      if (cmd.trim()) {
        try {
          await conn.query(cmd);
        } catch (err) {
          console.error('Erro ao executar comando:', cmd.trim());
          console.error('Erro:', err.message);
        }
      }
    }

    console.log('Banco de dados inicializado com sucesso!');
    await conn.end();
    return true;
  } catch (err) {
    console.error('Erro ao inicializar banco de dados:', err);
    return false;
  }
}

// Rota para verificar e inicializar o banco
app.get('/api/initialize-db', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const success = await initializeDatabase(force);
    if (success) {
      res.json({ message: 'Banco de dados inicializado com sucesso!' });
    } else {
      res.status(500).json({ error: 'Erro ao inicializar banco de dados' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno ao inicializar banco de dados' });
  }
});

function sendSSEEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach((res) => res.write(payload));
}

app.get('/', (req, res) => res.json({ status: 'ok', message: 'UsinagemLimmar backend scaffold' }));

// Dev mode: if DEV_NO_DB=1 use in-memory storage so the server can run without MySQL
const USE_IN_MEMORY = process.env.DEV_NO_DB === '1';
const mem = {
  tools: [],
  production_records: [],
  tool_failures: [],
  users: [],
};

function nextId(arr) {
  return (arr.length ? Math.max(...arr.map(x => x.id || 0)) : 0) + 1;
}

// Seed some sample data in-memory to make the dev mode more useful
if (USE_IN_MEMORY) {
  if (!mem.tools.length) {
    mem.tools.push({ id: 1, code: 'T-100', description: 'Fresa 10mm', brand: 'Korloy', created_at: new Date().toISOString() });
    mem.tools.push({ id: 2, code: 'T-200', description: 'Broca 5mm', brand: 'Dormer', created_at: new Date().toISOString() });
  }
  if (!mem.users.length) {
    // seed a default admin user for dev mode (cpf/password = 00000000000 / password)
    const pwdHash = bcrypt.hashSync('password', 10);
    mem.users.push({ id: 1, name: 'Admin', cpf: '00000000000', password_hash: pwdHash, role: 'owner', created_at: new Date().toISOString() });
    console.log('DEV: seeded user cpf=00000000000 password=password');
  }
  if (!mem.production_records.length) {
    mem.production_records.push({ id: 1, tool_id: 1, machine: 'Maq-1', pieces: 120, entry_datetime: null, exit_datetime: null, created_at: new Date().toISOString() });
    mem.production_records.push({ id: 2, tool_id: 2, machine: 'Maq-2', pieces: 50, entry_datetime: null, exit_datetime: null, created_at: new Date().toISOString() });
  }
}

app.get('/api/stream', (req, res) => {
  // SSE endpoint
  res.writeHead(200, {
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });
  res.write('\n');
  sseClients.push(res);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// Tools
app.get('/api/tools', async (req, res) => {
  try {
    if (USE_IN_MEMORY) {
      return res.json(mem.tools);
    }
    const conn = await mysql.createConnection(DB_CONFIG);
    const [rows] = await conn.query('SELECT * FROM tools ORDER BY id');
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/tools', requireAuth, async (req, res) => {
  const { 
    code, 
    description, 
    brand,
    type,
    diameter,
    length,
    material,
    coating,
    max_rpm,
    cutting_edges,
    status,
    notes 
  } = req.body;

  // Validações básicas
  if (!code || !description) {
    return res.status(400).json({ error: 'Código e descrição são obrigatórios' });
  }

  // Validar código único
  try {
    if (!USE_IN_MEMORY) {
      const conn = await mysql.createConnection(DB_CONFIG);
      const [existing] = await conn.query('SELECT id FROM tools WHERE code = ?', [code]);
      await conn.end();
      if (existing.length > 0) {
        return res.status(400).json({ error: 'Já existe uma ferramenta com este código' });
      }
    } else if (mem.tools.find(t => t.code === code)) {
      return res.status(400).json({ error: 'Já existe uma ferramenta com este código' });
    }
  } catch (err) {
    console.error('Erro ao verificar código:', err);
    return res.status(500).json({ error: 'Erro ao verificar código' });
  }

  try {
    // Preparar objeto com dados da ferramenta
    const toolData = {
      code,
      description,
      brand: brand || null,
      type: type || null,
      diameter: diameter || null,
      length: length || null,
      material: material || null,
      coating: coating || null,
      max_rpm: max_rpm || null,
      cutting_edges: cutting_edges || null,
      status: status || 'active',
      notes: notes || null,
      created_at: new Date().toISOString()
    };

    if (USE_IN_MEMORY) {
      const created = { id: nextId(mem.tools), ...toolData };
      mem.tools.push(created);
      sendSSEEvent('tool_created', created);
      return res.json(created);
    }

    // Construir query SQL dinamicamente
    const fields = [];
    const values = [];
    const placeholders = [];

    // Adicionar campos não-nulos
    Object.entries(toolData).forEach(([key, value]) => {
      if (value !== null && key !== 'created_at') {
        fields.push(key);
        values.push(value);
        placeholders.push('?');
      }
    });

    const conn = await mysql.createConnection(DB_CONFIG);
    const query = `INSERT INTO tools (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`;
    const [result] = await conn.query(query, values);
    
    // Buscar a ferramenta criada com todos os campos
    const [rows] = await conn.query('SELECT * FROM tools WHERE id = ?', [result.insertId]);
    await conn.end();

    const created = rows[0];
    sendSSEEvent('tool_created', created);
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Delete a tool
// Atualizar uma ferramenta
app.put('/api/tools/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  const updates = req.body;
  
  // Remover campos que não podem ser atualizados
  delete updates.id;
  delete updates.created_at;
  delete updates.updated_at;

  try {
    if (USE_IN_MEMORY) {
      const index = mem.tools.findIndex(t => t.id === Number(id));
      if (index === -1) return res.status(404).json({ error: 'Ferramenta não encontrada' });
      
      // Se estiver atualizando o código, verificar se já existe
      if (updates.code && mem.tools.some(t => t.code === updates.code && t.id !== Number(id))) {
        return res.status(400).json({ error: 'Já existe uma ferramenta com este código' });
      }
      
      mem.tools[index] = { ...mem.tools[index], ...updates };
      sendSSEEvent('tool_updated', mem.tools[index]);
      return res.json(mem.tools[index]);
    }

    const conn = await mysql.createConnection(DB_CONFIG);
    
    // Se estiver atualizando o código, verificar se já existe
    if (updates.code) {
      const [existing] = await conn.query('SELECT id FROM tools WHERE code = ? AND id != ?', [updates.code, id]);
      if (existing.length > 0) {
        await conn.end();
        return res.status(400).json({ error: 'Já existe uma ferramenta com este código' });
      }
    }

    // Construir query de atualização
    const fields = [];
    const values = [];
    Object.entries(updates).forEach(([key, value]) => {
      fields.push(`${key} = ?`);
      values.push(value);
    });
    values.push(id);

    await conn.query(`UPDATE tools SET ${fields.join(', ')} WHERE id = ?`, values);
    
    // Buscar ferramenta atualizada
    const [rows] = await conn.query('SELECT * FROM tools WHERE id = ?', [id]);
    await conn.end();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ferramenta não encontrada' });
    }

    const updated = rows[0];
    sendSSEEvent('tool_updated', updated);
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar ferramenta' });
  }
});

// Buscar uma ferramenta específica
app.get('/api/tools/:id', async (req, res) => {
  const id = req.params.id;
  try {
    if (USE_IN_MEMORY) {
      const tool = mem.tools.find(t => t.id === Number(id));
      if (!tool) return res.status(404).json({ error: 'Ferramenta não encontrada' });
      return res.json(tool);
    }

    const conn = await mysql.createConnection(DB_CONFIG);
    const [rows] = await conn.query('SELECT * FROM tools WHERE id = ?', [id]);
    await conn.end();

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ferramenta não encontrada' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar ferramenta' });
  }
});

// Deletar uma ferramenta
app.delete('/api/tools/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    if (USE_IN_MEMORY) {
      const idx = mem.tools.findIndex(t => String(t.id) === String(id));
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      const removed = mem.tools.splice(idx, 1)[0];
      sendSSEEvent('tool_deleted', { id: Number(id) });
      return res.json({ success: true, id: Number(id), removed });
    }
    const conn = await mysql.createConnection(DB_CONFIG);
    const [result] = await conn.query('DELETE FROM tools WHERE id = ?', [id]);
    await conn.end();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    sendSSEEvent('tool_deleted', { id: Number(id) });
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// --- auth middleware to protect routes ---
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    console.warn('JWT verification failed', err && err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Records
app.get('/api/records', async (req, res) => {
  const { id, machine } = req.query;
  try {
    if (USE_IN_MEMORY) {
      let rows = mem.production_records.slice().sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
      if (id) rows = rows.filter(r=>String(r.id)===String(id));
      if (machine) rows = rows.filter(r=> (r.machine||'').includes(machine));
      return res.json(rows);
    }
    const conn = await mysql.createConnection(DB_CONFIG);
    let sql = 'SELECT * FROM production_records';
    const params = [];
    const clauses = [];
    if (id) {
      clauses.push('id = ?');
      params.push(id);
    }
    if (machine) {
      clauses.push('machine LIKE ?');
      params.push(`%${machine}%`);
    }
    if (clauses.length) sql += ' WHERE ' + clauses.join(' AND ');
    sql += ' ORDER BY created_at DESC';
    const [rows] = await conn.query(sql, params);
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/records', requireAuth, async (req, res) => {
  const { tool_id, machine, pieces, entry_datetime, exit_datetime } = req.body;
  if (!tool_id || !machine || pieces == null) return res.status(400).json({ error: 'tool_id, machine and pieces required' });
  try {
    if (USE_IN_MEMORY) {
      const created = { id: nextId(mem.production_records), tool_id, machine, pieces, entry_datetime, exit_datetime, created_at: new Date().toISOString() };
      mem.production_records.push(created);
      sendSSEEvent('record_created', created);
      return res.json(created);
    }
    const conn = await mysql.createConnection(DB_CONFIG);
    const [result] = await conn.query(
      'INSERT INTO production_records (tool_id, machine, pieces, entry_datetime, exit_datetime) VALUES (?, ?, ?, ?, ?)',
      [tool_id, machine, pieces, entry_datetime || null, exit_datetime || null]
    );
    await conn.end();
    const created = { id: result.insertId, tool_id, machine, pieces, entry_datetime, exit_datetime };
    sendSSEEvent('record_created', created);
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Delete a record
app.delete('/api/records/:id', requireAuth, async (req, res) => {
  const id = req.params.id;
  try {
    if (USE_IN_MEMORY) {
      const idx = mem.production_records.findIndex(r => String(r.id) === String(id));
      if (idx === -1) return res.status(404).json({ error: 'Not found' });
      mem.production_records.splice(idx, 1);
      sendSSEEvent('record_deleted', { id: Number(id) });
      return res.json({ success: true, id: Number(id) });
    }
    const conn = await mysql.createConnection(DB_CONFIG);
    const [result] = await conn.query('DELETE FROM production_records WHERE id = ?', [id]);
    await conn.end();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Not found' });
    sendSSEEvent('record_deleted', { id: Number(id) });
    res.json({ success: true, id: Number(id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// (POST /api/records is now protected above)

// Failures
app.get('/api/failures', async (req, res) => {
  try {
    if (USE_IN_MEMORY) {
      const rows = mem.tool_failures.slice().sort((a,b)=> new Date(b.created_at)-new Date(a.created_at));
      return res.json(rows);
    }
    const conn = await mysql.createConnection(DB_CONFIG);
    
    // Buscar falhas com informações da ferramenta e do operador
    const [rows] = await conn.query(`
      SELECT f.*, t.code as tool_code, t.description as tool_description, 
             u.name as operator_name
      FROM tool_failures f
      LEFT JOIN tools t ON f.tool_id = t.id
      LEFT JOIN users u ON f.operator_id = u.id
      ORDER BY f.created_at DESC
    `);
    
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar falhas' });
  }
});

app.post('/api/failures', requireAuth, async (req, res) => {
  const { 
    tool_id, 
    failure_datetime, 
    failure_type,
    severity,
    machine,
    operation_type,
    material_processed,
    cutting_parameters,
    reason,
    action_taken,
    maintenance_required 
  } = req.body;

  // Validações
  if (!tool_id) return res.status(400).json({ error: 'ID da ferramenta é obrigatório' });
  if (!reason) return res.status(400).json({ error: 'Motivo da falha é obrigatório' });
  if (!severity) return res.status(400).json({ error: 'Severidade da falha é obrigatória' });

  try {
    if (USE_IN_MEMORY) {
      const created = { 
        id: nextId(mem.tool_failures), 
        tool_id,
        operator_id: req.user.id,
        failure_datetime: failure_datetime || new Date(),
        failure_type: failure_type || null,
        severity,
        machine: machine || null,
        operation_type: operation_type || null,
        material_processed: material_processed || null,
        cutting_parameters: cutting_parameters || null,
        reason,
        action_taken: action_taken || null,
        maintenance_required: maintenance_required || false,
        created_at: new Date().toISOString()
      };
      mem.tool_failures.push(created);
      sendSSEEvent('failure_created', created);
      return res.json(created);
    }

    const conn = await mysql.createConnection(DB_CONFIG);
    const [result] = await conn.query(`
      INSERT INTO tool_failures (
        tool_id, operator_id, failure_datetime, failure_type,
        severity, machine, operation_type, material_processed,
        cutting_parameters, reason, action_taken, maintenance_required
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tool_id,
      req.user.id,
      failure_datetime || new Date(),
      failure_type || null,
      severity,
      machine || null,
      operation_type || null,
      material_processed || null,
      cutting_parameters || null,
      reason,
      action_taken || null,
      maintenance_required || false
    ]);

    // Buscar a falha criada com informações completas
    const [rows] = await conn.query(`
      SELECT f.*, t.code as tool_code, t.description as tool_description, 
             u.name as operator_name
      FROM tool_failures f
      LEFT JOIN tools t ON f.tool_id = t.id
      LEFT JOIN users u ON f.operator_id = u.id
      WHERE f.id = ?
    `, [result.insertId]);

    await conn.end();
    const created = rows[0];
    sendSSEEvent('failure_created', created);
    res.json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Auth: register / login
app.post('/api/register', async (req, res) => {
  const { name, cpf, password } = req.body;
  if (!name || !cpf || !password) return res.status(400).json({ error: 'name, cpf and password required' });

  // Validar nome
  if (name.trim().length < 3) return res.status(400).json({ error: 'Nome deve ter no mínimo 3 caracteres' });
  if (!/^[a-zA-ZÀ-ÿ\s]*$/.test(name)) return res.status(400).json({ error: 'Nome deve conter apenas letras' });

  // Validar CPF
  if (!validateCPF(cpf)) return res.status(400).json({ error: 'CPF inválido' });
    
  // Validar força da senha
  if (password.length < 8) return res.status(400).json({ error: 'Senha deve ter no mínimo 8 caracteres' });
  if (!/[a-zA-Z]/.test(password)) return res.status(400).json({ error: 'Senha deve conter letras' });
  if (!/[0-9]/.test(password)) return res.status(400).json({ error: 'Senha deve conter números' });
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return res.status(400).json({ error: 'Senha deve conter caracteres especiais' });
  try {
    const password_hash = await bcrypt.hash(password, 10);
    if (USE_IN_MEMORY) {
      // Verificar se CPF já existe
      if (mem.users.find(u => u.cpf === cpf)) {
        return res.status(400).json({ error: 'CPF já cadastrado' });
      }
      
      const user = { id: nextId(mem.users), name, cpf, password_hash, role: 'operator', created_at: new Date().toISOString() };
      mem.users.push(user);
      const token = jwt.sign({ id: user.id, name: user.name, cpf: user.cpf }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ user: { id: user.id, name: user.name, cpf: user.cpf }, token });
    }
    const conn = await mysql.createConnection(DB_CONFIG);
    
    // Verificar se CPF já existe
    const [existing] = await conn.query('SELECT id FROM users WHERE cpf = ?', [cpf]);
    if (existing.length > 0) {
      await conn.end();
      return res.status(400).json({ error: 'CPF já cadastrado' });
    }
    
    const [result] = await conn.query('INSERT INTO users (name, cpf, password_hash) VALUES (?, ?, ?)', [name, cpf, password_hash]);
    await conn.end();
    const user = { id: result.insertId, name, cpf };
    const token = jwt.sign({ id: user.id, name: user.name, cpf: user.cpf }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { cpf, password } = req.body;
  if (!cpf) return res.status(400).json({ error: 'CPF é obrigatório' });
  if (!password) return res.status(400).json({ error: 'Senha é obrigatória' });
  if (password.trim() === '') return res.status(400).json({ error: 'Senha não pode ser apenas espaços em branco' });

  // Validar CPF
  if (!validateCPF(cpf)) return res.status(400).json({ error: 'CPF inválido' });

  try {
    if (USE_IN_MEMORY) {
      const user = mem.users.find(u => u.cpf === cpf);
      if (!user) return res.status(401).json({ error: 'CPF ou senha incorretos' });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'CPF ou senha incorretos' });
      const token = jwt.sign({ id: user.id, name: user.name, cpf: user.cpf }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({ user: { id: user.id, name: user.name, cpf: user.cpf }, token });
    }
    let conn;
    try {
      conn = await mysql.createConnection(DB_CONFIG);
      const [rows] = await conn.query('SELECT id, name, cpf, password_hash FROM users WHERE cpf = ?', [cpf]);
      await conn.end();
      const user = rows[0];
      if (!user) return res.status(401).json({ error: 'CPF ou senha incorretos' });
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) return res.status(401).json({ error: 'CPF ou senha incorretos' });
      // sign token and return user + token
      const token = jwt.sign({ id: user.id, name: user.name, cpf: user.cpf }, JWT_SECRET, { expiresIn: '8h' });
      res.json({ user: { id: user.id, name: user.name, cpf: user.cpf }, token });
    } catch (err) {
      console.error('Database error:', err);
      if (conn) await conn.end();
      res.status(500).json({ error: 'Erro no banco de dados. Por favor, tente novamente.' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erro interno. Por favor, tente novamente.' });
  }
});

// Reports - summary and export (protected)
app.get('/api/reports/summary', requireAuth, async (req, res) => {
  const { period = 'day', tool_id } = req.query;
  const now = new Date();
  let since = new Date();
  if (period === 'day') since.setDate(now.getDate() - 1);
  else if (period === 'week') since.setDate(now.getDate() - 7);
  else if (period === 'month') since.setMonth(now.getMonth() - 1);
  else since = new Date(0);

  try {
    if (USE_IN_MEMORY) {
      // compute totals from in-memory arrays
      const sinceISO = since.toISOString();
      const filteredRecords = mem.production_records.filter((r) => new Date(r.created_at) >= since);
      const totals = {
        total_records: filteredRecords.length,
        total_pieces: filteredRecords.reduce((s, r) => s + (r.pieces || 0), 0),
      };

      // pieces per tool
      const pieces_by_tool = mem.tools.map((t) => {
        const pieces = mem.production_records
          .filter((p) => String(p.tool_id) === String(t.id) && new Date(p.created_at) >= since)
          .reduce((s, r) => s + (r.pieces || 0), 0);
        return { tool_id: t.id, code: t.code, description: t.description, pieces };
      }).sort((a, b) => b.pieces - a.pieces);

      // failures per tool
      const failures_count = {};
      mem.tool_failures
        .filter((f) => new Date(f.created_at) >= since)
        .forEach((f) => { failures_count[f.tool_id] = (failures_count[f.tool_id] || 0) + 1; });
      const failures_by_tool = Object.keys(failures_count).map((tid) => ({ tool_id: Number(tid), failures: failures_count[tid] }));

      return res.json({ period, since: sinceISO, totals, pieces_by_tool, failures_by_tool });
    }

    const conn = await mysql.createConnection(DB_CONFIG);

    // total records and total pieces
    const [totalsRows] = await conn.query(
      'SELECT COUNT(*) as total_records, COALESCE(SUM(pieces),0) as total_pieces FROM production_records WHERE created_at >= ?',
      [since]
    );

    const totals = totalsRows[0] || { total_records: 0, total_pieces: 0 };

    // pieces per tool
    let piecesSql = `SELECT t.id as tool_id, t.code, t.description, COALESCE(SUM(p.pieces),0) as pieces
      FROM tools t
      LEFT JOIN production_records p ON p.tool_id = t.id AND p.created_at >= ?`;
    const piecesParams = [since];
    if (tool_id) {
      piecesSql += ' WHERE t.id = ?';
      piecesParams.push(tool_id);
    }
    piecesSql += ' GROUP BY t.id ORDER BY pieces DESC';
    const [piecesRows] = await conn.query(piecesSql, piecesParams);

    // failures per tool
    let failuresSql = 'SELECT tool_id, COUNT(*) as failures FROM tool_failures WHERE created_at >= ?';
    const failuresParams = [since];
    if (tool_id) {
      failuresSql += ' AND tool_id = ?';
      failuresParams.push(tool_id);
    }
    failuresSql += ' GROUP BY tool_id';
    const [failuresRows] = await conn.query(failuresSql, failuresParams);

    await conn.end();

    res.json({
      period,
      since: since.toISOString(),
      totals,
      pieces_by_tool: piecesRows,
      failures_by_tool: failuresRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

app.get('/api/reports/export', requireAuth, async (req, res) => {
  // export CSV of records or failures
  const { period = 'day', tool_id, type = 'records' } = req.query;
  const now = new Date();
  let since = new Date();
  if (period === 'day') since.setDate(now.getDate() - 1);
  else if (period === 'week') since.setDate(now.getDate() - 7);
  else if (period === 'month') since.setMonth(now.getMonth() - 1);
  else since = new Date(0);

  try {
    if (USE_IN_MEMORY) {
      // generate CSV from in-memory data
      if (type === 'failures') {
        const rows = mem.tool_failures.filter((f) => new Date(f.created_at) >= since && (!tool_id || String(f.tool_id) === String(tool_id)));
        const header = ['id', 'tool_id', 'failure_datetime', 'reason', 'created_at'];
        const lines = [header.join(',')].concat(rows.map((r) => [r.id, r.tool_id, r.failure_datetime, `"${(r.reason || '').replace(/"/g, '""')}"`, r.created_at].join(',')));
        const csv = lines.join('\n');
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="failures_${period}.csv"`);
        return res.send(csv);
      }

      // default: records
      const rows = mem.production_records.filter((p) => new Date(p.created_at) >= since && (!tool_id || String(p.tool_id) === String(tool_id)));
      const header = ['id', 'tool_id', 'machine', 'pieces', 'entry_datetime', 'exit_datetime', 'created_at'];
      const lines = [header.join(',')].concat(rows.map((r) => [r.id, r.tool_id, `"${(r.machine||'').replace(/"/g,'""') }"`, r.pieces, r.entry_datetime || '', r.exit_datetime || '', r.created_at].join(',')));
      const csv = lines.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="records_${period}.csv"`);
      return res.send(csv);
    }

    const conn = await mysql.createConnection(DB_CONFIG);

    if (type === 'failures') {
      let sql = 'SELECT id, tool_id, failure_datetime, reason, created_at FROM tool_failures WHERE created_at >= ?';
      const params = [since];
      if (tool_id) {
        sql += ' AND tool_id = ?';
        params.push(tool_id);
      }
      const [rows] = await conn.query(sql, params);
      await conn.end();

      const header = ['id', 'tool_id', 'failure_datetime', 'reason', 'created_at'];
      const lines = [header.join(',')].concat(rows.map((r) => [r.id, r.tool_id, r.failure_datetime, `"${(r.reason || '').replace(/"/g, '""')}"`, r.created_at].join(',')));
      const csv = lines.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="failures_${period}.csv"`);
      return res.send(csv);
    }

    // default: records
    let sql = 'SELECT id, tool_id, machine, pieces, entry_datetime, exit_datetime, created_at FROM production_records WHERE created_at >= ?';
    const params = [since];
    if (tool_id) {
      sql += ' AND tool_id = ?';
      params.push(tool_id);
    }
    const [rows] = await conn.query(sql, params);
    await conn.end();

    const header = ['id', 'tool_id', 'machine', 'pieces', 'entry_datetime', 'exit_datetime', 'created_at'];
    const lines = [header.join(',')].concat(rows.map((r) => [r.id, r.tool_id, `"${(r.machine||'').replace(/"/g,'""') }"`, r.pieces, r.entry_datetime || '', r.exit_datetime || '', r.created_at].join(',')));
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="records_${period}.csv"`);
    return res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'DB error' });
  }
});

// Global error handlers to make debugging easier and keep the process informative
process.on('unhandledRejection', (reason, p) => {
  console.error('Unhandled Rejection at:', p, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
});

console.log('DEV_NO_DB mode:', USE_IN_MEMORY ? 'enabled' : 'disabled');
const PORT = process.env.PORT || 3001;

// Inicializar banco de dados antes de iniciar o servidor (espera síncrona)
(async () => {
  if (!USE_IN_MEMORY) {
    const success = await initializeDatabase(false);
    if (success) {
      console.log('Banco de dados inicializado com sucesso!');
    } else {
      console.error('AVISO: Erro ao inicializar banco de dados. Verifique se o MySQL está rodando.');
      console.log('Sugestões:');
      console.log('1. Inicie o MySQL no XAMPP Control Panel');
      console.log('2. Ou defina DEV_NO_DB=1 para usar modo sem banco de dados');
    }
  }

  app.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
})();
