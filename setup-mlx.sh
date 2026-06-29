#!/bin/bash

# Canopy + MLX Setup Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

MLX_PORT=8081

echo -e "${GREEN}=== Canopy + MLX Setup ===${NC}"

# Check if MLX server is running
echo ""
echo -e "${YELLOW}Checking MLX server on port $MLX_PORT...${NC}"

if curl -s "http://localhost:$MLX_PORT/v1/models" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ MLX server is running${NC}"
else
    echo -e "${YELLOW}⚠️  MLX server not found on port $MLX_PORT${NC}"
    echo ""
    echo "Options to run MLX server:"
    echo ""
    echo "  1. LM Studio (recommended):"
    echo "     - Download from https://lmstudio.ai"
    echo "     - Open, download a model and click 'Start Server'"
    echo "     - Make sure it's on port $MLX_PORT"
    echo ""
    echo "  2. mlx-server:"
    echo "     source /Volumes/BACKUP/mlx/venv/bin/activate"
    echo "     mlx_lm.server --model /Volumes/BACKUP/mlx/models/Llama-3.2-3B-Instruct-4bit --port $MLX_PORT"
    echo ""
fi

echo ""
echo -e "${GREEN}=== Setup Complete! ===${NC}"
echo ""
echo "To use Canopy:"
echo ""
echo "  canopy"
echo ""
echo "Available models:"
echo "  - Llama 3.2 3B (fast, 4GB RAM)"
echo "  - Qwen Coder 14B (code, 14GB RAM)"
echo "  - Mistral 7B (multilingual, 8GB RAM)"
