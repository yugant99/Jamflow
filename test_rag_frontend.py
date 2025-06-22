#!/usr/bin/env python3
"""
Test the new RAG-integrated frontend API
"""

import requests
import json
import time

def test_frontend_api(prompt):
    """Test the frontend API with RAG integration"""
    url = "http://localhost:3000/api/chat"
    
    payload = {
        "messages": [
            {
                "id": str(int(time.time() * 1000)),
                "role": "user", 
                "content": prompt
            }
        ]
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"\n🎵 Testing RAG Frontend: '{prompt}'")
    print("=" * 60)
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=90)
        
        if response.ok:
            # Check headers for metadata
            print(f"✅ Response Status: {response.status_code}")
            print(f"📊 Jamflow Type: {response.headers.get('X-Jamflow-Type', 'unknown')}")
            print(f"🎼 Has Code: {response.headers.get('X-Jamflow-Has-Code', 'unknown')}")
            print(f"🎯 Confidence: {response.headers.get('X-Jamflow-Confidence', 'unknown')}")
            print(f"🥁 Patterns: {response.headers.get('X-Jamflow-Patterns', 'unknown')}")
            print(f"⏱️  Tempo: {response.headers.get('X-Jamflow-Tempo', 'unknown')}")
            
            # Get response content
            content = response.text
            print(f"📝 Response Length: {len(content)} characters")
            print(f"🎵 Generated Content:")
            print("-" * 40)
            print(content[:500] + "..." if len(content) > 500 else content)
            print("-" * 40)
            
            return True
        else:
            print(f"❌ Error: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Request failed: {e}")
        return False

def main():
    """Test different types of queries"""
    print("🚀 Testing RAG-Integrated Frontend API")
    
    # Wait for server to start
    print("⏱️  Waiting for server to start...")
    time.sleep(10)
    
    test_queries = [
        "create a simple drum beat at 120 BPM",
        "generate a piano melody with chord progressions",
        "hello, how are you today?"  # Non-music query
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n{'='*20} TEST {i}/{len(test_queries)} {'='*20}")
        success = test_frontend_api(query)
        
        if not success:
            print("❌ Test failed, stopping...")
            break
            
        # Rate limiting
        if i < len(test_queries):
            print("\n⏱️  Waiting 10 seconds for rate limiting...")
            time.sleep(10)
    
    print("\n✅ RAG Frontend Testing Complete!")

if __name__ == "__main__":
    main()
