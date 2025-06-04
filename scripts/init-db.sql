-- PostgreSQL Database Initialization Script
-- WhatsApp Financial Bot

-- Create database (if not exists)
-- This will be handled by Docker environment variables

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    phone VARCHAR(20) PRIMARY KEY,
    name VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Asia/Jakarta',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(10) CHECK(type IN ('income', 'expense')) NOT NULL,
    color VARCHAR(10) DEFAULT '#007bff',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    UNIQUE(user_phone, name, type)
);

-- Create transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    type VARCHAR(10) CHECK(type IN ('income', 'expense')) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    description TEXT,
    category_id INTEGER,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    UNIQUE(user_phone, name)
);

-- Create debts table
CREATE TABLE IF NOT EXISTS debts (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    client_id INTEGER NOT NULL,
    type VARCHAR(15) CHECK(type IN ('receivable', 'payable')) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    paid_amount NUMERIC(15,2) DEFAULT 0,
    description TEXT,
    due_date DATE,
    status VARCHAR(15) CHECK(status IN ('pending', 'partial', 'paid', 'overdue')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- Create bills table
CREATE TABLE IF NOT EXISTS bills (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    category_id INTEGER,
    due_date DATE NOT NULL,
    frequency VARCHAR(15) CHECK(frequency IN ('monthly', 'weekly', 'yearly', 'one-time')) DEFAULT 'monthly',
    next_reminder DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone),
    UNIQUE(user_phone, setting_key)
);

-- Create AI interactions table
CREATE TABLE IF NOT EXISTS ai_interactions (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    prompt TEXT NOT NULL,
    response TEXT,
    type VARCHAR(50) DEFAULT 'general',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_phone, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_status ON debts(user_phone, status);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON debts(due_date);
CREATE INDEX IF NOT EXISTS idx_bills_user_active ON bills(user_phone, is_active);
CREATE INDEX IF NOT EXISTS idx_bills_next_reminder ON bills(next_reminder);

-- Insert default categories (dalam bahasa Indonesia)
INSERT INTO categories (user_phone, name, type, color) VALUES
-- Income categories
('default', 'Gaji', 'income', '#28a745'),
('default', 'Freelance', 'income', '#17a2b8'),
('default', 'Bisnis', 'income', '#007bff'),
('default', 'Investasi', 'income', '#6f42c1'),
('default', 'Pemasukan Lain', 'income', '#20c997'),

-- Expense categories
('default', 'Makanan', 'expense', '#fd7e14'),
('default', 'Transportasi', 'expense', '#6c757d'),
('default', 'Utilitas', 'expense', '#e83e8c'),
('default', 'Hiburan', 'expense', '#dc3545'),
('default', 'Kesehatan', 'expense', '#ffc107'),
('default', 'Belanja', 'expense', '#198754'),
('default', 'Pengeluaran Bisnis', 'expense', '#0d6efd'),
('default', 'Pengeluaran Lain', 'expense', '#6c757d')
ON CONFLICT (user_phone, name, type) DO NOTHING;

-- Add update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create WhatsApp sessions table
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    client_id VARCHAR(100) PRIMARY KEY,
    session_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster session lookups
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated ON whatsapp_sessions(updated_at);

-- Completed PostgreSQL initialization