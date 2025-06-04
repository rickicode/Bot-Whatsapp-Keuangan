#!/bin/bash
set -e

# Health check script for EasyPanel deployment

# Check if supervisord is running
if ! pgrep -f supervisord >/dev/null; then
    echo "❌ Supervisord not running"
    exit 1
fi

# Check if main bot process is running
if ! pgrep -f "node src/index.js" >/dev/null; then
    echo "❌ Main bot process not running"
    exit 1
fi

# Check if bot HTTP endpoint is responding
if ! curl -f http://localhost:3000/health >/dev/null 2>&1; then
    echo "❌ Bot health endpoint not responding"
    exit 1
fi

echo "✅ EasyPanel health check passed"
exit 0