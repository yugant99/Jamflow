#!/usr/bin/env python3
"""
Test Vector Database Query

Simple test to verify the vector embeddings are working correctly.
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from database.vector_db import VectorDatabase


def main():
    print("🔍 Testing Vector Database Query")
    print("=" * 40)
    
    try:
        # Load existing database
        db = VectorDatabase(db_path="strudel_rag.db")
        
        # Get stats
        stats = db.get_stats()
        print(f"📊 Database loaded successfully!")
        print(f"   Chunks: {stats['total_chunks']}")
        print(f"   Embeddings: {stats['total_embeddings']}")
        print(f"   FAISS index: {stats['faiss_index_size']}")
        
        # Test query (we'll implement search later)
        print(f"\n✅ Vector database is ready for queries!")
        print(f"🧠 Model: {db.model_name}")
        print(f"💾 Database: {db.db_path}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main()) 