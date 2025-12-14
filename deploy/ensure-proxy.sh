#!/bin/bash
set -e

# ==========================================
# Ensure Proxy Network Exists
# ==========================================
if ! docker network ls | grep -q "proxy"; then
  echo "Creating 'proxy' network..."
  docker network create proxy
else
  echo "'proxy' network already exists."
fi

# ==========================================
# Ensure acme.json permissions (ALWAYS run)
# ==========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRAEFIK_DIR="$SCRIPT_DIR/traefik"

mkdir -p "$TRAEFIK_DIR/letsencrypt"
if [ ! -f "$TRAEFIK_DIR/letsencrypt/acme.json" ]; then
    echo "Initializing acme.json..."
    touch "$TRAEFIK_DIR/letsencrypt/acme.json"
fi
# CRITICAL: Always fix permissions (MUST be 600 for Let's Encrypt)
chmod 600 "$TRAEFIK_DIR/letsencrypt/acme.json"
echo "acme.json permissions set to 600"

# ==========================================
# Ensure Traefik is Running
# ==========================================
# Check if the specific Traefik container is running
if [ "$(docker ps -q -f name=traefik)" ]; then
    echo "Traefik is already running."
else
    echo "Traefik is not running. Starting it..."
    
    cd "$TRAEFIK_DIR"

    # Create .env for Traefik if LETSENCRYPT_EMAIL is provided
    if [ -n "$LETSENCRYPT_EMAIL" ]; then
        echo "LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL" > .env
    fi

    # Start Traefik
    docker compose up -d
    echo "Traefik started."
fi
