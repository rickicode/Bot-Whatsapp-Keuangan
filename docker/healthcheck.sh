#!/bin/bash

# Docker Health Check Script for KasAI WhatsApp Bot
# This script performs comprehensive health checks for the application

set -e

# Configuration
HEALTH_URL="http://localhost:3000/health"
TIMEOUT=10
MAX_RETRIES=3
RETRY_DELAY=2

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log_error() {
    log "${RED}ERROR: $1${NC}"
}

log_success() {
    log "${GREEN}SUCCESS: $1${NC}"
}

log_warning() {
    log "${YELLOW}WARNING: $1${NC}"
}

# Function to check if port is listening
check_port() {
    local port=$1
    if netstat -tuln 2>/dev/null | grep -q ":${port} " || ss -tuln 2>/dev/null | grep -q ":${port} "; then
        return 0
    else
        return 1
    fi
}

# Function to perform HTTP health check
http_health_check() {
    local attempt=1
    
    while [ $attempt -le $MAX_RETRIES ]; do
        log "Health check attempt ${attempt}/${MAX_RETRIES}..."
        
        # Use curl if available, otherwise use wget
        if command -v curl >/dev/null 2>&1; then
            response=$(curl -s -w "%{http_code}" --max-time $TIMEOUT "$HEALTH_URL" 2>/dev/null || echo "000")
            http_code="${response: -3}"
            body="${response%???}"
        elif command -v wget >/dev/null 2>&1; then
            temp_file=$(mktemp)
            if wget -q --timeout=$TIMEOUT -O "$temp_file" "$HEALTH_URL" 2>/dev/null; then
                http_code="200"
                body=$(cat "$temp_file")
            else
                http_code="000"
                body=""
            fi
            rm -f "$temp_file"
        else
            log_error "Neither curl nor wget available for health check"
            return 1
        fi
        
        # Check HTTP status code
        case $http_code in
            200)
                log_success "HTTP health check passed (200 OK)"
                
                # Parse JSON response if available
                if echo "$body" | grep -q '"status"'; then
                    status=$(echo "$body" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
                    case $status in
                        "healthy")
                            log_success "Application status: healthy"
                            return 0
                            ;;
                        "degraded")
                            log_warning "Application status: degraded (still functional)"
                            return 0
                            ;;
                        *)
                            log_error "Application status: $status"
                            ;;
                    esac
                else
                    log_success "Health endpoint responded successfully"
                    return 0
                fi
                ;;
            503)
                log_warning "Service unavailable (503) - may be starting up"
                return 0
                ;;
            000)
                log_error "Connection failed to $HEALTH_URL"
                ;;
            *)
                log_error "HTTP health check failed with status: $http_code"
                ;;
        esac
        
        if [ $attempt -lt $MAX_RETRIES ]; then
            log "Retrying in ${RETRY_DELAY} seconds..."
            sleep $RETRY_DELAY
        fi
        
        attempt=$((attempt + 1))
    done
    
    return 1
}

# Function to check application processes
check_processes() {
    log "Checking application processes..."
    
    # Check if Node.js process is running
    if pgrep -f "node.*src/index.js" >/dev/null 2>&1; then
        log_success "Node.js application process is running"
        return 0
    else
        log_error "Node.js application process not found"
        return 1
    fi
}

# Function to check memory usage
check_memory() {
    log "Checking memory usage..."
    
    # Get memory info
    if [ -f /proc/meminfo ]; then
        mem_total=$(grep MemTotal /proc/meminfo | awk '{print $2}')
        mem_available=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
        mem_usage_percent=$(( (mem_total - mem_available) * 100 / mem_total ))
        
        log "Memory usage: ${mem_usage_percent}%"
        
        if [ $mem_usage_percent -gt 90 ]; then
            log_warning "High memory usage: ${mem_usage_percent}%"
        else
            log_success "Memory usage is acceptable: ${mem_usage_percent}%"
        fi
    else
        log_warning "Unable to check memory usage"
    fi
}

# Function to check disk space
check_disk_space() {
    log "Checking disk space..."
    
    # Check disk usage for current directory
    disk_usage=$(df . 2>/dev/null | tail -1 | awk '{print $5}' | sed 's/%//')
    
    if [ -n "$disk_usage" ]; then
        log "Disk usage: ${disk_usage}%"
        
        if [ "$disk_usage" -gt 90 ]; then
            log_warning "High disk usage: ${disk_usage}%"
        else
            log_success "Disk usage is acceptable: ${disk_usage}%"
        fi
    else
        log_warning "Unable to check disk usage"
    fi
}

# Main health check function
main() {
    log "Starting comprehensive health check..."
    
    # Check if port 3000 is listening
    log "Checking if application port is listening..."
    if check_port 3000; then
        log_success "Port 3000 is listening"
    else
        log_error "Port 3000 is not listening"
        exit 1
    fi
    
    # Perform HTTP health check
    if http_health_check; then
        log_success "HTTP health check passed"
    else
        log_error "HTTP health check failed"
        exit 1
    fi
    
    # Additional checks (non-critical)
    check_processes || true
    check_memory || true
    check_disk_space || true
    
    log_success "All health checks completed successfully"
    exit 0
}

# Run main function
main "$@"