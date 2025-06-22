#!/usr/bin/env python3
"""
Process Enhanced Knowledge Base to Vector Embeddings

This script processes the enhanced_knowledge_base.json file (created by the 
Single Json Cleaner and Classifier) into vector embeddings for RAG queries.

ONLY works with enhanced_knowledge_base.json format.
"""

import sys
import os
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from core.rag_processor import RAGProcessor


def main():
    print("🎵 Enhanced Knowledge Base → Vector Embeddings")
    print("=" * 50)
    print("📝 Processing ONLY enhanced_knowledge_base.json")
    print("🧠 Using all-MiniLM-L6-v2 model")
    print()
    
    try:
        # Initialize processor
        processor = RAGProcessor()
        
        # Process enhanced knowledge base
        results = processor.process_all()
        
        print("\n" + "=" * 50)
        print("✅ Vector Embedding Complete!")
        print(f"📊 Chunks added: {results.get('chunks_added', 0)}")
        print(f"⏭️  Chunks skipped: {results.get('chunks_skipped', 0)}")
        print(f"📈 Total embeddings: {results.get('total_embeddings', 0)}")
        print(f"🔍 FAISS index size: {results.get('faiss_index_size', 0)}")
        print(f"💾 Database: strudel_rag.db")
        
    except FileNotFoundError as e:
        print(f"❌ File Error: {e}")
        print("\n💡 Make sure enhanced_knowledge_base.json exists in:")
        print("   - src/scraped_data/enhanced_knowledge_base.json")
        print("   - Single Json Cleaner and Classifier/output/enhanced_knowledge_base.json")
        return 1
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main()) 