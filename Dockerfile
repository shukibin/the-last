FROM node:22-bookworm-slim

# Install System Dependencies (Chromium + Curl + Procps)
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    git \
    procps \
    zstd \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Ollama (Official Script)
RUN curl -fsSL https://ollama.com/install.sh | sh

# Configure Environment
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    OLLAMA_HOST=127.0.0.1:11434

WORKDIR /app

# Copy Config
COPY package.json ./
RUN npm install

# Copy Source
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

# Expose Ollama port (optional, if you want to reach it from host)
EXPOSE 11434

# Use the Entrypoint script
ENTRYPOINT ["./entrypoint.sh"]
