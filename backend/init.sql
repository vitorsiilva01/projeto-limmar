-- SQL para criar o banco de dados e tabelas do sistema de Usinagem Limmar
CREATE DATABASE IF NOT EXISTS usinagemlimmar;
USE usinagemlimmar;

-- Tabela de usuários com diferentes níveis de acesso
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cpf VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'supervisor', 'operator') DEFAULT 'operator',
  active BOOLEAN DEFAULT TRUE,
  last_login DATETIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de ferramentas com informações detalhadas
CREATE TABLE IF NOT EXISTS tools (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255) NOT NULL,
  brand VARCHAR(100),
  type VARCHAR(100),
  diameter DECIMAL(10,2),
  length DECIMAL(10,2),
  material VARCHAR(100),
  coating VARCHAR(100),
  max_rpm INT,
  cutting_edges INT,
  location VARCHAR(100),
  status ENUM('active', 'inactive', 'maintenance', 'retired') DEFAULT 'active',
  total_life_cycles INT DEFAULT 0,
  max_life_cycles INT,
  last_maintenance DATETIME,
  next_maintenance DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de registros de produção com mais detalhes
CREATE TABLE IF NOT EXISTS production_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tool_id INT,
  operator_id INT,
  machine VARCHAR(100) NOT NULL,
  pieces INT NOT NULL,
  pieces_rejected INT DEFAULT 0,
  entry_datetime DATETIME,
  exit_datetime DATETIME,
  production_time INT, -- em minutos
  setup_time INT, -- em minutos
  status ENUM('in_progress', 'completed', 'interrupted') DEFAULT 'in_progress',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- Tabela de observações para registros de produção
CREATE TABLE IF NOT EXISTS production_observations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_id INT NOT NULL,
  user_id INT NOT NULL,
  observation TEXT NOT NULL,
  observation_type ENUM('quality', 'maintenance', 'general') DEFAULT 'general',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES production_records(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tabela de manutenções e falhas de ferramentas
CREATE TABLE IF NOT EXISTS tool_maintenance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tool_id INT NOT NULL,
  technician_id INT,
  maintenance_type ENUM('preventive', 'corrective', 'failure') NOT NULL,
  description TEXT NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME,
  cost DECIMAL(10,2),
  status ENUM('scheduled', 'in_progress', 'completed') DEFAULT 'scheduled',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (technician_id) REFERENCES users(id)
);

-- Tabela de falhas de ferramentas (compatível com backend)
CREATE TABLE IF NOT EXISTS tool_failures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tool_id INT NOT NULL,
  operator_id INT,
  failure_datetime DATETIME NOT NULL,
  failure_type VARCHAR(100),
  severity ENUM('low','medium','high') NOT NULL,
  machine VARCHAR(100),
  operation_type VARCHAR(100),
  material_processed VARCHAR(100),
  cutting_parameters TEXT,
  reason TEXT NOT NULL,
  action_taken TEXT,
  maintenance_required BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
);

-- Tabela para métricas e KPIs
CREATE TABLE IF NOT EXISTS production_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  record_id INT NOT NULL,
  oee DECIMAL(5,2), -- Overall Equipment Effectiveness
  availability DECIMAL(5,2),
  performance DECIMAL(5,2),
  quality DECIMAL(5,2),
  cycle_time DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES production_records(id)
);

-- Tabela de histórico de status das ferramentas
CREATE TABLE IF NOT EXISTS tool_status_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tool_id INT NOT NULL,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_by INT,
  change_reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tool_id) REFERENCES tools(id),
  FOREIGN KEY (changed_by) REFERENCES users(id)
);
