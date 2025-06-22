"""
Quick test of a single RAG query with Gemini 2.5 Flash
"""

import sys
import os
from pathlib import Path
import json
import time
import requests
from typing import Dict, Any, List
import sqlite3
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add Advanced RAG Pipeline to path
sys.path.insert(0, str(Path(__file__).parent / "Advanced RAG Pipeline" / "src"))

from database.vector_db import VectorDatabase
from retrieval.basic_search import BasicSearcher


class GeminiRAGSystem:
    """RAG System using Gemini 2.5 Flash HTTP API for generation"""
    
    def __init__(self, db_path: str = "Advanced RAG Pipeline/strudel_rag.db"):
        """Initialize RAG system with Gemini HTTP API"""
        print("🎵 Initializing Gemini RAG System...")
        
        # Setup Gemini API
        self.api_key = os.getenv('GEMINI_API_KEY')
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        self.gemini_url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
        print("✅ Gemini 2.5 Flash API configured")
        
        # Load vector database
        print("📊 Loading vector database...")
        self.vector_db = VectorDatabase(db_path=db_path)
        
        # Initialize searcher
        print("🔍 Setting up semantic search...")
        self.searcher = BasicSearcher(self.vector_db)
        
        print("✅ RAG System ready!")
    
    def quick_test(self, query: str = "Create a simple drum pattern at 120 BPM"):
        """Quick test with a simple query"""
        print(f"\n🎵 QUICK RAG TEST")
        print(f"❓ Query: {query}")
        
        # Get context
        search_results = self.searcher.search(query=query, top_k=5, min_score=0.2)
        context = self.format_simple_context(search_results)
        
        print(f"📊 Found {len(search_results)} results")
        print(f"📊 Context length: {len(context)} chars")
        
        # Simple prompt
        prompt = f"""You are a Strudel music programming assistant. Use the context below to answer the user's question.

STRUDEL CONTEXT:
{context}

USER QUESTION: {query}

Generate runnable Strudel code with explanation. Use real drum sounds like bd, sd, hh, cr.

RESPONSE:"""
        
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'maxOutputTokens': 4000,
                'temperature': 0.7,
                'topP': 0.8
            }
        }
        
        try:
            print(f"📝 Sending to Gemini...")
            response = requests.post(
                self.gemini_url,
                headers={'Content-Type': 'application/json'},
                params={'key': self.api_key},
                json=payload,
                timeout=30
            )
            
            print(f"📊 Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                usage = result.get('usageMetadata', {})
                
                print(f"📊 Tokens - Total: {usage.get('totalTokenCount', 0)}, Output: {usage.get('candidatesTokenCount', 0)}, Thoughts: {usage.get('thoughtsTokenCount', 0)}")
                
                if 'candidates' in result and result['candidates']:
                    candidate = result['candidates'][0]
                    content = candidate.get('content', {})
                    
                    if 'parts' in content and content['parts']:
                        text = content['parts'][0].get('text', '')
                        if text.strip():
                            print(f"\n✅ SUCCESS! Response generated:")
                            print("─" * 50)
                            print(text)
                            print("─" * 50)
                            return True
                        else:
                            print(f"❌ Empty text content")
                    else:
                        print(f"❌ No parts in content")
                        
                        # Debug the response structure
                        print(f"🔍 Candidate keys: {list(candidate.keys())}")
                        for key, value in candidate.items():
                            if isinstance(value, str) and len(value) > 20:
                                print(f"   {key}: {value[:100]}...")
                            elif isinstance(value, dict):
                                print(f"   {key}: {list(value.keys())}")
                else:
                    print(f"❌ No candidates in response")
                    print(f"🔍 Response keys: {list(result.keys())}")
            else:
                print(f"❌ API Error: {response.text[:500]}")
                
        except Exception as e:
            print(f"❌ Exception: {e}")
            
        return False
    
    def format_simple_context(self, search_results):
        """Simple context formatting"""
        if not search_results:
            return "No relevant context found."
        
        context_parts = []
        for i, chunk in enumerate(search_results[:3], 1):  # Only top 3
            context_parts.append(f"[Context {i}] {chunk['title']}")
            context_parts.append(chunk['content'][:500] + "...")  # Truncate for simplicity
            if chunk['code_examples']:
                context_parts.append(f"Code: {chunk['code_examples'][0]}")
            context_parts.append("---")
        
        return "\n".join(context_parts)


def main():
    try:
        rag = GeminiRAGSystem()
        success = rag.quick_test("Create a simple drum pattern at 120 BPM")
        
        if success:
            print(f"\n🎉 RAG + Gemini 2.5 Flash working perfectly!")
        else:
            print(f"\n⚠️  Need to debug further")
            
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
