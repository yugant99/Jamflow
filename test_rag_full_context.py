#!/usr/bin/env python3
"""
Jamflow RAG + Full Context Test Script
Combines vector search with 100K token comprehensive context for optimal Strudel generation.
"""

import os
import json
import sqlite3
import numpy as np
import requests
from sentence_transformers import SentenceTransformer
import faiss
from typing import List, Dict, Any
from dotenv import load_dotenv
import time

# Load environment variables
load_dotenv()

class FullContextRAGSystem:
    def __init__(self):
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.db_path = "Advanced RAG Pipeline/strudel_rag.db"
        self.knowledge_base_path = "src/scraped_data/enhanced_knowledge_base.json"
        self.gemini_api_key = os.getenv('GEMINI_API_KEY')
        
        # Load components
        self.load_vector_db()
        self.load_knowledge_base()
        
    def load_vector_db(self):
        """Load existing vector database"""
        print("🔍 Loading vector database...")
        
        # Connect to SQLite database
        self.conn = sqlite3.connect(self.db_path)
        cursor = self.conn.cursor()
        
        # Load embeddings and rebuild FAISS index
        cursor.execute("SELECT id, embedding FROM embeddings")
        results = cursor.fetchall()
        
        if not results:
            raise Exception("No embeddings found in database!")
            
        self.doc_ids = []
        embeddings = []
        
        for doc_id, embedding_blob in results:
            self.doc_ids.append(doc_id)
            embedding = np.frombuffer(embedding_blob, dtype=np.float32)
            embeddings.append(embedding)
        
        # Create FAISS index
        embeddings_matrix = np.vstack(embeddings)
        self.index = faiss.IndexFlatIP(embeddings_matrix.shape[1])
        
        # Normalize for cosine similarity
        faiss.normalize_L2(embeddings_matrix)
        self.index.add(embeddings_matrix)
        
        print(f"✅ Loaded {len(self.doc_ids)} embeddings into FAISS index")
        
    def load_knowledge_base(self):
        """Load the enhanced knowledge base"""
        print("📚 Loading enhanced knowledge base...")
        
        with open(self.knowledge_base_path, 'r', encoding='utf-8') as f:
            self.knowledge_base = json.load(f)
            
        print(f"✅ Loaded {len(self.knowledge_base)} knowledge base entries")
        
    def search_vector_db(self, query: str, top_k: int = 25, min_score: float = 0.1) -> List[Dict]:
        """Search vector database for relevant chunks"""
        print(f"🔍 Searching vector DB for: '{query[:50]}...'")
        
        # Create query embedding
        query_embedding = self.model.encode([query])
        faiss.normalize_L2(query_embedding)
        
        # Search FAISS index
        scores, indices = self.index.search(query_embedding, top_k)
        
        # Retrieve matching documents
        results = []
        cursor = self.conn.cursor()
        
        for i, (score, idx) in enumerate(zip(scores[0], indices[0])):
            if score >= min_score:
                doc_id = self.doc_ids[idx]
                cursor.execute("SELECT content FROM documents WHERE id = ?", (doc_id,))
                result = cursor.fetchone()
                
                if result:
                    results.append({
                        'content': result[0],
                        'score': float(score),
                        'rank': i + 1
                    })
        
        print(f"✅ Found {len(results)} relevant chunks (min_score: {min_score})")
        return results
        
    def extract_knowledge_by_category(self, categories: List[str]) -> str:
        """Extract knowledge base content by categories"""
        extracted_content = []
        
        for entry in self.knowledge_base:
            if any(cat.lower() in entry.get('content', '').lower() for cat in categories):
                extracted_content.append(entry['content'])
                
        return '\n'.join(extracted_content)
        
    def detect_query_complexity(self, query: str) -> Dict[str, Any]:
        """Detect query complexity and required knowledge categories"""
        query_lower = query.lower()
        
        # Instrument detection
        instruments = []
        if any(word in query_lower for word in ['piano', 'key', 'chord', 'note']):
            instruments.append('piano')
        if any(word in query_lower for word in ['drum', 'beat', 'rhythm', 'bd', 'sd', 'hh']):
            instruments.append('drums')
        if any(word in query_lower for word in ['bass', 'sub', 'low']):
            instruments.append('bass')
        if any(word in query_lower for word in ['synth', 'lead', 'pad', 'electronic']):
            instruments.append('synth')
            
        # Complexity detection
        complexity_indicators = {
            'simple': ['simple', 'basic', 'easy', 'quick'],
            'intermediate': ['piano', 'multi', 'layer', 'stack', 'effect'],
            'advanced': ['complex', 'polyrhythm', 'experimental', 'advanced', 'fusion', 'jazz']
        }
        
        complexity = 'simple'
        for level, keywords in complexity_indicators.items():
            if any(keyword in query_lower for keyword in keywords):
                complexity = level
                
        # Required categories
        categories = ['basic_patterns', 'sound_patterns']
        if 'piano' in instruments:
            categories.extend(['piano', 'note', 'chord', 'gm_', 'sample'])
        if complexity in ['intermediate', 'advanced']:
            categories.extend(['stack', 'effect', 'bank', 'advanced'])
        if complexity == 'advanced':
            categories.extend(['experimental', 'polyrhythm', 'complex'])
            
        return {
            'complexity': complexity,
            'instruments': instruments,
            'categories': categories,
            'estimated_tokens': 25000 if complexity == 'simple' else 50000 if complexity == 'intermediate' else 100000
        }
        
    def build_comprehensive_prompt(self, query: str, rag_results: List[Dict], query_analysis: Dict) -> str:
        """Build a comprehensive 100K token prompt"""
        
        # Extract relevant knowledge base content
        kb_content = self.extract_knowledge_by_category(query_analysis['categories'])
        
        # Combine RAG results
        rag_content = '\n'.join([result['content'] for result in rag_results])
        
        # Build comprehensive prompt
        prompt = f"""You are Jamflow, the world's most advanced Strudel live-coding music AI. You have access to the complete Strudel documentation and can generate complex, professional-quality musical compositions.

QUERY ANALYSIS:
- Complexity: {query_analysis['complexity']}
- Instruments: {', '.join(query_analysis['instruments']) if query_analysis['instruments'] else 'general'}
- Estimated context needed: {query_analysis['estimated_tokens']} tokens

COMPREHENSIVE STRUDEL DOCUMENTATION:

=== RELEVANT RAG CONTEXT ===
{rag_content}

=== ENHANCED KNOWLEDGE BASE ===
{kb_content}

=== COMPLETE STRUDEL SYNTAX REFERENCE ===

TEMPO AND TIMING:
setcpm(120)  // Sets tempo to 120 BPM
setcpm(140)  // Faster tempo for energetic music

BASIC PATTERNS:
sound("bd sd hh cr")          // Sequential pattern
sound("bd ~ sd ~")            // With rests (~)
sound("bd sd, hh*8")          // Simultaneous patterns with comma
sound("[bd sd]*2")            // Pattern repetition
sound("[bd hh] [sd hh]")      // Grouped simultaneous sounds

REAL SOUND PATTERNS (always use these, NEVER placeholders):
Basic Drums: bd=bass, sd=snare, hh=hihat, cr=crash, oh=open hihat, cp=clap, cb=cowbell
Extended Drums: mt=mid tom, ht=high tom, lt=low tom, rim=rimshot, click=metronome
Real Patterns: "bd sd hh", "bd ~ sd ~", "hh*8", "[bd sd]*2", "bd sd, hh cr"

PIANO AND MELODIC INSTRUMENTS:
// Method 1: Using note() with sound()
note("c3 e3 g3 c4").sound("piano")
note("<c3 e3 g3> <f3 a3 c4>").sound("piano")  // Chord progressions

// Method 2: Using sample banks
sound("piano").note("c3 e3 g3")
sound("piano:1").note("c3")  // Specific piano sample

// Method 3: GM Instruments
note("c3 e3 g3").sound("gm_acoustic_grand_piano")
note("c3 e3 g3").sound("gm_electric_piano_1")

ADVANCED MULTI-INSTRUMENT TECHNIQUES:
// Method 1: Comma separation for simple layering
sound("bd sd hh, cr ~ hh ~, cb*4")

// Method 2: Stack function for complex arrangements
stack(
  sound("bd sd hh cr").gain(0.8),
  sound("hh*8").gain(0.6),
  note("c3 e3 g3").sound("piano").gain(0.7)
)

// Method 3: Separate tracks with different timing
$: sound("bd sd").slow(2)
$: sound("hh*8").fast(2)
$: note("c3 e3 g3").sound("piano")

EFFECTS AND PROCESSING:
.gain(0.7)      // Volume control
.lpf(800)       // Low-pass filter
.delay(0.25)    // Echo effect
.room(0.5)      // Reverb
.pan(0.3)       // Stereo positioning
.crush(4)       // Bit crushing
.distort(0.5)   // Distortion

USER QUERY: {query}

INSTRUCTIONS:
1. Generate complete, runnable Strudel code that produces actual sound
2. Use ONLY real sound patterns and instrument names from the documentation above
3. Always start with setcpm() to set appropriate tempo
4. For piano requests, use proper note() syntax with real chord progressions
5. Balance volumes with .gain() when layering multiple instruments
6. Include comprehensive comments explaining the musical structure
7. Generate professional-quality compositions appropriate for the complexity level
8. Ensure all patterns use real drum abbreviations and instrument names

Generate a comprehensive response with detailed explanation and complete, runnable code:
"""

        return prompt
        
    def call_gemini_api(self, prompt: str) -> str:
        """Call Gemini 2.5 Flash with the comprehensive prompt"""
        print(f"🤖 Calling Gemini 2.5 Flash with {len(prompt)} character prompt...")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={self.gemini_api_key}"
        
        payload = {
            "contents": [{
                "parts": [{"text": prompt}]
            }],
            "generationConfig": {
                "maxOutputTokens": 4000,
                "temperature": 0.7,
                "topP": 0.8
            }
        }
        
        start_time = time.time()
        
        try:
            response = requests.post(url, json=payload, timeout=60)
            response.raise_for_status()
            
            result = response.json()
            
            if 'candidates' in result and result['candidates']:
                content = result['candidates'][0]['content']['parts'][0]['text']
                
                response_time = time.time() - start_time
                print(f"✅ Gemini response received in {response_time:.2f}s")
                
                return content
            else:
                raise Exception("No content in Gemini response")
                
        except Exception as e:
            print(f"❌ Gemini API error: {e}")
            return f"Error calling Gemini API: {e}"
            
    def generate_music(self, query: str) -> Dict[str, Any]:
        """Complete pipeline: RAG search + knowledge base + Gemini generation"""
        print(f"\n🎵 JAMFLOW FULL CONTEXT GENERATION")
        print(f"Query: {query}")
        print("=" * 60)
        
        # 1. Analyze query complexity
        query_analysis = self.detect_query_complexity(query)
        print(f"📊 Query Analysis: {query_analysis}")
        
        # 2. Search vector database
        rag_results = self.search_vector_db(query, top_k=25, min_score=0.1)
        
        # 3. Build comprehensive prompt
        prompt = self.build_comprehensive_prompt(query, rag_results, query_analysis)
        
        print(f"📝 Built comprehensive prompt: {len(prompt)} characters (~{len(prompt)//4} tokens)")
        
        # 4. Generate with Gemini
        response = self.call_gemini_api(prompt)
        
        return {
            'query': query,
            'analysis': query_analysis,
            'rag_results_count': len(rag_results),
            'prompt_length': len(prompt),
            'response': response,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S')
        }

