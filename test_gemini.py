#!/usr/bin/env python3
"""
Gemini API Test Script for Jamflow
Tests Gemini 2.5 Pro with API key from .env
"""

import os
import json
import requests
import time
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def test_gemini_api():
    """Test Gemini 2.5 Pro API"""
    
    print("🚀 JAMFLOW GEMINI API TEST")
    print("="*50)
    
    # Get API key from environment
    api_key = os.getenv('GEMINI_API_KEY')
    if not api_key:
        print("❌ GEMINI_API_KEY not found in .env file!")
        return False
    
    print(f"�� API Key found: {api_key[:10]}...{api_key[-4:]}")
    
    # Gemini 2.5 Pro model
    model = "gemini-2.0-flash-exp"  # Latest Gemini model
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    
    headers = {
        "Content-Type": "application/json",
    }
    
    # Test prompt for Strudel code generation
    test_prompt = """Generate Strudel JavaScript code for a simple drum pattern.
Use real drum sounds like "bd" (bass drum), "sd" (snare), "hh" (hi-hat).
Create a marching band style composition with simultaneous patterns using commas.
Output only working Strudel code, no explanations:"""
    
    payload = {
        "contents": [{
            "parts": [{"text": test_prompt}]
        }],
        "generationConfig": {
            "temperature": 0.7,
            "topK": 40,
            "topP": 0.95,
            "maxOutputTokens": 1000,
        }
    }
    
    try:
        print(f"\n🧠 Testing {model}...")
        print(f"📝 Prompt: {test_prompt[:100]}...")
        
        start_time = time.time()
        
        response = requests.post(
            url,
            headers=headers,
            params={"key": api_key},
            json=payload,
            timeout=30
        )
        
        end_time = time.time()
        response_time = round(end_time - start_time, 2)
        
        print(f"⏱️  Response time: {response_time}s")
        print(f"📊 Status code: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            
            if 'candidates' in result and result['candidates']:
                content = result['candidates'][0]['content']['parts'][0]['text']
                usage = result.get('usageMetadata', {})
                
                print(f"\n✅ SUCCESS! Gemini API is working!")
                print(f"🎵 Generated Strudel Code:")
                print("="*50)
                print(content)
                print("="*50)
                
                if usage:
                    print(f"\n📊 Token Usage:")
                    print(f"   Input tokens: {usage.get('promptTokenCount', 'N/A')}")
                    print(f"   Output tokens: {usage.get('candidatesTokenCount', 'N/A')}")
                    print(f"   Total tokens: {usage.get('totalTokenCount', 'N/A')}")
                
                return True
            else:
                print(f"❌ No candidates in response: {result}")
                return False
        
        else:
            print(f"❌ API Error {response.status_code}:")
            print(f"Response: {response.text}")
            return False
            
    except requests.exceptions.Timeout:
        print(f"❌ Request timeout (30s)")
        return False
        
    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return False

def test_multiple_requests():
    """Test multiple requests to check consistency"""
    print(f"\n🔄 Testing multiple requests...")
    
    prompts = [
        "Generate a simple drum beat: sound('bd sd hh')",
        "Create a bass line with sound() function",
        "Make a marching band composition with simultaneous patterns"
    ]
    
    success_count = 0
    
    for i, prompt in enumerate(prompts, 1):
        print(f"\n   Test {i}: {prompt[:30]}...")
        
        api_key = os.getenv('GEMINI_API_KEY')
        model = "gemini-2.0-flash-exp"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"maxOutputTokens": 200}
        }
        
        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                params={"key": api_key},
                json=payload,
                timeout=15
            )
            
            if response.status_code == 200:
                result = response.json()
                if 'candidates' in result and result['candidates']:
                    content = result['candidates'][0]['content']['parts'][0]['text']
                    print(f"      ✅ Success: {content[:50]}...")
                    success_count += 1
                else:
                    print(f"      ❌ No content")
            else:
                print(f"      ❌ Error {response.status_code}")
                
        except Exception as e:
            print(f"      ❌ Exception: {e}")
        
        time.sleep(1)  # Rate limiting
    
    print(f"\n📊 Multiple requests result: {success_count}/{len(prompts)} successful")
    return success_count == len(prompts)

if __name__ == "__main__":
    # Check if .env file exists
    if not os.path.exists('.env'):
        print("❌ .env file not found in current directory!")
        print("Create .env file with: GEMINI_API_KEY=your_key_here")
        exit(1)
    
    # Run tests
    basic_success = test_gemini_api()
    
    if basic_success:
        multi_success = test_multiple_requests()
        
        if multi_success:
            print(f"\n🎉 ALL TESTS PASSED!")
            print(f"✅ Gemini API is ready for Jamflow integration!")
            print(f"🎯 Ready for hackathon with 'most innovative use of Gemini API'!")
        else:
            print(f"\n⚠️  Basic test passed but multiple requests had issues")
    else:
        print(f"\n❌ Basic test failed - check API key and quota")
