"""
Standalone RAG System with Gemini 2.5 Flash

Test script to combine Strudel vector search with Gemini 2.5 Flash generation.
"""

import sys
import os
from pathlib import Path
import json
import time
from typing import Dict, Any, List
import sqlite3
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Add Advanced RAG Pipeline to path
sys.path.insert(0, str(Path(__file__).parent / "Advanced RAG Pipeline" / "src"))

from database.vector_db import VectorDatabase
from retrieval.basic_search import BasicSearcher


class GeminiRAGSystem:
    """RAG System using Gemini 2.5 Flash for generation"""
    
    def __init__(self, db_path: str = "Advanced RAG Pipeline/strudel_rag.db"):
        """Initialize RAG system with Gemini"""
        print("🎵 Initializing Gemini RAG System...")
        
        # Setup Gemini API
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        print("✅ Gemini 2.5 Flash connected")
        
        # Load vector database
        print("📊 Loading vector database...")
        self.vector_db = VectorDatabase(db_path=db_path)
        
        # Initialize searcher
        print("🔍 Setting up semantic search...")
        self.searcher = BasicSearcher(self.vector_db)
        
        print("✅ RAG System ready!")
    
    def query(self, 
              user_query: str, 
              top_k: int = 10, 
              min_score: float = 0.2,
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
            print(f"   Functions: {search_summary['functions_found']}")
            print(f"   Concepts: {search_summary['concepts_found']}")
            print(f"   Sources: {search_summary['sources']}")
        
        # Step 2: Format context
        print(f"\n📝 STEP 2: Formatting context for Gemini...")
        context = self.searcher.format_context_for_llm(search_results)
        
        if show_context:
            print(f"\n📄 RETRIEVED CONTEXT:")
            print("─" * 50)
            print(context[:500] + "..." if len(context) > 500 else context)
            print("─" * 50)
        
        # Step 3: Generate response with Gemini
        print(f"\n🤖 STEP 3: Generating response with Gemini 2.5 Flash...")
        generation_start = time.time()
        
        gemini_result = self.generate_with_gemini(
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
        else:
            print(f"❌ Error: {gemini_result.get('error', 'Unknown error')}")
        print("─" * 50)
        
        return result
    
    def generate_with_gemini(self, query: str, context: str) -> Dict[str, Any]:
        """Generate response using Gemini 2.5 Flash"""
        
        # Create enhanced prompt for Strudel music generation
        prompt = self._build_strudel_prompt(query, context)
        
        try:
            print(f"📝 Query: {query}")
            print(f"📊 Context length: {len(context)} chars")
            
            # Call Gemini API
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=1500,
                    temperature=0.7,
                    top_p=0.8
                )
            )
            
            response_text = response.text
            
            print(f"✅ Response generated successfully")
            print(f"📈 Response length: {len(response_text)} chars")
            
            return {
                "success": True,
                "response": response_text,
                "model": "gemini-2.5-flash",
                "query": query,
                "context_length": len(context)
            }
            
        except Exception as e:
            error_msg = f"Gemini generation error: {str(e)}"
            print(f"❌ {error_msg}")
            return {
                "success": False,
                "error": error_msg,
                "query": query
            }
    
    def _build_strudel_prompt(self, query: str, context: str) -> str:
        """Build enhanced prompt for Strudel music generation"""
        
        prompt = f"""You are Jamflow, an AI assistant specialized in music creation using Strudel (a live-coding music environment).

RETRIEVED STRUDEL DOCUMENTATION:
{context}

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

MULTIPLE INSTRUMENTS PLAYING SIMULTANEOUSLY:
// Use commas to create layered patterns
sound("bd sd hh, cr ~ hh ~, cb*4")
sound("bd bd sd ~, hh*8, oh ~ ~ oh")
sound("[bd sd]*2, [hh hh]*4, cr ~ ~ cr")

// Use stack() for complex layering
stack(
  sound("bd sd hh"),
  sound("cr ~ hh ~").gain(0.7),
  sound("cb*8").gain(0.5)
)

// Use different instruments with .bank()
sound("bd sd hh").bank("RolandTR808")
sound("hh*8").bank("RolandTR909").gain(0.6)
note("c3 e3 g3").bank("piano")

IMPORTANT INSTRUCTIONS:
1. Use ONLY real sound patterns like "bd", "sd", "hh", "cr", "oh", "cp", "cb", "mt", "ht", "lt"
2. NEVER use placeholder names like "pattern1", "pattern2", "pattern" 
3. Create simultaneous patterns using commas for simple layering
4. Use stack() function for complex multi-instrument arrangements
5. Use real drum abbreviations: bd=bass drum, sd=snare, hh=hihat, cr=crash, oh=open hihat, cp=clap, cb=cowbell
6. For multiple instruments, layer different rhythmic patterns that complement each other
7. Use .gain() to balance volume levels between instruments
8. Use .bank() to select different instrument sounds
9. Generate complete, runnable Strudel code that creates rich, multi-layered music
10. Include tempo setting with setcpm() at the beginning
11. Create musical patterns that sound good together

USER REQUEST: {query}

Based on the retrieved documentation and your knowledge, provide a helpful response. If generating Strudel code, create multi-instrument patterns that sound musical and interesting. Always explain what the code does and how the patterns work together.

Response:"""
        
        return prompt
    
    def test_conversational(self, query: str) -> Dict[str, Any]:
        """Test conversational response without RAG"""
        
        prompt = f"""You are Jamflow, a friendly AI assistant that specializes in music creation and Strudel live-coding. You can have normal conversations while being particularly knowledgeable about music, audio production, and creative coding.

User message: {query}

Respond naturally and helpfully. If the conversation turns to music or if the user wants to create beats/patterns, you can offer to help generate Strudel code. Be conversational, friendly, and engaging.

Response:"""
        
        try:
            response = self.model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=1000,
                    temperature=0.7,
                    top_p=0.8
                )
            )
            
            return {
                "success": True,
                "response": response.text,
                "model": "gemini-2.5-flash",
                "type": "conversational"
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "type": "conversational"
            }


