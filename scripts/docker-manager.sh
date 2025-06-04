#!/bin/bash

# Docker Manager Script for WhatsApp Financial Bot
# Provides easy management of Docker deployment with various profiles

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="financial-bot"

# Print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

print_header() {
    echo
    print_color $BLUE "🐳 WhatsApp Financial Bot - Docker Manager"
    print_color $BLUE "============================================"
    echo
}

print_usage() {
    print_header
    echo "Usage: $0 [command] [options]"
    echo
    echo "Commands:"
    echo "  start [profile]       - Start services with optional profile"
    echo "  stop                  - Stop all services"
    echo "  restart [profile]     - Restart services with optional profile"
    echo "  logs [service]        - Show logs for service (default: whatsapp-bot)"
    echo "  status                - Show status of all services"
    echo "  health                - Check health of main bot service"
    echo "  monitor               - Start monitoring dashboard"
    echo "  backup                - Start backup service"
    echo "  cleanup               - Start cleanup service"
    echo "  logs-viewer           - Start web log viewer (Dozzle)"
    echo "  update                - Update and restart services"
    echo "  reset                 - Reset all data (DANGEROUS)"
    echo "  build                 - Rebuild Docker images"
    echo
    echo "Profiles:"
    echo "  basic                 - Bot + Database only (default)"
    echo "  monitoring            - + Anti-spam monitoring"
    echo "  backup                - + Database backup service"
    echo "  cleanup               - + Session cleanup service"
    echo "  logs                  - + Web log viewer"
    echo "  auto-update           - + Automatic updates"
    echo "  full                  - All services"
    echo
    echo "Examples:"
    echo "  $0 start              # Start basic services"
    echo "  $0 start monitoring   # Start with monitoring"
    echo "  $0 start full         # Start all services"
    echo "  $0 logs whatsapp-bot  # Show bot logs"
    echo "  $0 health             # Check bot health"
    echo "  $0 monitor            # Real-time monitoring"
}

# Check if Docker and Docker Compose are available
check_dependencies() {
    if ! command -v docker &> /dev/null; then
        print_color $RED "❌ Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_color $RED "❌ Docker Compose is not installed or not in PATH"
        exit 1
    fi

    # Use docker compose if available, fallback to docker-compose
    if docker compose version &> /dev/null; then
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
}

# Get profile arguments
get_profile_args() {
    local profile=$1
    case $profile in
        "monitoring")
            echo "--profile monitoring"
            ;;
        "backup")
            echo "--profile backup"
            ;;
        "cleanup")
            echo "--profile cleanup"
            ;;
        "logs")
            echo "--profile logs"
            ;;
        "auto-update")
            echo "--profile auto-update"
            ;;
        "full")
            echo "--profile monitoring --profile backup --profile cleanup --profile logs"
            ;;
        "basic"|"")
            echo ""
            ;;
        *)
            print_color $YELLOW "⚠️ Unknown profile: $profile, using basic"
            echo ""
            ;;
    esac
}

# Start services
start_services() {
    local profile=$1
    local profile_args=$(get_profile_args $profile)
    
    print_color $GREEN "🚀 Starting WhatsApp Financial Bot..."
    if [ ! -z "$profile" ]; then
        print_color $BLUE "📋 Profile: $profile"
    fi
    
    # Check if .env file exists
    if [ ! -f ".env" ]; then
        print_color $YELLOW "⚠️ No .env file found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            print_color $GREEN "✅ Created .env file from .env.example"
            print_color $YELLOW "📝 Please edit .env file with your configuration"
        else
            print_color $RED "❌ No .env.example found"
            exit 1
        fi
    fi

    # Create required directories
    print_color $BLUE "📁 Creating required directories..."
    mkdir -p data data/sessions logs backups

    # Start services
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME up -d $profile_args

    print_color $GREEN "✅ Services started successfully!"
    
    # Show status
    sleep 3
    show_status
    
    # Show useful URLs
    echo
    print_color $BLUE "🔗 Access URLs:"
    print_color $NC "   Bot Health:    http://localhost:3000/health"
    print_color $NC "   QR Code:       http://localhost:3000/qrscan"
    print_color $NC "   Anti-spam:     http://localhost:3000/anti-spam/stats"
    if [[ "$profile_args" == *"logs"* ]]; then
        print_color $NC "   Log Viewer:    http://localhost:8080"
    fi
    echo
}

# Stop services
stop_services() {
    print_color $YELLOW "🛑 Stopping WhatsApp Financial Bot services..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME down
    print_color $GREEN "✅ All services stopped"
}

