#!/bin/bash

# Set executable permissions for scripts
chmod +x /var/app/current/scripts/create-env.js

# Create .env file from environment variables
cd /var/app/current
node scripts/create-env.js

# Setup database if needed
if [ -f "scripts/setup-database.js" ]; then
    node scripts/setup-database.js
fi

echo "Application setup completed"