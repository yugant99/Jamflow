import os
import json
import requests
import time
import re
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

class GeminiClient:
    """
    Gemini 2.5 Client for Jamflow - Handles both 2.5-flash and 2.5-pro
    Specifically designed for reasoning models like 2.5-flash
    """
    
    def __init__(self, api_key: Optional[str] = None):
        load_dotenv()
        self.api_key = api_key or os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        # Primary models for Jamflow (2.5 only)
        self.models = [
            'gemini-2.5-flash',  # Reasoning model - fast but needs special handling
            'gemini-2.5-pro'     # Standard model - more stable
        ]
        self.current_model_index = 0
        
        self.base_url = "https://generativelanguage.googleapis.com/v1beta/models"
        self.headers = {'Content-Type': 'application/json'}
        
        print(f"🧠 Gemini 2.5 Client initialized with models: {self.models}")
    
    def _make_request(self, model: str, prompt: str, max_tokens: int = 1000) -> Dict[str, Any]:
        """Make request to Gemini API"""
        url = f"{self.base_url}/{model}:generateContent"
        
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'maxOutputTokens': max_tokens,
                'temperature': 0.7,
                'topP': 0.9,
                'stopSequences': []
            }
        }
        
        try:
            response = requests.post(
                url,
                headers=self.headers,
                params={'key': self.api_key},
                json=payload,
                timeout=30
            )
            
            if response.status_code == 200:
                return {'success': True, 'data': response.json(), 'model': model}
            else:
                return {'success': False, 'error': f"HTTP {response.status_code}: {response.text}", 'model': model}
                
        except Exception as e:
            return {'success': False, 'error': str(e), 'model': model}
    
    def _extract_content(self, response_data: Dict[str, Any], model: str) -> Optional[str]:
        """Extract content from Gemini response, handling reasoning models"""
        try:
            if 'candidates' not in response_data or not response_data['candidates']:
                return None
            
            candidate = response_data['candidates'][0]
            usage = response_data.get('usageMetadata', {})
            thoughts_tokens = usage.get('thoughtsTokenCount', 0)
            
            # Check if this is a reasoning model
            is_reasoning_model = thoughts_tokens > 0
            
            if is_reasoning_model:
                print(f"🤔 Reasoning model detected ({model}): {thoughts_tokens} thought tokens")
                
                # For reasoning models like 2.5-flash, the actual output might be:
                # 1. In a different field
                # 2. Empty due to MAX_TOKENS finish reason
                # 3. Needs different extraction logic
                
                finish_reason = candidate.get('finishReason', '')
                if finish_reason == 'MAX_TOKENS':
                    print(f"⚠️  Reasoning model hit token limit - may need higher maxOutputTokens")
            
            # Standard content extraction
            content = candidate.get('content', {})
            if 'parts' in content and content['parts']:
                text = content['parts'][0].get('text', '')
                if text.strip():
                    return text
            
            # For reasoning models, try alternative extraction
            if is_reasoning_model:
                # Sometimes reasoning models put content in different fields
                # Or we need to extract from the reasoning process itself
                print(f"🔍 Attempting alternative extraction for reasoning model...")
                
                # Check all candidate fields for text content
                for key, value in candidate.items():
                    if isinstance(value, str) and len(value) > 10:
                        print(f"📝 Found text in field '{key}': {len(value)} chars")
                        return value
            
            return None
            
        except Exception as e:
            print(f"❌ Content extraction error: {e}")
            return None
    
    def _extract_strudel_code(self, text: str) -> str:
        """Extract clean Strudel code from any text format"""
        if not text:
            return ""
        
        # Remove markdown code blocks
        text = re.sub(r'```(?:javascript|js)?\n?(.*?)\n?```', r'\1', text, flags=re.DOTALL)
        
        # Extract lines that look like Strudel code
        lines = text.split('\n')
        code_lines = []
        
        for line in lines:
            line = line.strip()
            if not line or line.startswith('//'):
                continue
            
            # Look for Strudel patterns
            if any(pattern in line for pattern in ['setcpm(', 'sound(', 'note(', 'stack(', 'sequence(']):
                code_lines.append(line)
            elif any(drum in line for drum in ['bd', 'sd', 'hh', 'cr', 'oh']):
                code_lines.append(line)
        
        if code_lines:
            return '\n'.join(code_lines)
        
        # Fallback: return clean text
        return text.strip()
    
    def generate_strudel_code(self, query: str, context: str, max_tokens: int = 1500) -> Dict[str, Any]:
        """Generate Strudel code using Gemini 2.5 models with fallback"""
        
        # Enhanced prompt for Jamflow Strudel generation
        prompt = f"""You are Jamflow, an AI assistant that generates runnable Strudel JavaScript code.

CONTEXT FROM STRUDEL DOCUMENTATION:
{context}

USER QUERY: {query}

CRITICAL REQUIREMENTS:
1. Generate ONLY runnable Strudel JavaScript code
2. Use REAL drum sounds: "bd" (bass), "sd" (snare), "hh" (hihat), "cr" (crash), "oh" (open hihat)
3. For simultaneous patterns, use comma syntax: sound("bd sd, hh cr")
4. NEVER use placeholder names like "pattern1" or "example_beat"
5. Start with setcpm() for tempo
6. Use real pattern combinations from context

EXAMPLES:
setcpm(120)
sound("bd sd hh cr")
sound("bd sd, hh cr oh")
sound("[bd bd] sd [hh hh] cr")

Generate clean, runnable Strudel code:"""

        for attempt in range(len(self.models)):
            current_model = self.models[self.current_model_index]
            
            print(f"🧠 Attempting generation with {current_model}...")
            
            response = self._make_request(current_model, prompt, max_tokens)
            
            if response['success']:
                content = self._extract_content(response['data'], current_model)
                
                if content:
                    strudel_code = self._extract_strudel_code(content)
                    
                    if strudel_code:
                        print(f"✅ Successfully generated code with {current_model}")
                        return {
                            'success': True,
                            'code': strudel_code,
                            'model': current_model,
                            'raw_response': content,
                            'usage': response['data'].get('usageMetadata', {})
                        }
                    else:
                        print(f"⚠️  {current_model} generated content but no Strudel code extracted")
                else:
                    print(f"⚠️  {current_model} no content extracted")
            else:
                print(f"❌ {current_model} failed: {response['error']}")
            
            # Rotate to next model
            self.current_model_index = (self.current_model_index + 1) % len(self.models)
            
            if attempt < len(self.models) - 1:
                print(f"🔄 Trying next model...")
                time.sleep(1)
        
        # All models failed - return fallback
        print(f"❌ All Gemini 2.5 models failed, generating fallback code")
        return {
            'success': False,
            'code': self._generate_fallback_code(query),
            'model': 'fallback',
            'raw_response': 'All models failed',
            'usage': {}
        }
    
    def _generate_fallback_code(self, query: str) -> str:
        """Generate simple fallback Strudel code"""
        # Extract tempo if mentioned
        tempo_match = re.search(r'\b(\d{2,3})\b', query)
        tempo = tempo_match.group(1) if tempo_match else '120'
        
        # Determine style from query
        if any(word in query.lower() for word in ['fast', 'energetic', 'rock']):
            pattern = '"bd sd hh cr, bd bd sd hh"'
        elif any(word in query.lower() for word in ['slow', 'chill', 'ambient']):
            pattern = '"bd ~ sd ~, ~ hh ~ hh"'
        else:
            pattern = '"bd sd hh, cr sd hh bd"'
        
        return f"""setcpm({tempo})
sound({pattern})"""

# Test the client
if __name__ == "__main__":
    client = GeminiClient()
    
    test_query = "Create a marching band drum pattern"
    test_context = "Strudel uses sound() function with drum patterns like 'bd sd hh cr'"
    
    result = client.generate_strudel_code(test_query, test_context)
    
    print(f"\n🎵 Generated Code:")
    print("="*50)
    print(result['code'])
    print("="*50)
    print(f"Model: {result['model']}")
    print(f"Success: {result['success']}") 