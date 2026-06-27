#!/usr/bin/env python3
"""
Teste rápido de velocidade MLX via API
Mede tokens/segundo sem precisar do Canopy
"""

import requests
import time
import json
import sys

MLX_URL = "http://localhost:8081/v1/chat/completions"

def test_speed(model: str, prompt: str, max_tokens: int = 100) -> dict:
    """Testa velocidade de um modelo"""
    start = time.time()
    first_token = None
    tokens = 0
    
    try:
        response = requests.post(
            MLX_URL,
            json={
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "stream": True,
                "max_tokens": max_tokens
            },
            stream=True,
            timeout=60
        )
        
        for line in response.iter_lines():
            if line:
                line = line.decode('utf-8')
                if line.startswith('data: ') and line != 'data: [DONE]':
                    try:
                        data = json.loads(line[6:])
                        if 'choices' in data:
                            content = data['choices'][0].get('delta', {}).get('content', '')
                            if content:
                                if first_token is None:
                                    first_token = time.time() - start
                                tokens += len(content.split())
                    except:
                        pass
        
        elapsed = time.time() - start
        return {
            "model": model.split("/")[-1],
            "tokens": tokens,
            "time": round(elapsed, 2),
            "tps": round(tokens / elapsed, 1) if elapsed > 0 else 0,
            "ttft": round(first_token, 2) if first_token else None,
            "success": True
        }
    except Exception as e:
        return {"model": model.split("/")[-1], "error": str(e), "success": False}

def main():
    print("🚀 Teste de Velocidade MLX")
    print("=" * 50)
    
    # Verificar servidor
    try:
        requests.get("http://localhost:8080/v1/models", timeout=3)
        print("✅ Servidor MLX ativo\n")
    except:
        print("❌ Servidor MLX não encontrado na porta 8080")
        print("   Inicie o LM Studio ou mlx-server primeiro")
        return
    
    # Modelos para testar
    models = [
        "mlx-community/Llama-3.2-3B-Instruct-4bit",
        "mlx-community/Qwen2.5-7B-Instruct-4bit",
    ]
    
    prompt = "Write a simple Python function"
    
    results = []
    for model in models:
        print(f"🔄 Testando {model.split('/')[-1]}...")
        result = test_speed(model, prompt)
        results.append(result)
        if result["success"]:
            print(f"   ✓ {result['tps']} tokens/segundo\n")
        else:
            print(f"   ✗ Erro: {result.get('error')}\n")
    
    # Resultados
    print("=" * 50)
    print("📊 RESULTADOS:")
    print("=" * 50)
    for r in results:
        if r["success"]:
            ttft = f" | TTFT: {r['ttft']}s" if r['ttft'] else ""
            print(f"  {r['model']}: {r['tps']} tps ({r['tokens']} tokens em {r['time']}s){ttft}")
    
    print("=" * 50)

if __name__ == "__main__":
    main()
