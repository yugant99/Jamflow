import os
import json
import requests
from dotenv import load_dotenv

def test_gemini_25_flash():
    """Test Gemini 2.5 Flash with Strudel context"""
    
    load_dotenv()
    api_key = os.getenv('GEMINI_API_KEY')
    
    if not api_key:
        print("❌ GEMINI_API_KEY not found in .env file!")
        return
    
    print('🚀 GEMINI 2.5 FLASH TEST WITH STRUDEL CONTEXT')
    print('='*60)
    
    # Strudel context for the model
    strudel_context = """
STRUDEL SYNTAX REFERENCE:
- setcpm(120) sets tempo to 120 BPM
- sound("bd sd hh cr") plays drum sounds in sequence
- sound("bd sd, hh cr") plays simultaneous patterns using commas
- Drum sounds: bd=bass drum, sd=snare, hh=hihat, cr=crash, oh=open hihat
- Pattern repetition: "bd bd sd" or use brackets for grouping
- Rest symbol: ~ for silence, example "bd ~ sd ~"

EXAMPLES:
setcpm(140)
sound("bd sd hh, cr ~ hh ~")
sound("bd bd sd hh cr")
"""
    
    test_prompt = f"""Context about Strudel music programming:
{strudel_context}

User request: Create an energetic marching band drum pattern at 140 BPM

Generate only runnable Strudel JavaScript code using the syntax above:"""

    print('📝 Sending prompt to Gemini 2.5 Flash...')
    print(f'Context length: {len(strudel_context)} chars')
    
    url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    
    payload = {
        'contents': [{
            'parts': [{'text': test_prompt}]
        }],
        'generationConfig': {
            'maxOutputTokens': 800,
            'temperature': 0.7,
            'topP': 0.8
        }
    }
    
    try:
        response = requests.post(
            url,
            headers={'Content-Type': 'application/json'},
            params={'key': api_key},
            json=payload,
            timeout=30
        )
        
        print(f'\n📊 Response Status: {response.status_code}')
        
        if response.status_code == 200:
            result = response.json()
            usage = result.get('usageMetadata', {})
            
            print(f'📊 Token Usage:')
            print(f'   Total: {usage.get("totalTokenCount", 0)}')
            print(f'   Input: {usage.get("promptTokenCount", 0)}')
            print(f'   Output: {usage.get("candidatesTokenCount", 0)}')
            print(f'   Thoughts: {usage.get("thoughtsTokenCount", 0)}')
            
            # Check if it's a reasoning model
            is_reasoning = usage.get('thoughtsTokenCount', 0) > 0
            print(f'🤔 Reasoning model: {is_reasoning}')
            
            # Try to extract content
            if 'candidates' in result and result['candidates']:
                candidate = result['candidates'][0]
                
                print(f'\n🔍 Response Analysis:')
                print(f'   Finish reason: {candidate.get("finishReason", "unknown")}')
                print(f'   Has content: {"content" in candidate}')
                
                content = candidate.get('content', {})
                if 'parts' in content and content['parts']:
                    text = content['parts'][0].get('text', '')
                    if text.strip():
                        print(f'\n✅ GEMINI 2.5 FLASH OUTPUT:')
                        print('='*50)
                        print(text)
                        print('='*50)
                        
                        # Quick quality check
                        has_setcpm = 'setcpm(' in text
                        has_sound = 'sound(' in text
                        has_drums = any(drum in text for drum in ['bd', 'sd', 'hh', 'cr'])
                        has_tempo_140 = '140' in text
                        has_commas = ',' in text and 'sound(' in text
                        no_placeholders = not any(p in text.lower() for p in ['pattern1', 'pattern2', 'example'])
                        
                        print(f'\n📊 Code Quality Analysis:')
                        print(f'   ✅ Has setcpm(): {has_setcpm}')
                        print(f'   ✅ Has sound(): {has_sound}')
                        print(f'   ✅ Has drum sounds: {has_drums}')
                        print(f'   ✅ Has 140 BPM: {has_tempo_140}')
                        print(f'   ✅ Has simultaneous patterns: {has_commas}')
                        print(f'   ✅ No placeholders: {no_placeholders}')
                        
                        score = sum([has_setcpm, has_sound, has_drums, has_tempo_140, has_commas, no_placeholders])
                        print(f'\n🎯 Overall Score: {score}/6')
                        
                        if score >= 5:
                            print(f'🏆 EXCELLENT! Gemini 2.5 Flash is perfect for Jamflow!')
                        elif score >= 4:
                            print(f'✅ GOOD! Gemini 2.5 Flash works well for Jamflow!')
                        elif score >= 3:
                            print(f'⚠️  OKAY! Gemini 2.5 Flash needs some improvements')
                        else:
                            print(f'❌ POOR! Gemini 2.5 Flash may not be suitable')
                            
                        return {
                            'success': True,
                            'code': text,
                            'score': score,
                            'is_reasoning': is_reasoning
                        }
                            
                    else:
                        print(f'❌ No text content in parts')
                else:
                    print(f'❌ No parts in content')
                    
                    # For reasoning models, the content might be elsewhere
                    if is_reasoning:
                        print(f'\n🔍 Reasoning model debug - checking candidate structure:')
                        for key, value in candidate.items():
                            if isinstance(value, (str, dict)):
                                print(f'   {key}: {type(value)}')
                                if isinstance(value, str) and len(value) > 20:
                                    print(f'      Text preview: {value[:100]}...')
            else:
                print(f'❌ No candidates in response')
                
        else:
            print(f'❌ API Error {response.status_code}:')
            print(response.text[:500])
            
    except Exception as e:
        print(f'❌ Exception: {e}')
        return {'success': False, 'error': str(e)}
    
    return {'success': False, 'error': 'No content generated'}

if __name__ == "__main__":
    result = test_gemini_25_flash()
    print(f'\n🎯 TEST COMPLETE')
    if result.get('success'):
        print(f'🎉 Gemini 2.5 Flash is ready for Jamflow integration!')
    else:
        print(f'⚠️  Need to investigate further or use fallback approach') 