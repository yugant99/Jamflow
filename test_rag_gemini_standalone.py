"""
Standalone RAG System with Gemini 2.5 Flash using HTTP requests

Test script that combines Strudel vector search with Gemini 2.5 Flash generation.
Uses the same HTTP approach as test_gemini_25_flash.py.
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
    
    def query(self, 
              user_query: str, 
              top_k: int = 15,  # More results for huge context window
              min_score: float = 0.15,  # Lower threshold for more context
              show_context: bool = True) -> Dict[str, Any]:
        """
        Complete RAG query: search + generate response with Gemini
        """
        start_time = time.time()
        
        print(f"\n{'='*60}")
        print(f"🎵 GEMINI RAG QUERY")
        print(f"{'='*60}")
        print(f"❓ Question: {user_query}")
        print()
        
        # Step 1: Vector search
        print("🔍 STEP 1: Searching vector database...")
        search_start = time.time()
        
        search_results = self.searcher.search(
            query=user_query, 
            top_k=top_k, 
            min_score=min_score
        )
        
        search_time = time.time() - search_start
        print(f"⏱️  Search completed in {search_time:.2f}s")
        
        # Get search summary
        search_summary = self.searcher.get_search_summary(user_query, search_results)
        
        if show_context:
            print(f"\n📋 SEARCH SUMMARY:")
            print(f"   Results: {search_summary['total_results']}")
            print(f"   Avg Score: {search_summary['avg_score']}")
            print(f"   Score Range: {search_summary['score_range']}")
            print(f"   Functions: {search_summary['functions_found'][:10]}")  # Show more
            print(f"   Concepts: {search_summary['concepts_found']}")
            print(f"   Sources: {search_summary['sources']}")
        
        # Step 2: Format context - Use MUCH more context for Gemini 2.5 Flash
        print(f"\n📝 STEP 2: Formatting extensive context for Gemini...")
        context = self.format_extensive_context(search_results)
        
        if show_context:
            print(f"\n📄 RETRIEVED CONTEXT:")
            print("─" * 50)
            print(f"Context length: {len(context)} characters")
            print(context[:800] + "..." if len(context) > 800 else context)
            print("─" * 50)
        
        # Step 3: Generate response with Gemini
        print(f"\n🤖 STEP 3: Generating response with Gemini 2.5 Flash...")
        generation_start = time.time()
        
        gemini_result = self.generate_with_gemini_http(
            query=user_query,
            context=context
        )
        
        generation_time = time.time() - generation_start
        total_time = time.time() - start_time
        
        print(f"⏱️  Generation completed in {generation_time:.2f}s")
        print(f"⏱️  Total time: {total_time:.2f}s")
        
        # Step 4: Compile final result
        result = {
            "query": user_query,
            "search_results": search_results,
            "search_summary": search_summary,
            "context": context,
            "gemini_result": gemini_result,
            "timing": {
                "search_time": round(search_time, 2),
                "generation_time": round(generation_time, 2),
                "total_time": round(total_time, 2)
            },
            "success": gemini_result.get("success", False)
        }
        
        # Display final response
        print(f"\n💬 FINAL RESPONSE:")
        print("─" * 50)
        if result["success"]:
            print(gemini_result["response"])
            
            # Analyze the response quality
            self.analyze_response_quality(gemini_result["response"], user_query)
        else:
            print(f"❌ Error: {gemini_result.get('error', 'Unknown error')}")
        print("─" * 50)
        
        return result
    
    def format_extensive_context(self, search_results: List[Dict[str, Any]]) -> str:
        """Format search results into extensive context for Gemini's huge context window"""
        if not search_results:
            return "No relevant context found."
        
        context_parts = []
        context_parts.append("=== COMPREHENSIVE STRUDEL DOCUMENTATION CONTEXT ===\n")
        
        # Add all functions and concepts found
        all_functions = set()
        all_concepts = set()
        for chunk in search_results:
            all_functions.update(chunk.get('strudel_functions', []))
            all_concepts.update(chunk.get('music_concepts', []))
        
        if all_functions:
            context_parts.append(f"STRUDEL FUNCTIONS AVAILABLE: {', '.join(sorted(all_functions))}\n")
        
        if all_concepts:
            context_parts.append(f"MUSIC CONCEPTS COVERED: {', '.join(sorted(all_concepts))}\n")
        
        context_parts.append("=== DETAILED DOCUMENTATION CHUNKS ===\n")
        
        for i, chunk in enumerate(search_results, 1):
            context_parts.append(f"[Context Chunk {i}] (Relevance Score: {chunk['similarity_score']:.3f})")
            context_parts.append(f"Source: {chunk['source_url']}")
            context_parts.append(f"Topic: {chunk['title']}")
            context_parts.append(f"Difficulty: {chunk.get('difficulty_level', 'unknown')}")
            
            if chunk['strudel_functions']:
                context_parts.append(f"Functions: {', '.join(chunk['strudel_functions'])}")
            
            if chunk['music_concepts']:
                context_parts.append(f"Concepts: {', '.join(chunk['music_concepts'])}")
            
            context_parts.append(f"Content:\n{chunk['content']}")
            
            # Include ALL code examples for better context
            if chunk['code_examples']:
                context_parts.append("Code Examples:")
                for j, code in enumerate(chunk['code_examples'], 1):
                    context_parts.append(f"  Example {j}: {code}")
            
            context_parts.append("---\n")
        
        return "\n".join(context_parts)
    
    def generate_with_gemini_http(self, query: str, context: str) -> Dict[str, Any]:
        """Generate response using Gemini 2.5 Flash HTTP API"""
        
        # Create enhanced prompt for Strudel music generation
        prompt = self._build_comprehensive_strudel_prompt(query, context)
        
        payload = {
            'contents': [{
                'parts': [{'text': prompt}]
            }],
            'generationConfig': {
                'maxOutputTokens': 4000,  # Much higher for reasoning models
                'temperature': 0.7,
                'topP': 0.8
            }
        }
        
        try:
            print(f"📝 Query: {query}")
            print(f"📊 Context length: {len(context)} chars")
            print(f"📊 Total prompt length: {len(prompt)} chars")
            
            response = requests.post(
                self.gemini_url,
                headers={'Content-Type': 'application/json'},
                params={'key': self.api_key},
                json=payload,
                timeout=45  # Longer timeout for complex queries
            )
            
            print(f"📊 Response Status: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                usage = result.get('usageMetadata', {})
                
                print(f"📊 Token Usage:")
                print(f"   Total: {usage.get('totalTokenCount', 0)}")
                print(f"   Input: {usage.get('promptTokenCount', 0)}")
                print(f"   Output: {usage.get('candidatesTokenCount', 0)}")
                print(f"   Thoughts: {usage.get('thoughtsTokenCount', 0)}")
                
                # Check if it's a reasoning model
                is_reasoning = usage.get('thoughtsTokenCount', 0) > 0
                print(f"🤔 Reasoning model: {is_reasoning}")
                
                # Extract content
                if 'candidates' in result and result['candidates']:
                    candidate = result['candidates'][0]
                    content = candidate.get('content', {})
                    
                    if 'parts' in content and content['parts']:
                        text = content['parts'][0].get('text', '')
                        if text.strip():
                            print(f"✅ Response generated successfully")
                            print(f"📈 Response length: {len(text)} chars")
                            
                            return {
                                "success": True,
                                "response": text,
                                "model": "gemini-2.5-flash",
                                "query": query,
                                "context_length": len(context),
                                "is_reasoning": is_reasoning,
                                "usage": usage
                            }
                
                return {
                    "success": False,
                    "error": "No text content in response",
                    "query": query
                }
            else:
                error_msg = f"API Error {response.status_code}: {response.text[:500]}"
                print(f"❌ {error_msg}")
                return {
                    "success": False,
                    "error": error_msg,
                    "query": query
                }
                
        except Exception as e:
            error_msg = f"Gemini generation error: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "query": query
            }
    
    def _build_comprehensive_strudel_prompt(self, query: str, context: str) -> str:
        """Build comprehensive prompt leveraging Gemini's huge context window"""
        
        prompt = f"""You are Jamflow, an expert AI assistant specialized in Strudel live-coding music creation. You have access to comprehensive Strudel documentation and can create complex, multi-layered musical patterns.

COMPREHENSIVE STRUDEL DOCUMENTATION:
{context}

REAL SOUND PATTERNS (always use these, NEVER placeholders):
Basic Drums: bd=bass, sd=snare, hh=hihat, cr=crash, oh=open hihat, cp=clap, cb=cowbell
Extended Drums: mt=mid tom, ht=high tom, lt=low tom, rim=rimshot, click=metronome
Instruments: piano, bass, lead, pad, strings, brass, organ

TEMPO AND TIMING:
setcpm(120)  // Sets tempo to 120 BPM
setcpm(140)  // Faster tempo for energetic music

BASIC PATTERNS:
sound("bd sd hh cr")          // Sequential pattern
sound("bd ~ sd ~")            // With rests
sound("bd sd, hh*8")          // Simultaneous patterns with comma
sound("[bd sd]*2")            // Pattern repetition

ADVANCED MULTI-INSTRUMENT TECHNIQUES:
// Method 1: Comma separation for simple layering
sound("bd sd hh, cr ~ hh ~, cb*4")

// Method 2: Stack function for complex arrangements
stack(
  sound("bd sd hh"),
  sound("cr ~ hh ~").gain(0.7),
  sound("cb*8").gain(0.5)
)

// Method 3: Different instrument banks
sound("bd sd hh").bank("RolandTR808")
sound("hh*8").bank("RolandTR909").gain(0.6)
note("c3 e3 g3").bank("piano")

// Method 4: Separate tracks with different timing
sound("bd sd").slow(2)
sound("hh*8").fast(2)
sound("cr ~ ~ cr")

EFFECTS AND PROCESSING:
.gain(0.7)      // Volume control
.lpf(800)       // Low-pass filter
.delay(0.25)    // Echo effect
.room(0.5)      // Reverb
.pan(0.3)       // Stereo positioning

USER REQUEST: {query}

INSTRUCTIONS:
1. Use ONLY real sound patterns and instrument names from the documentation above
2. Create rich, multi-layered compositions using multiple techniques
3. Always start with setcpm() to set the tempo
4. Balance volumes with .gain() when layering multiple instruments
5. Include explanations of how the patterns work together musically
6. Generate complete, runnable Strudel code that sounds professional
7. Use the retrieved documentation to inform your musical choices
8. Create patterns that complement each other rhythmically and harmonically

Provide a comprehensive response with both explanation and code:"""
        
        return prompt
    
    def analyze_response_quality(self, response: str, query: str):
        """Analyze the quality of the generated response"""
        print(f"\n📊 RESPONSE QUALITY ANALYSIS:")
        
        # Code quality checks
        has_setcpm = 'setcpm(' in response
        has_sound = 'sound(' in response
        has_drums = any(drum in response for drum in ['bd', 'sd', 'hh', 'cr', 'oh', 'cp', 'cb'])
        has_simultaneous = ',' in response and 'sound(' in response
        has_stack = 'stack(' in response
        has_effects = any(effect in response for effect in ['.gain(', '.lpf(', '.delay(', '.room('])
        no_placeholders = not any(p in response.lower() for p in ['pattern1', 'pattern2', 'example', 'placeholder'])
        has_explanation = len(response.split('\n')) > 5  # Multi-line response with explanation
        
        checks = [
            ("Has setcpm()", has_setcpm),
            ("Has sound()", has_sound),
            ("Has drum sounds", has_drums),
            ("Has simultaneous patterns", has_simultaneous),
            ("Has stack() layering", has_stack),
            ("Has effects", has_effects),
            ("No placeholders", no_placeholders),
            ("Has explanation", has_explanation)
        ]
        
        for check_name, passed in checks:
            status = "✅" if passed else "❌"
            print(f"   {status} {check_name}: {passed}")
        
        score = sum(passed for _, passed in checks)
        print(f"\n🎯 Overall Score: {score}/{len(checks)}")
        
        if score >= 7:
            print(f"🏆 EXCELLENT! Perfect for production use!")
        elif score >= 5:
            print(f"✅ GOOD! Ready for integration!")
        elif score >= 3:
            print(f"⚠️  OKAY! Needs some improvements")
        else:
            print(f"❌ POOR! Requires significant work")
        
        return score


