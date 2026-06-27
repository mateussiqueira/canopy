#!/bin/bash

# Canopy + MLX Launcher with token metrics

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

CANOPY_BIN="/opt/homebrew/bin/opencode"
MLX_PORT=8081

info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; }

# Check MLX server
info "Checking MLX server on port $MLX_PORT..."

if ! curl -s "http://localhost:$MLX_PORT/v1/models" > /dev/null 2>&1; then
    warn "MLX server not found on port $MLX_PORT"
    echo ""
    echo "Start MLX server first:"
    echo "  source /Volumes/BACKUP/mlx/venv/bin/activate"
    echo "  mlx_lm.server --model /Volumes/BACKUP/mlx/models/Llama-3.2-3B-Instruct-4bit --port $MLX_PORT"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

success "MLX server ready"
echo ""
info "Available models:"
echo "  • mlx-local/llama-3.2-3b (fast, ~4GB RAM)"
echo "  • mlx-local/qwen-coder-14b (code, ~14GB RAM)"
echo "  • mlx-local/mistral-7b (multilingual, ~8GB RAM)"
echo ""
info "Tip: Use Tab to switch between build/plan agents"
echo ""

# Run Canopy
exec "$CANOPY_BIN" "$@"
