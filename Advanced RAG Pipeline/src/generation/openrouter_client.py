"""
OpenRouter Client for Strudel RAG

Simple client for deepseek/deepseek-r1-0528-qwen3-8b:free model.
"""

import os
import requests
import json
from typing import Dict, Any, Optional
from dotenv import load_dotenv
import re


class OpenRouterClient:
    """Client for OpenRouter API with DeepSeek model"""
    
    def __init__(self):
        """Initialize with API key from environment"""
        load_dotenv()
        self.api_key = os.getenv('OPENROUTER_API_KEY')
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY not found in environment variables")
        
        self.base_url = "https://openrouter.ai/api/v1/chat/completions"
        self.model = "deepseek/deepseek-r1-0528-qwen3-8b:free"
        
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://jamflow.hackathon",  # Optional: your app name
            "X-Title": "Jamflow Strudel RAG"  # Optional: your app name
        }
    
    def generate_response(self, 
                         query: str, 
                         context: str, 
                         max_tokens: int = 1000,
                         temperature: float = 0.7) -> Dict[str, Any]:
        """
        Generate response using OpenRouter API
        
        Args:
            query: User's question
            context: Retrieved context from vector search
            max_tokens: Maximum response length
            temperature: Creativity level (0-1)
            
        Returns:
            Dict with response and metadata
        """
        
        # Create prompt with context
        prompt = self._build_prompt(query, context)
        
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "user", 
                    "content": prompt
                }
            ],
            "max_tokens": max_tokens,
            "temperature": temperature
        }
        
        print(f"🤖 Generating response with {self.model}...")
        print(f"📝 Query: {query}")
        print(f"📊 Context length: {len(context)} chars")
        
        try:
            response = requests.post(
                url=self.base_url,
                headers=self.headers,
                data=json.dumps(payload),
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                
                # Extract response text - handle DeepSeek R1 reasoning model
                message = result['choices'][0]['message']
                response_text = message.get('content', '')
                
                # If content is empty but there's reasoning, use that (DeepSeek R1 behavior)
                if not response_text and 'reasoning' in message:
                    response_text = message['reasoning']
                    print("🧠 Using reasoning output from DeepSeek R1")
                    
                    # Try to extract just the code from reasoning
                    response_text = self._extract_code_from_reasoning(response_text)
                
                # Get usage stats
                usage = result.get('usage', {})
                
                print(f"✅ Response generated successfully")
                print(f"📈 Tokens used: {usage.get('total_tokens', 'unknown')}")
                
                return {
                    "success": True,
                    "response": response_text,
                    "model": self.model,
                    "usage": usage,
                    "query": query,
                    "context_length": len(context)
                }
            
            else:
                error_msg = f"API Error {response.status_code}: {response.text}"
                print(f"❌ {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "query": query
                }
                
        except requests.exceptions.Timeout:
            error_msg = "Request timeout (30s)"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "query": query
            }
            
        except Exception as e:
            error_msg = f"Unexpected error: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "query": query
            }
    
    def _build_prompt(self, query: str, context: str) -> str:
        """Build prompt with context and query"""
        
        prompt = f"""Context: {context}

TASK: {query}

REAL SOUND PATTERNS (use these actual patterns, NOT placeholders):
setcpm(120)
sound("bd sd hh")
sound("bd sd hh cr") 
sound("bd sd, hh cr")
sound("bd hh sd oh")
sound("bd sd ~ hh cr")
sound("bd [hh hh] sd [hh bd] bd - [hh sd] cp")
sound("bd bd sd hh, hh*8")
sound("[bd sd]*2, hh*8")

IMPORTANT INSTRUCTIONS:
1. Use ONLY real sound patterns like "bd", "sd", "hh", "cr", "oh", "cp", "cb"
2. NEVER use placeholder names like "pattern1", "pattern2", "pattern" 
3. Create simultaneous patterns using commas: sound("bd sd hh, cr ~ hh ~")
4. Use real drum abbreviations: bd=bass drum, sd=snare, hh=hihat, cr=crash, oh=open hihat
5. Output ONLY working Strudel code - no explanations

Generate real marching band code with actual sound patterns:"""
        
        return prompt
    
    def _extract_code_from_reasoning(self, reasoning_text: str) -> str:
        """Extract clean Strudel code from reasoning output"""
        
        # First try to find code blocks or explicit code
        code_block_match = re.search(r'```[\w]*\n(.*?)\n```', reasoning_text, re.DOTALL)
        if code_block_match:
            return code_block_match.group(1).strip()
        
        # Look for lines that contain actual Strudel function calls
        lines = reasoning_text.split('\n')
        code_lines = []
        
        # Patterns that indicate actual Strudel code
        strudel_patterns = [
            r'setcpm\(\d+\)',
            r'sound\("[^"]+"\)',
            r'note\("[^"]+"\)',
            r'n\("[^"]+"\)',
            r'^\s*sound\(',
            r'^\s*note\(',
            r'^\s*n\(',
            r'^\s*setcpm\(',
            r'sound\("[^"]*,[^"]*"\)',  # Simultaneous patterns with commas
            r'sound\("[^"]*\*\d+[^"]*"\)',  # Patterns with multiplication
        ]
        
        for line in lines:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith('//') or line.startswith('#'):
                continue
                
            # Check if line contains actual Strudel code
            if any(re.search(pattern, line) for pattern in strudel_patterns):
                # Clean up the line - remove extra text
                if 'setcpm(' in line:
                    match = re.search(r'setcpm\(\d+\)', line)
                    if match:
                        code_lines.append(match.group(0))
                elif 'sound(' in line:
                    match = re.search(r'sound\("[^"]+"\)', line)
                    if match:
                        code_lines.append(match.group(0))
                elif 'note(' in line:
                    match = re.search(r'note\("[^"]+"\)', line)
                    if match:
                        code_lines.append(match.group(0))
                elif 'n(' in line:
                    match = re.search(r'n\("[^"]+"\)', line)
                    if match:
                        code_lines.append(match.group(0))
        
        # If we found some code, return it
        if code_lines:
            return '\n'.join(code_lines)
        
        # Last resort: create a basic marching band composition
        return """setcpm(120)
sound("bd sd hh")
sound("bd sd hh cr")
sound("bd sd, hh cr")
sound("[bd sd]*2, hh*8")"""
    
    def test_connection(self) -> bool:
        """Test if API key and connection work"""
        test_payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": "Hello"}],
            "max_tokens": 10
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers=self.headers,
                json=test_payload,
                timeout=10
            )
            
            if response.status_code == 200:
                print("✅ OpenRouter connection successful")
                return True
            else:
                print(f"❌ OpenRouter connection failed: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ OpenRouter connection error: {e}")
            return False 