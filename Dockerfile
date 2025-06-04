FROM node:20-alpine

# Install system dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    postgresql-client \
    vips-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with engine check bypass
RUN npm install

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p data data/sessions logs backups

# Create .env from environment variables (simple approach)
RUN echo "# Docker environment" > .env && \
    echo "NODE_ENV=${NODE_ENV:-production}" >> .env && \
    echo "DATABASE_TYPE=${DATABASE_TYPE:-sqlite3}" >> .env && \
    echo "DB_PATH=${DB_PATH:-./data/financial.db}" >> .env && \
    echo "BOT_NAME=${BOT_NAME:-Financial Bot}" >> .env && \
    echo "BOT_ADMIN_PHONE=${BOT_ADMIN_PHONE}" >> .env && \
    echo "DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}" >> .env && \
    echo "DEEPSEEK_BASE_URL=${DEEPSEEK_BASE_URL:-https://api.deepseek.com}" >> .env && \
    echo "DEEPSEEK_MODEL=${DEEPSEEK_MODEL:-deepseek-chat}" >> .env && \
    echo "OPENAI_API_KEY=${OPENAI_API_KEY}" >> .env && \
    echo "OPENAI_BASE_URL=${OPENAI_BASE_URL}" >> .env && \
    echo "OPENAI_MODEL=${OPENAI_MODEL}" >> .env && \
    echo "OPENAI_COMPATIBLE_API_KEY=${OPENAI_COMPATIBLE_API_KEY}" >> .env && \
    echo "OPENAI_COMPATIBLE_BASE_URL=${OPENAI_COMPATIBLE_BASE_URL}" >> .env && \
    echo "OPENAI_COMPATIBLE_MODEL=${OPENAI_COMPATIBLE_MODEL}" >> .env && \
    echo "AI_PROVIDER=${AI_PROVIDER:-deepseek}" >> .env && \
    echo "SUPABASE_DB_URL=${SUPABASE_DB_URL}" >> .env && \
    echo "PORT=${PORT:-3000}" >> .env && \
    echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >> .env && \
    echo "USER_ADMIN=${USER_ADMIN}" >> .env && \
    echo "DEFAULT_LANGUAGE=${DEFAULT_LANGUAGE:-id}" >> .env && \
    echo "DEFAULT_CURRENCY=${DEFAULT_CURRENCY:-IDR}" >> .env && \
    echo "CURRENCY_SYMBOL=${CURRENCY_SYMBOL:-Rp}" >> .env && \
    echo "ENABLE_AI_FEATURES=${ENABLE_AI_FEATURES:-true}" >> .env && \
    echo "ENABLE_OCR=${ENABLE_OCR:-true}" >> .env && \
    echo "ENABLE_REMINDERS=${ENABLE_REMINDERS:-true}" >> .env && \
    echo "ASK_CATEGORY_IF_UNKNOWN=${ASK_CATEGORY_IF_UNKNOWN:-true}" >> .env && \
    echo "TZ=${TZ:-Asia/Jakarta}" >> .env && \
    echo "LOG_LEVEL=${LOG_LEVEL:-info}" >> .env && \
    echo "LOG_FILE=${LOG_FILE:-./logs/app.log}" >> .env

# Expose port
EXPOSE 3000

# Start the application directly
CMD ["npm", "start"]