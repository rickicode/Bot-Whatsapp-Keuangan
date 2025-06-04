-- Additional tables for user registration and subscription management
-- WhatsApp Financial Bot with Indonesian AI Assistant

-- Add new fields to existing users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create registration sessions table for managing multi-step registration
CREATE TABLE IF NOT EXISTS registration_sessions (
    id SERIAL PRIMARY KEY,
    phone VARCHAR(20) NOT NULL,
    step VARCHAR(20) NOT NULL DEFAULT 'name', -- name, email, city, completed
    session_data JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours'),
    UNIQUE(phone)
);

-- Create subscription plans table
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- free, premium
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_transaction_limit INTEGER DEFAULT NULL, -- NULL = unlimited
    price_monthly NUMERIC(10,2) DEFAULT 0,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user subscriptions table
CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    user_phone VARCHAR(20) NOT NULL,
    plan_id INTEGER NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- active, expired, cancelled
    transaction_count INTEGER DEFAULT 0,
    subscription_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_end TIMESTAMP,
    payment_status VARCHAR(20) DEFAULT 'free', -- free, paid, pending
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_phone) REFERENCES users(phone) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id),
    UNIQUE(user_phone)
);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, monthly_transaction_limit, price_monthly, features) VALUES
('free', 'Free Plan', 'Plan gratis dengan fitur dasar', 10, 0, '["input_transaksi", "laporan_bulanan", "saldo_check"]'),
('premium', 'Premium Plan', 'Plan premium dengan fitur lengkap', NULL, 50000, '["unlimited_transaksi", "laporan_advanced", "ai_analysis", "export_data", "priority_support"]')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_registration_sessions_phone ON registration_sessions(phone);
CREATE INDEX IF NOT EXISTS idx_registration_sessions_expires ON registration_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_phone ON user_subscriptions(user_phone);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);

-- Create function to cleanup expired registration sessions
CREATE OR REPLACE FUNCTION cleanup_expired_registration_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM registration_sessions WHERE expires_at < CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to update subscription updated_at
CREATE TRIGGER update_user_subscriptions_updated_at BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add validation check for registration completion
ALTER TABLE users ADD CONSTRAINT check_registration_completed 
    CHECK (
        (registration_completed = false) OR 
        (registration_completed = true AND name IS NOT NULL AND email IS NOT NULL AND city IS NOT NULL)
    );