# Restart services
restart_services() {
    local profile=$1
    print_color $BLUE "🔄 Restarting services..."
    stop_services
    sleep 2
    start_services $profile
}

# Show logs
show_logs() {
    local service=${1:-whatsapp-bot}
    print_color $BLUE "📋 Showing logs for: $service"
    print_color $YELLOW "Press Ctrl+C to exit"
    echo
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME logs -f $service
}

# Show status
show_status() {
    print_color $BLUE "📊 Service Status:"
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME ps
}

# Check health
check_health() {
    print_color $BLUE "🏥 Checking bot health..."
    
    if curl -s http://localhost:3000/health > /dev/null; then
        local health_data=$(curl -s http://localhost:3000/health | jq -r '.status // "UNKNOWN"')
        case $health_data in
            "OK")
                print_color $GREEN "✅ Bot is healthy"
                ;;
            "DEGRADED")
                print_color $YELLOW "⚠️ Bot is degraded"
                ;;
            "CRITICAL")
                print_color $RED "🚨 Bot is in critical state"
                ;;
            *)
                print_color $YELLOW "⚠️ Bot health unknown: $health_data"
                ;;
        esac
        
        # Show detailed health info
        curl -s http://localhost:3000/health | jq '.' 2>/dev/null || echo "Health data not available in JSON format"
    else
        print_color $RED "❌ Bot health endpoint not accessible"
        print_color $YELLOW "🔍 Checking if container is running..."
        $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME ps whatsapp-bot
    fi
}

# Start monitoring
start_monitoring() {
    print_color $BLUE "📊 Starting real-time monitoring..."
    print_color $YELLOW "Press Ctrl+C to exit"
    echo
    
    if docker exec -it "${PROJECT_NAME}-whatsapp-bot-1" node scripts/anti-spam-monitor.js monitor 2>/dev/null; then
        echo
    else
        print_color $YELLOW "⚠️ Monitoring from container failed, trying local monitoring..."
        if [ -f "scripts/anti-spam-monitor.js" ]; then
            node scripts/anti-spam-monitor.js monitor
        else
            print_color $RED "❌ Monitoring script not found"
        fi
    fi
}

# Update services
update_services() {
    print_color $BLUE "🔄 Updating services..."
    
    # Pull latest images
    print_color $BLUE "📥 Pulling latest images..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME pull
    
    # Rebuild custom images
    print_color $BLUE "🔨 Rebuilding bot image..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache whatsapp-bot
    
    # Restart services
    print_color $BLUE "🔄 Restarting services..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME up -d
    
    print_color $GREEN "✅ Update completed"
    show_status
}

# Reset all data (DANGEROUS)
reset_data() {
    print_color $RED "⚠️ WARNING: This will delete ALL data including:"
    print_color $RED "   - WhatsApp sessions"
    print_color $RED "   - Database data"
    print_color $RED "   - Logs"
    print_color $RED "   - Backups"
    echo
    read -p "Are you sure? Type 'RESET' to confirm: " confirm
    
    if [ "$confirm" != "RESET" ]; then
        print_color $YELLOW "❌ Reset cancelled"
        return
    fi
    
    print_color $YELLOW "🛑 Stopping all services..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME down -v
    
    print_color $YELLOW "🗑️ Removing data directories..."
    rm -rf data logs backups
    
    print_color $YELLOW "🐳 Removing Docker volumes..."
    docker volume rm ${PROJECT_NAME}_postgres_data 2>/dev/null || true
    
    print_color $GREEN "✅ Reset completed"
    print_color $BLUE "💡 Run '$0 start' to initialize fresh services"
}

# Build images
build_images() {
    print_color $BLUE "🔨 Building Docker images..."
    $DOCKER_COMPOSE -f $COMPOSE_FILE -p $PROJECT_NAME build --no-cache
    print_color $GREEN "✅ Build completed"
}

# Main script
main() {
    local command=$1
    local option=$2
    
    # Check dependencies
    check_dependencies
    
    case $command in
        "start")
            start_services $option
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services $option
            ;;
        "logs")
            show_logs $option
            ;;
        "status")
            show_status
            ;;
        "health")
            check_health
            ;;
        "monitor")
            start_monitoring
            ;;
        "backup")
            start_services "backup"
            ;;
        "cleanup")
            start_services "cleanup"
            ;;
        "logs-viewer")
            start_services "logs"
            ;;
        "update")
            update_services
            ;;
        "reset")
            reset_data
            ;;
        "build")
            build_images
            ;;
        "help"|"--help"|"-h"|"")
            print_usage
            ;;
        *)
            print_color $RED "❌ Unknown command: $command"
            print_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"