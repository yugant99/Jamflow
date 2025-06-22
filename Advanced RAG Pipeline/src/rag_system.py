"""
Complete Strudel RAG System

Combines vector search + OpenRouter generation for Strudel documentation queries.
"""

import sys
from pathlib import Path
from typing import Dict, Any, List
import time

# Add modules to path
sys.path.insert(0, str(Path(__file__).parent))

from database.vector_db import VectorDatabase
from retrieval.basic_search import BasicSearcher
from generation.openrouter_client import OpenRouterClient


class StrudelRAG:
    """Complete RAG system for Strudel documentation queries"""
    
    def __init__(self, db_path: str = "strudel_rag.db"):
        """Initialize RAG system with vector DB and LLM client"""
        print("🎵 Initializing Strudel RAG System...")
        
        # Load vector database
        print("📊 Loading vector database...")
        self.vector_db = VectorDatabase(db_path=db_path)
        
        # Initialize searcher
        print("🔍 Setting up semantic search...")
        self.searcher = BasicSearcher(self.vector_db)
        
        # Initialize LLM client
        print("🤖 Connecting to OpenRouter...")
        self.llm_client = OpenRouterClient()
        
        # Test connection
        if not self.llm_client.test_connection():
            raise ConnectionError("Failed to connect to OpenRouter API")
        
        print("✅ RAG System ready!")
    
    def query(self, 
              user_query: str, 
              top_k: int = 15, 
              min_score: float = 0.2,
              show_context: bool = True) -> Dict[str, Any]:
        """
        Complete RAG query: search + generate response
        
        Args:
            user_query: User's question about Strudel
            top_k: Number of context chunks to retrieve
            min_score: Minimum similarity score for chunks
            show_context: Whether to show retrieved context
            
        Returns:
            Complete response with context and generation details
        """
        start_time = time.time()
        
        print(f"\n{'='*60}")
        print(f"🎵 STRUDEL RAG QUERY")
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
        print(f"\n📝 STEP 2: Formatting context for LLM...")
        context = self.searcher.format_context_for_llm(search_results)
        
        if show_context:
            print(f"\n📄 RETRIEVED CONTEXT:")
            print("─" * 50)
            print(context[:500] + "..." if len(context) > 500 else context)
            print("─" * 50)
        
        # Step 3: Generate response
        print(f"\n🤖 STEP 3: Generating response...")
        generation_start = time.time()
        
        llm_result = self.llm_client.generate_response(
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
            "llm_result": llm_result,
            "timing": {
                "search_time": round(search_time, 2),
                "generation_time": round(generation_time, 2),
                "total_time": round(total_time, 2)
            },
            "success": llm_result.get("success", False)
        }
        
        # Display final response
        print(f"\n💬 FINAL RESPONSE:")
        print("─" * 50)
        if result["success"]:
            print(llm_result["response"])
        else:
            print(f"❌ Error: {llm_result.get('error', 'Unknown error')}")
        print("─" * 50)
        
        return result
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        db_stats = self.vector_db.get_stats()
        
        return {
            "database": {
                "chunks": db_stats["total_chunks"],
                "embeddings": db_stats["total_embeddings"],
                "faiss_index_size": db_stats["faiss_index_size"]
            },
            "model": {
                "embedding_model": self.vector_db.model_name,
                "llm_model": self.llm_client.model
            },
            "status": "ready"
        }


def main():
    """Test the RAG system"""
    try:
        # Initialize system
        rag = StrudelRAG()
        
        # Show system stats
        stats = rag.get_system_stats()
        print(f"\n📊 System Stats: {stats}")
        
        # Test query
        test_query = "How do I make bass sounds in Strudel?"
        
        result = rag.query(
            user_query=test_query,
            top_k=3,
            show_context=True
        )
        
        print(f"\n🎉 RAG query completed successfully!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main() 