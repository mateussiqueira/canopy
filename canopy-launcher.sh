#!/bin/bash

# Canopy + MLX Launcher

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

MLX_DIR="/Volumes/BACKUP/mlx"
MLX_PORT=8081
CANOPY_BIN="/opt/homebrew/bin/opencode"

info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Check MLX server
check_mlx() {
    if curl -s "http://localhost:$MLX_PORT/v1/models" > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Start MLX server
start_mlx() {
    local model=${1:-"Llama-3.2-3B-Instruct-4bit"}
    local model_path="$MLX_DIR/models/$model"
    
    if [ ! -d "$model_path" ]; then
        error "Model not found: $model"
        return 1
    fi
    
    lsof -ti:$MLX_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
    sleep 1
    
    info "Starting MLX server with $model..."
    source "$MLX_DIR/venv/bin/activate"
    export MLX_HOME="$MLX_DIR"
    export HF_HOME="$MLX_DIR/models"
    
    nohup mlx_lm.server --model "$model_path" --port $MLX_PORT --host 0.0.0.0 > /tmp/mlx-server.log 2>&1 &
    echo $! > /tmp/mlx-server.pid
    
    for i in $(seq 1 30); do
        if curl -s "http://localhost:$MLX_PORT/v1/models" > /dev/null 2>&1; then
            success "MLX server ready on port $MLX_PORT"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    
    error "Timeout starting MLX server"
    return 1
}

# Run benchmark
run_benchmark() {
    if ! check_mlx; then
        error "Start MLX server first"
        return 1
    fi
    
    echo ""
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           BENCHMARK MLX - Tokens per Second                ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    local models=("mlx-community/Llama-3.2-3B-Instruct-4bit")
    local prompt="Write a Python function to calculate fibonacci"
    
    for model in "${models[@]}"; do
        local name=$(echo $model | cut -d'/' -f2)
        echo -e "${YELLOW}Testing: $name${NC}"
        
        local start=$(python3 -c "import time; print(time.time())")
        
        curl -s --max-time 30 "http://localhost:$MLX_PORT/v1/chat/completions" \
            -X POST \
            -H "Content-Type: application/json" \
            -d "{\"model\":\"$model\",\"messages\":[{\"role\":\"user\",\"content\":\"$prompt\"}],\"max_tokens\":100}" \
            | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    content = d['choices'][0]['message']['content']
    usage = d.get('usage', {})
    tokens = usage.get('completion_tokens', len(content.split()))
    print(f'  ✓ Tokens: {tokens}')
except Exception as e:
    print(f'  ✗ Error: {e}')
"
        
        local end=$(python3 -c "import time; print(time.time())")
        local elapsed=$(python3 -c "print(round($end - $start, 2))")
        echo "  ✓ Time: ${elapsed}s"
        echo ""
    done
}

# Main menu
show_menu() {
    clear
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                  CANOPY + MLX Launcher                     ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    echo ""
    echo "  [1] Start Canopy with MLX"
    echo "  [2] Run Benchmark"
    echo "  [3] Start MLX Server"
    echo "  [4] Check Status"
    echo "  [5] Exit"
    echo ""
}

# Check status
check_status() {
    echo ""
    if check_mlx; then
        success "MLX server: Running on port $MLX_PORT"
        curl -s "http://localhost:$MLX_PORT/v1/models" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'  Models: {len(d[\"data\"])} available')
" 2>/dev/null
    else
        warn "MLX server: Not running"
    fi
    echo ""
}

# Main
while true; do
    show_menu
    read -p "Choose option: " choice
    
    case $choice in
        1)
            if ! check_mlx; then
                info "Starting MLX server..."
                start_mlx
            fi
            echo ""
            info "Starting Canopy..."
            exec "$CANOPY_BIN"
            ;;
        2)
            run_benchmark
            read -p "Press Enter to continue..."
            ;;
        3)
            echo ""
            echo "Available models:"
            echo "  [1] Llama 3.2 3B (fast)"
            echo "  [2] Qwen Coder 14B (code)"
            echo "  [3] Mistral 7B (multilingual)"
            echo ""
            read -p "Choose model [1]: " model_choice
            model_choice=${model_choice:-1}
            
            case $model_choice in
                1) start_mlx "Llama-3.2-3B-Instruct-4bit" ;;
                2) start_mlx "Qwen2.5-Coder-14B-Instruct-4bit" ;;
                3) start_mlx "Mistral-7B-Instruct-v0.3-4bit" ;;
                *) start_mlx "Llama-3.2-3B-Instruct-4bit" ;;
            esac
            read -p "Press Enter to continue..."
            ;;
        4)
            check_status
            read -p "Press Enter to continue..."
            ;;
        5)
            echo -e "${GREEN}Goodbye!${NC}"
            exit 0
            ;;
        *)
            error "Invalid option"
            ;;
    esac
done