def main():
    """Test the Gemini RAG system with various queries"""
    try:
        # Initialize system
        rag = GeminiRAGSystem()
        
        # Test queries showcasing different capabilities
        test_queries = [
            "Create an energetic rock drum pattern at 140 BPM with multiple instruments playing simultaneously",
            "Generate a complex polyrhythmic pattern with bass drum, snare, and hi-hat using stack() function",
            "How do I create ambient soundscapes in Strudel with effects and filtering?",
            "Make a jazz-style rhythm with piano, bass, and drums that complement each other",
            "Create a marching band pattern with multiple drum types and dynamic volume control"
        ]
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n{'='*80}")
            print(f"TEST {i}/{len(test_queries)}: {query}")
            print('='*80)
            
            result = rag.query(
                user_query=query,
                top_k=12,  # More context for better results
                min_score=0.15,  # Lower threshold for more comprehensive context
                show_context=False  # Set to True to see full context
            )
            
            print(f"\n📊 RAG PERFORMANCE SUMMARY:")
            print(f"   Success: {result['success']}")
            print(f"   Results found: {result['search_summary']['total_results']}")
            print(f"   Functions available: {len(result['search_summary']['functions_found'])}")
            print(f"   Context size: {len(result['context'])} chars")
            print(f"   Total time: {result['timing']['total_time']}s")
            print(f"   Search time: {result['timing']['search_time']}s")
            print(f"   Generation time: {result['timing']['generation_time']}s")
            
            if result['success']:
                usage = result['gemini_result'].get('usage', {})
                print(f"   Token usage: {usage.get('totalTokenCount', 0)}")
                print(f"   Is reasoning model: {result['gemini_result'].get('is_reasoning', False)}")
            
            # Wait between queries to avoid rate limits
            if i < len(test_queries):
                print(f"\n⏳ Waiting 3 seconds before next query...")
                time.sleep(3)
        
        print(f"\n🎉 All tests completed! Gemini 2.5 Flash + RAG system is ready for integration!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
