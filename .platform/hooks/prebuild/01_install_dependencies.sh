#!/bin/bash

# Install system dependencies
yum update -y
yum install -y git sqlite postgresql15 python3 make gcc-c++

# Create application directories
mkdir -p /var/app/current/data
mkdir -p /var/app/current/data/sessions  
mkdir -p /var/app/current/logs
mkdir -p /var/app/current/backups

# Set permissions
chmod 755 /var/app/current/data
chmod 755 /var/app/current/data/sessions
chmod 755 /var/app/current/logs
chmod 755 /var/app/current/backups