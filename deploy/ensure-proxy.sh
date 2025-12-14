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
# Ensure Traefik is Running
# ==========================================
# Check if the specific Traefik container is running
if [ "$(docker ps -q -f name=traefik)" ]; then
    echo "Traefik is already running."
else
    echo "Traefik is not running. Starting it..."
    
    # Navigate to script directory to find docker-compose.yml
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    TRAEFIK_DIR="$SCRIPT_DIR/traefik"
    
    cd "$TRAEFIK_DIR"

    # Ensure acme.json exists with correct permissions (MUST be 600)
    mkdir -p letsencrypt
    if [ ! -f "letsencrypt/acme.json" ]; then
        echo "Initializing acme.json..."
        touch letsencrypt/acme.json
    fi
    # Always fix permissions (even if file existed with wrong permissions)
    chmod 600 letsencrypt/acme.json
    echo "acme.json permissions set to 600"

    # Create .env for Traefik if LETSENCRYPT_EMAIL is provided
    if [ -n "$LETSENCRYPT_EMAIL" ]; then
        echo "LETSENCRYPT_EMAIL=$LETSENCRYPT_EMAIL" > .env
    fi

    # Start Traefik
    docker compose up -d
    echo "Traefik started."
fi
