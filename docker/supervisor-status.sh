#!/bin/bash

# Supervisor status check script for EasyPanel

echo "📊 Supervisor Status:"
supervisorctl status

echo ""
echo "🔍 Process Status:"
ps aux | grep -E "(supervisord|node|cleanup|monitor)" | grep -v grep

echo ""
echo "📝 Recent Application Logs:"
echo "Check Docker logs for all service output:"
echo "  docker logs whatsapp-bot-easypanel"
echo ""
echo "Or use NPM command:"
echo "  npm run easypanel:logs"
echo ""
echo "🔧 Service Management:"
echo "  supervisorctl restart whatsapp-bot     # Restart main bot"
echo "  supervisorctl restart antispam-monitor # Restart anti-spam"
echo "  supervisorctl restart session-cleanup  # Restart cleanup"
echo "  supervisorctl stop <service>           # Stop service"
echo "  supervisorctl start <service>          # Start service"