#!/bin/bash

# Error self-correction: Save crash logs for agent to learn from
CRASH_LOG="workspace/last_crash.log"

echo "🚀 Launching 'The Last' Agent (Hybrid Mode)..."
echo "🧠 Connecting to Host Brain at host.docker.internal..."

while true; do
    # Run and capture stderr to crash log
    npm start 2>&1 | tee "$CRASH_LOG"
    EXIT_CODE=${PIPESTATUS[0]}
    
    if [ $EXIT_CODE -ne 0 ]; then
        echo "⚠️ Agent crashed with code $EXIT_CODE. Crash log saved to $CRASH_LOG"
        # Keep only last 100 lines to avoid huge files
        tail -100 "$CRASH_LOG" > "${CRASH_LOG}.tmp" && mv "${CRASH_LOG}.tmp" "$CRASH_LOG"
    else
        # Clean exit, remove crash log
        rm -f "$CRASH_LOG"
    fi
    
    echo "🔄 Restarting in 2 seconds..."
    sleep 2
done
