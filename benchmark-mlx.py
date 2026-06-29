#!/usr/bin/env python3
"""
Benchmark de modelos MLX para Canopy
Testa tokens/segundo em diferentes modelos
"""

import requests
import time
import json
from typing import Dict, List

MLX_URL = "http://localhost:8081/v1/chat/completions"

MODELS = [
    "mlx-community/Llama-3.2-3B-Instruct-4bit",
    "mlx-community/Qwen2.5-7B-Instruct-4bit",
    "mlx-community/DeepSeek-R1-Distill-Qwen-7B-4bit",
    "mlx-community/gemma-3-4b-it-4bit",
]

PROMPTS = [
    "Escreva uma função em Python que calcule o fibonacci",
    "Explique o que é uma API REST em 3 parágrafos",
    "Crie um script bash que monitora uso de CPU",
    "Escreva um SQL para criar uma tabela de usuários",
]

def test_model(model: str, prompt: str) -> Dict:
    """Testa um modelo e retorna métricas"""
    start = time.time()
    first_token_time = None
    tokens = 0
    
    try:
        response = requests.post(
            MLX_URL,
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
                "max_tokens": 200
            },
            stream=True,
            timeout=60
        )
        
        full_response = []
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: ') and line != 'data: [DONE]':
                    try:
                        data = json.loads(line[6:])
                        if 'choices' in data and len(data['choices']) > 0:
                            delta = data['choices'][0].get('delta', {})
                            content = delta.get('content', '')
                            if content:
                                if first_token_time is None:
                                    first_token_time = time.time() - start
                                tokens += len(content.split())
                                full_response.append(content)
                    except json.JSONDecodeError:
                        pass
        
        elapsed = time.time() - start
        tps = tokens / elapsed if elapsed > 0 else 0
        
        return {
            "model": model.split("/")[-1],
            "prompt": prompt[:50] + "...",
            "tokens": tokens,
            "time": round(elapsed, 2),
            "tps": round(tps, 1),
            "ttft": round(first_token_time, 2) if first_token_time else None,
            "success": True
        }
        
    except Exception as e:
        return {
            "model": model.split("/")[-1],
            "prompt": prompt[:50] + "...",
            "error": str(e),
            "success": False
        }

def print_results(results: List[Dict]):
    """Imprime resultados formatados"""
    print("\n" + "="*70)
    print("📊 BENCHMARK MLX - Tokens por Segundo")
    print("="*70)
    print(f"{'Modelo':<35} {'TPS':>8} {'TTFT':>8} {'Tokens':>8}")
    print("-"*70)
    
    for r in results:
        if r["success"]:
            ttft = f"{r['ttft']}s" if r['ttft'] else "N/A"
            print(f"{r['model']:<35} {r['tps']:>7.1f} {ttft:>8} {r['tokens']:>8}")
        else:
            print(f"{r['model']:<35} {'ERRO':>8}")
    
    print("="*70)

def main():
    print("🚀 Benchmark de Modelos MLX")
    print(f"📍 Servidor: {MLX_URL}")
    print(f"📝 Prompts: {len(PROMPTS)}")
    print(f"🤖 Modelos: {len(MODELS)}")
    print()
    
    # Verificar servidor
    try:
        requests.get("http://localhost:8080/v1/models", timeout=5)
        print("✅ Servidor MLX ativo\n")
    except:
        print("❌ Servidor MLX não encontrado na porta 8080")
        print("   Inicie o LM Studio ou mlx-server primeiro\n")
        return
    
    results = []
    
    for model in MODELS:
        print(f"🔄 Testando {model.split('/')[-1]}...")
        for prompt in PROMPTS:
            result = test_model(model, prompt)
            results.append(result)
            if result["success"]:
                print(f"   ✓ {result['tps']} tps")
            else:
                print(f"   ✗ Erro: {result.get('error', 'Unknown')}")
    
    print_results(results)
    
    # Salvar resultados
    with open("benchmark-results.json", "w") as f:
        json.dump(results, f, indent=2)
    print("\n💾 Resultados salvos em benchmark-results.json")

if __name__ == "__main__":
    main()
