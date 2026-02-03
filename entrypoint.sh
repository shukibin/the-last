#!/bin/bash

# 1. Start the Agent (Host Ollama is assumed to be running)
echo "🚀 Launching 'The Last' Agent (Hybrid Mode)..."
echo "🧠 Connecting to Host Brain at host.docker.internal..."

while true; do
    npm start
    EXIT_CODE=$?
    
    echo "⚠️ Agent exited with code $EXIT_CODE."
    echo "🔄 Restarting in 2 seconds..."
    sleep 2
done
