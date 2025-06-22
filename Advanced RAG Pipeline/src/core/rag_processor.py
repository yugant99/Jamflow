#!/usr/bin/env python3
"""
Advanced RAG Pipeline Processor

Converts scraped Strudel documentation to vector embeddings with incremental processing.
Handles deduplication and tracks processed files to avoid reprocessing.
"""

import os
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from database.vector_db import VectorDatabase


class RAGProcessor:
    """Main processor for converting scraped data to vector embeddings"""
    
    def __init__(self, db_path: str = "strudel_rag.db"):
        self.db = VectorDatabase(db_path=db_path)
        self.enhanced_kb_file = self._find_enhanced_kb_file()
    
    def _find_enhanced_kb_file(self) -> str:
        """Find the enhanced_knowledge_base.json file"""
        current_dir = Path(__file__).parent
        
        # Look for enhanced_knowledge_base.json file - ONLY this file is supported
        possible_paths = [
            current_dir.parent.parent.parent / "src" / "scraped_data" / "enhanced_knowledge_base.json",
            current_dir.parent.parent / "src" / "scraped_data" / "enhanced_knowledge_base.json",
            Path.cwd() / "src" / "scraped_data" / "enhanced_knowledge_base.json",
            current_dir.parent.parent.parent / "Single Json Cleaner and Classifier" / "output" / "enhanced_knowledge_base.json"
        ]
        
        for path in possible_paths:
            if path.exists() and path.is_file():
                return str(path)
        
        raise FileNotFoundError("Could not find enhanced_knowledge_base.json file")
    
    def process_all(self) -> dict:
        """Process the enhanced knowledge base file"""
        print(f"🎯 Starting RAG processing...")
        print(f"📄 Enhanced KB file: {self.enhanced_kb_file}")
        
        # Process the enhanced knowledge base file
        results = self.db.process_json_file(self.enhanced_kb_file)
        
        # Build FAISS index
        if results["chunks_added"] > 0:
            self.db._build_faiss_index()
        
        # Get final statistics
        stats = self.db.get_stats()
        
        print(f"\n🎉 RAG Pipeline Complete!")
        print(f"   📊 Database: {self.db.db_path}")
        print(f"   🧠 Model: {self.db.model_name}")
        print(f"   📈 Ready for queries with {stats['total_chunks']} chunks")
        
        return {**results, **stats}
    
    def add_new_file(self, file_path: str) -> dict:
        """Add a single new file to the database"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        print(f"➕ Adding new file: {file_path}")
        result = self.db.process_json_file(file_path)
        
        # Rebuild FAISS index if new chunks were added
        if result["chunks_added"] > 0:
            self.db._build_faiss_index()
        
        return result
    
    def get_status(self) -> dict:
        """Get current processing status"""
        return self.db.get_stats()


def main():
    """Main entry point"""
    processor = RAGProcessor()
    
    # Check command line arguments
    if len(sys.argv) > 1:
        if sys.argv[1] == "status":
            stats = processor.get_status()
            print("📊 Current Status:")
            for key, value in stats.items():
                print(f"   {key}: {value}")
            return
        elif sys.argv[1] == "add" and len(sys.argv) > 2:
            file_path = sys.argv[2]
            result = processor.add_new_file(file_path)
            print(f"✅ Added {result['chunks_added']} chunks from {file_path}")
            return
    
    # Default: process all files
    processor.process_all()


if __name__ == "__main__":
    main() 