def main():
    """Test the full context RAG system"""
    print("🚀 Initializing Jamflow Full Context RAG System...")
    
    try:
        rag_system = FullContextRAGSystem()
        
        # Test queries of different complexity levels
        test_queries = [
            "create a simple drum beat at 120 BPM",
            "generate a piano melody with chord progressions in C major",
            "create a complex jazz fusion beat with polyrhythmic drums and piano",
            "make an ambient soundscape with synthesizer pads and effects",
            "generate a drum roll with snare buildup"
        ]
        
        print(f"\n🧪 Testing {len(test_queries)} queries...\n")
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n{'='*20} TEST {i}/{len(test_queries)} {'='*20}")
            
            result = rag_system.generate_music(query)
            
            print(f"\n📊 RESULTS:")
            print(f"- Complexity: {result['analysis']['complexity']}")
            print(f"- Instruments: {result['analysis']['instruments']}")
            print(f"- RAG chunks: {result['rag_results_count']}")
            print(f"- Prompt size: {result['prompt_length']} chars")
            print(f"\n🎵 GENERATED STRUDEL CODE:")
            print("-" * 40)
            print(result['response'])
            print("-" * 40)
            
            # Rate limiting for free tier (10 RPM)
            if i < len(test_queries):
                print("\n⏱️  Waiting 6 seconds for rate limiting...")
                time.sleep(6)
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
