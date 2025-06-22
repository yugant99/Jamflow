#!/usr/bin/env python3
"""
Test script to verify Jamflow chatbot generates different code for different prompts
and help debug iframe refresh issues.
"""

import requests
import json
import time
import re
from urllib.parse import unquote

def test_jamflow_api(prompt):
    """Test the Jamflow API with a given prompt"""
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
    
    print(f"\n🎵 Testing prompt: '{prompt}'")
    print("=" * 60)
    
    try:
        response = requests.post(url, json=payload, headers=headers, stream=True)
        
        if response.status_code != 200:
            print(f"❌ Error: HTTP {response.status_code}")
            return None
            
        # Collect streamed response
        full_response = ""
        for chunk in response.iter_content(chunk_size=1, decode_unicode=True):
            if chunk:
                full_response += chunk
                
        print(f"✅ Response length: {len(full_response)} characters")
        
        # Extract Strudel code if present
        code_blocks = extract_strudel_code(full_response)
        
        if code_blocks:
            print(f"🎵 Found {len(code_blocks)} code block(s)")
            for i, code in enumerate(code_blocks):
                print(f"\n--- Code Block {i+1} ---")
                print(code[:200] + "..." if len(code) > 200 else code)
                
                # Simulate what the iframe URL would look like
                encoded_code = requests.utils.quote(code)
                iframe_url = f"https://strudel.cc/?code={encoded_code}&t={int(time.time()*1000)}"
                print(f"\n🔗 Iframe URL (first 100 chars): {iframe_url[:100]}...")
                
        else:
            print("💬 No Strudel code found - this is a conversational response")
            print(f"Response preview: {full_response[:200]}...")
            
        return {
            "prompt": prompt,
            "response": full_response,
            "code_blocks": code_blocks,
            "has_code": len(code_blocks) > 0
        }
        
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - make sure the Next.js server is running on localhost:3000")
        print("   Run: cd jamflow-frontend && npm run dev")
        return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def extract_strudel_code(text):
    """Extract Strudel code blocks from response text"""
    code_blocks = []
    
    # Look for code blocks with language specifiers
    patterns = [
        r'```(?:javascript|js|strudel)\n?(.*?)\n?```',
        r'```\n?(.*?setcpm.*?)\n?```'
    ]
    
    for pattern in patterns:
        matches = re.findall(pattern, text, re.DOTALL)
        code_blocks.extend([match.strip() for match in matches if match.strip()])
    
    # If no code blocks found, look for individual Strudel lines
    if not code_blocks:
        lines = text.split('\n')
        strudel_lines = []
        for line in lines:
            line = line.strip()
            if any(keyword in line for keyword in ['setcpm(', 'sound(', 'note(', 'stack(', '.gain(', '.delay(']):
                if not line.startswith('//') and len(line) > 5:
                    strudel_lines.append(line)
        
        if strudel_lines:
            code_blocks.append('\n'.join(strudel_lines))
    
    return code_blocks

def main():
    """Run tests with different prompts"""
    print("🎵 Jamflow Iframe Verification Test")
    print("=" * 60)
    print("This script tests if different prompts generate different Strudel code")
    print("and shows what URLs would be generated for the iframe.")
    print("\nMake sure your Next.js server is running: cd jamflow-frontend && npm run dev")
    
    test_prompts = [
        "Create a simple drum pattern at 120 BPM",
        "Generate an ambient soundscape with pads and effects", 
        "Make a funky bass line with jazz chords",
        "Hi, how are you today?",  # Non-music prompt
        "Create a marching band style rhythm with multiple drums"
    ]
    
    results = []
    
    for prompt in test_prompts:
        result = test_jamflow_api(prompt)
        if result:
            results.append(result)
        time.sleep(1)  # Brief pause between requests
    
    # Summary
    print("\n" + "=" * 60)
    print("🎵 TEST SUMMARY")
    print("=" * 60)
    
    music_responses = [r for r in results if r['has_code']]
    conversation_responses = [r for r in results if not r['has_code']]
    
    print(f"✅ Music responses with code: {len(music_responses)}")
    print(f"💬 Conversational responses: {len(conversation_responses)}")
    
    if len(music_responses) >= 2:
        print("\n🔍 Checking if different music prompts generate different code:")
        for i, result in enumerate(music_responses):
            print(f"  {i+1}. '{result['prompt'][:40]}...' -> {len(result['code_blocks'][0]) if result['code_blocks'] else 0} chars")
            
        # Compare first two music responses
        if len(music_responses) >= 2:
            code1 = music_responses[0]['code_blocks'][0] if music_responses[0]['code_blocks'] else ""
            code2 = music_responses[1]['code_blocks'][0] if music_responses[1]['code_blocks'] else ""
            
            if code1 != code2:
                print("✅ Different prompts generate different code - iframe refresh should work!")
            else:
                print("⚠️  Same code generated - this might indicate an issue")
    
    print(f"\n🎯 To test iframe refresh manually:")
    print("1. Open the chatbot in your browser")
    print("2. Send a music prompt like 'Create a drum pattern'")
    print("3. Click 'Play Inline' and note the code in the iframe")
    print("4. Send a different music prompt")
    print("5. Click 'Play Inline' again - the iframe should show NEW code")
    print("6. Check browser console for debug logs with message IDs and iframe keys")

if __name__ == "__main__":
    main() 