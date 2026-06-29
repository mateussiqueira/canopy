#!/bin/bash

# Benchmark Canopy MLX - Tokens per Second

set -e

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CANOPY_BIN="/opt/homebrew/bin/opencode"

# Models to test
MODELS=(
    "mlx-local/llama-3.2-3b"
    "mlx-local/qwen-coder-14b"
    "mlx-local/mistral-7b"
)

# Test prompts
PROMPTS=(
    "Write a Python function to calculate fibonacci numbers"
    "Explain what is a REST API in 2 paragraphs"
    "Create a bash script to monitor CPU usage"
)

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          BENCHMARK CANOPY MLX - Tokens per Second          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if MLX server is running
echo -e "${YELLOW}Checking MLX server...${NC}"
if ! curl -s "http://localhost:8081/v1/models" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  MLX server not found on port 8081${NC}"
    echo ""
    echo "To run the benchmark, start the MLX server:"
    echo "  source /Volumes/BACKUP/mlx/venv/bin/activate"
    echo "  mlx_lm.server --model /Volumes/BACKUP/mlx/models/Llama-3.2-3B-Instruct-4bit --port 8081"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ MLX server active${NC}"
echo ""

# Run test function
run_test() {
    local model=$1
    local prompt=$2
    local start_time=$(date +%s%N)
    
    echo -e "${CYAN}Testing: ${model}${NC}"
    echo -e "Prompt: ${prompt:0:50}..."
    
    # Run Canopy with timeout (macOS compatible)
    ( sleep 30; kill $! 2>/dev/null ) &
    local watchdog=$!
    "$CANOPY_BIN" run --model "$model" "$prompt" 2>/dev/null || true
    kill $watchdog 2>/dev/null || true
    
    local end_time=$(date +%s%N)
    local elapsed=$(( (end_time - start_time) / 1000000 ))
    local seconds=$(echo "scale=2; $elapsed / 1000" | bc)
    
    echo -e "${GREEN}Time: ${seconds}s${NC}"
    echo "---"
}

# Run benchmarks
for model in "${MODELS[@]}"; do
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Model: ${model}${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    for prompt in "${PROMPTS[@]}"; do
        run_test "$model" "$prompt"
    done
    echo ""
done

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    BENCHMARK COMPLETE!                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
