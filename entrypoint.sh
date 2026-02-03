#!/bin/bash

# 1. Start Ollama in the background (quiet mode)
echo "🔴 Starting Local Brain (Ollama)..."
export OLLAMA_DEBUG=false
ollama serve 2>/dev/null &

# 2. Wait for it to wake up
echo "🟡 Waiting for Ollama to initialize..."
until curl -s http://localhost:11434 > /dev/null; do
    sleep 1
done
echo "🟢 Ollama is UP."

# 3. Pull the Model (if not exists)
# We check if the model is listed to avoid re-pulling every time if volume is mounted
if ! ollama list | grep -q "qwen2.5-coder:14b"; then
    echo "🔵 Downloading Model (qwen2.5-coder:14b). This might take a while..."
    ollama pull qwen2.5-coder:14b
else
    echo "🟢 Model already present."
fi

# 4. Start the Agent (in a loop for self-restart)
echo "🚀 Launching 'The Last' Agent..."

while true; do
    npm start
    EXIT_CODE=$?
    
    echo "⚠️ Agent exited with code $EXIT_CODE."
    echo "🔄 Restarting in 2 seconds..."
    sleep 2
done
