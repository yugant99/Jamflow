#!/usr/bin/env python3
"""
Test the Complete Strudel RAG System

Tests vector search + OpenRouter generation.
Make sure to set OPENROUTER_API_KEY in .env file!
"""

import sys
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from rag_system import StrudelRAG


def main():
    print("🧪 Testing Complete Strudel RAG System")
    print("=" * 50)
    print("⚠️  Make sure OPENROUTER_API_KEY is set in .env file!")
    print()
    
    try:
        # Initialize RAG system
        rag = StrudelRAG()
        
        # Test queries
        test_queries = [
            "How do I make bass sounds in Strudel?",
            "What is the sound function used for?",
            "How do I create drum patterns?"
        ]
        
        for i, query in enumerate(test_queries, 1):
            print(f"\n🔬 TEST {i}/{len(test_queries)}")
            
            result = rag.query(
                user_query=query,
                top_k=3,
                show_context=True
            )
            
            if result["success"]:
                print(f"✅ Test {i} passed!")
            else:
                print(f"❌ Test {i} failed: {result['llm_result'].get('error')}")
            
            print(f"⏱️  Timing: {result['timing']}")
            
            # Wait for user input between tests
            if i < len(test_queries):
                input("\nPress Enter for next test...")
        
        print(f"\n🎉 All tests completed!")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        print("\n💡 Common issues:")
        print("   - Missing OPENROUTER_API_KEY in .env")
        print("   - Vector database not found (run process_enhanced_kb.py first)")
        print("   - Network connection issues")
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main()) 