def main():
    """Test the Gemini RAG system"""
    try:
        # Initialize system
        rag = GeminiRAGSystem()
        
        # Test queries
        test_queries = [
            "Create an energetic drum pattern at 140 BPM with multiple instruments",
            "How do I make bass sounds in Strudel?",
            "Generate a jazz-style rhythm with piano and drums",
            "What day is it today?",  # Non-music query
            "Create a complex polyrhythmic pattern with 3 different drum sounds"
        ]
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n{'='*80}")
            print(f"TEST {i}: {query}")
            print('='*80)
            
            # Determine if it's a music query
            music_keywords = ['drum', 'pattern', 'bass', 'rhythm', 'create', 'generate', 'music', 'strudel']
            is_music_query = any(keyword in query.lower() for keyword in music_keywords)
            
            if is_music_query:
                # Use RAG for music queries
                result = rag.query(
                    user_query=query,
                    top_k=8,
                    min_score=0.2,
                    show_context=False  # Set to True to see context
                )
                print(f"\n📊 RAG STATS:")
                print(f"   Success: {result['success']}")
                print(f"   Results found: {result['search_summary']['total_results']}")
                print(f"   Functions: {result['search_summary']['functions_found'][:5]}")
                print(f"   Total time: {result['timing']['total_time']}s")
                
            else:
                # Use conversational mode for non-music queries
                print("💬 Using conversational mode (no RAG)")
                result = rag.test_conversational(query)
                
                print(f"\n💬 CONVERSATIONAL RESPONSE:")
                print("─" * 50)
                if result["success"]:
                    print(result["response"])
                else:
                    print(f"❌ Error: {result['error']}")
                print("─" * 50)
            
            # Wait between queries
            if i < len(test_queries):
                print(f"\n⏳ Waiting 2 seconds before next query...")
                time.sleep(2)
        
        print(f"\n🎉 All tests completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
