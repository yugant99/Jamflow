"""
Basic Semantic Search for Strudel RAG

Fast, simple vector similarity search using FAISS.
Perfect for hackathon - 50-100ms latency.
"""

import numpy as np
import json
from typing import List, Dict, Any, Optional
import faiss


class BasicSearcher:
    """Simple semantic search using FAISS vector similarity"""
    
    def __init__(self, vector_db):
        """Initialize with existing vector database"""
        self.db = vector_db
        self.model = vector_db.model
        self.faiss_index = vector_db.faiss_index
        self.chunk_id_map = vector_db.chunk_id_map
    
    def search(self, query: str, top_k: int = 15, min_score: float = 0.2) -> List[Dict[str, Any]]:
        """
        Search for similar chunks using semantic similarity
        
        Args:
            query: User's question/query
            top_k: Number of results to return
            min_score: Minimum similarity score (0-1)
            
        Returns:
            List of relevant chunks with metadata
        """
        if not self.faiss_index or not self.chunk_id_map:
            print("⚠️  FAISS index not available, rebuilding...")
            self.db._build_faiss_index()
            self.faiss_index = self.db.faiss_index
            self.chunk_id_map = self.db.chunk_id_map
        
        # Encode query to vector
        print(f"🔍 Searching for: '{query}'")
        query_vector = self.model.encode([query])
        
        # Normalize for cosine similarity
        faiss.normalize_L2(query_vector)
        
        # Search FAISS index - get more candidates for better filtering
        scores, indices = self.faiss_index.search(query_vector, min(top_k * 3, 50))  # Get extra for filtering
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:  # No more results
                break
                
            if score < min_score:  # Skip low-quality matches
                continue
                
            # Get chunk ID and retrieve full chunk data
            chunk_id = self.chunk_id_map.get(idx)
            if chunk_id:
                chunk_data = self._get_chunk_data(chunk_id)
                if chunk_data:
                    chunk_data['similarity_score'] = float(score)
                    results.append(chunk_data)
        
        # Limit to requested number
        results = results[:top_k]
        
        print(f"📊 Found {len(results)} relevant chunks")
        for i, result in enumerate(results):
            print(f"   {i+1}. Score: {result['similarity_score']:.3f} | {result['title'][:50]}...")
        
        return results
    
    def _get_chunk_data(self, chunk_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve full chunk data from database"""
        try:
            result = self.db.conn.execute("""
                SELECT id, source_url, title, content, strudel_functions, 
                       music_concepts, code_examples, difficulty_level, chunk_size
                FROM chunks WHERE id = ?
            """, (chunk_id,)).fetchone()
            
            if result:
                return {
                    'id': result[0],
                    'source_url': result[1], 
                    'title': result[2],
                    'content': result[3],
                    'strudel_functions': json.loads(result[4]) if result[4] else [],
                    'music_concepts': json.loads(result[5]) if result[5] else [],
                    'code_examples': json.loads(result[6]) if result[6] else [],
                    'difficulty_level': result[7],
                    'chunk_size': result[8]
                }
        except Exception as e:
            print(f"⚠️  Error retrieving chunk {chunk_id}: {e}")
        
        return None
    
    def format_context_for_llm(self, search_results: List[Dict[str, Any]]) -> str:
        """Format search results into context for LLM"""
        if not search_results:
            return "No relevant context found."
        
        context_parts = []
        context_parts.append("=== STRUDEL DOCUMENTATION CONTEXT ===\n")
        
        for i, chunk in enumerate(search_results, 1):
            context_parts.append(f"[Context {i}] (Score: {chunk['similarity_score']:.3f})")
            context_parts.append(f"Source: {chunk['source_url']}")
            context_parts.append(f"Topic: {chunk['title']}")
            
            if chunk['strudel_functions']:
                context_parts.append(f"Functions: {', '.join(chunk['strudel_functions'])}")
            
            if chunk['music_concepts']:
                context_parts.append(f"Concepts: {', '.join(chunk['music_concepts'])}")
            
            context_parts.append(f"Content: {chunk['content']}")
            
            if chunk['code_examples']:
                context_parts.append("Code Examples:")
                for j, code in enumerate(chunk['code_examples'][:5]):  # Show more examples
                    context_parts.append(f"  {j+1}. {code}")
            
            context_parts.append("---\n")
        
        return "\n".join(context_parts)
    
    def get_search_summary(self, query: str, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Get summary of search results for debugging/logging"""
        if not results:
            return {
                "query": query,
                "total_results": 0,
                "avg_score": 0,
                "functions_found": [],
                "concepts_found": [],
                "sources": []
            }
        
        # Aggregate statistics
        all_functions = set()
        all_concepts = set()
        all_sources = set()
        
        for result in results:
            all_functions.update(result.get('strudel_functions', []))
            all_concepts.update(result.get('music_concepts', []))
            all_sources.add(result.get('source_url', ''))
        
        avg_score = sum(r['similarity_score'] for r in results) / len(results)
        
        return {
            "query": query,
            "total_results": len(results),
            "avg_score": round(avg_score, 3),
            "score_range": f"{min(r['similarity_score'] for r in results):.3f} - {max(r['similarity_score'] for r in results):.3f}",
            "functions_found": sorted(list(all_functions)),
            "concepts_found": sorted(list(all_concepts)),
            "sources": len(all_sources),
            "difficulty_levels": [r.get('difficulty_level', 'unknown') for r in results]
        } 