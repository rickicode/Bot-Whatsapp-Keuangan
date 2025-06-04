#!/bin/bash

# WhatsApp Financial Bot API Test Script
# Make testing API endpoints easier with bash wrapper

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
API_SCRIPT="$SCRIPT_DIR/test-api.js"
BASE_URL="${BASE_URL:-http://localhost:3000}"

# Check if .env file exists
if [ ! -f "$SCRIPT_DIR/../.env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env file with API_KEY"
    exit 1
fi

# Load environment variables
source "$SCRIPT_DIR/../.env" 2>/dev/null || true

# Check if API_KEY is set
if [ -z "$API_KEY" ]; then
    echo -e "${RED}❌ API_KEY not found in environment${NC}"
    echo "Please set API_KEY in your .env file"
    exit 1
fi

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if Node.js is available
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
}

# Check if API script exists
check_script() {
    if [ ! -f "$API_SCRIPT" ]; then
        log_error "API test script not found: $API_SCRIPT"
        exit 1
    fi
}

# Check if server is running
check_server() {
    log_info "Checking if server is running on $BASE_URL..."
    if curl -s -f "$BASE_URL/health" > /dev/null 2>&1; then
        log_success "Server is running"
        return 0
    else
        log_error "Server is not running on $BASE_URL"
        log_info "Please start the server with: npm start"
        return 1
    fi
}

# Show help
show_help() {
    echo -e "${BLUE}🧪 WhatsApp Financial Bot API Test Helper${NC}"
    echo ""
    echo "Usage: $0 [command] [arguments...]"
    echo ""
    echo "Commands:"
    echo "  full <phone>              Run full test suite"
    echo "  health                    Check application health"
    echo "  connect                   Test API connection"
    echo "  send <phone> <message>    Send test message"
    echo "  stats                     Get API statistics"
    echo "  history                   Get message history"
    echo "  webhook-payment <phone>   Test payment webhook"
    echo "  webhook-reminder <phone>  Test reminder webhook"
    echo "  server-check             Check if server is running"
    echo "  quick <phone>            Quick test (health + connect + send)"
    echo ""
    echo "Examples:"
    echo "  $0 full 6281234567890"
    echo "  $0 send 6281234567890 \"Hello from API!\""
    echo "  $0 webhook-payment 6281234567890"
    echo "  $0 quick 6281234567890"
    echo ""
    echo "Environment:"
    echo "  API_KEY: ${API_KEY:0:10}... (${#API_KEY} chars)"
    echo "  BASE_URL: $BASE_URL"
}

# Quick test function
quick_test() {
    local phone=$1
    if [ -z "$phone" ]; then
        log_error "Phone number required for quick test"
        echo "Usage: $0 quick <phone_number>"
        exit 1
    fi

    echo -e "${BLUE}🚀 Running Quick API Test for $phone${NC}"
    echo "=================================="

    # Check server
    if ! check_server; then
        exit 1
    fi

    # Run tests
    log_info "1. Testing API connection..."
    node "$API_SCRIPT" connect

    log_info "2. Checking health..."
    node "$API_SCRIPT" health

    log_info "3. Sending test message..."
    node "$API_SCRIPT" send "$phone" "🧪 Quick test message from API - $(date)"

    log_info "4. Getting API stats..."
    node "$API_SCRIPT" stats

    log_success "Quick test completed!"
}

# Interactive mode
interactive_mode() {
    echo -e "${BLUE}🧪 WhatsApp Financial Bot API - Interactive Mode${NC}"
    echo "=================================================="

    # Check server first
    if ! check_server; then
        read -p "Server not running. Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    while true; do
        echo ""
        echo "Select a test to run:"
        echo "1) Health Check"
        echo "2) API Connection Test"
        echo "3) Send Message"
        echo "4) Send Broadcast"
        echo "5) Payment Webhook"
        echo "6) Reminder Webhook"
        echo "7) API Statistics"
        echo "8) Message History"
        echo "9) Full Test Suite"
        echo "0) Exit"
        echo ""
        read -p "Enter your choice (0-9): " choice

        case $choice in
            1)
                node "$API_SCRIPT" health
                ;;
            2)
                node "$API_SCRIPT" connect
                ;;
            3)
                read -p "Enter phone number: " phone
                read -p "Enter message: " message
                node "$API_SCRIPT" send "$phone" "$message"
                ;;
            4)
                read -p "Enter phone numbers (comma-separated): " phones
                read -p "Enter message: " message
                # Convert comma-separated to space-separated for the script
                IFS=',' read -ra PHONE_ARRAY <<< "$phones"
                node "$API_SCRIPT" send "${PHONE_ARRAY[@]}" "$message"
                ;;
            5)
                read -p "Enter phone number: " phone
                node "$API_SCRIPT" webhook-payment "$phone"
                ;;
            6)
                read -p "Enter phone number: " phone
                node "$API_SCRIPT" webhook-reminder "$phone"
                ;;
            7)
                node "$API_SCRIPT" stats
                ;;
            8)
                node "$API_SCRIPT" history
                ;;
            9)
                read -p "Enter phone number for full test: " phone
                node "$API_SCRIPT" test "$phone"
                ;;
            0)
                log_info "Goodbye!"
                break
                ;;
            *)
                log_error "Invalid choice. Please enter 0-9."
                ;;
        esac
    done
}

# Main script logic
main() {
    check_node
    check_script

    local command=$1
    shift || true

    case $command in
        "full"|"test")
            node "$API_SCRIPT" test "$@"
            ;;
        "health")
            node "$API_SCRIPT" health
            ;;
        "connect")
            node "$API_SCRIPT" connect
            ;;
        "send")
            node "$API_SCRIPT" send "$@"
            ;;
        "stats")
            node "$API_SCRIPT" stats
            ;;
        "history")
            node "$API_SCRIPT" history
            ;;
        "webhook-payment")
            node "$API_SCRIPT" webhook-payment "$@"
            ;;
        "webhook-reminder")
            node "$API_SCRIPT" webhook-reminder "$@"
            ;;
        "server-check")
            check_server
            ;;
        "quick")
            quick_test "$@"
            ;;
        "interactive"|"i")
            interactive_mode
            ;;
        "help"|"-h"|"--help"|"")
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"