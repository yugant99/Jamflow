import sqlite3
import json
import hashlib
import os
from datetime import datetime
from typing import List, Dict, Any, Tuple
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer


class VectorDatabase:
    """Advanced vector database with incremental processing and multi-vector storage"""
    
    def __init__(self, db_path: str = "strudel_rag.db", model_name: str = "all-MiniLM-L6-v2"):
        self.db_path = db_path
        self.model_name = model_name
        self.model = None
        self.faiss_index = None
        self.chunk_id_map = {}  # Maps FAISS index to chunk IDs
        
        self._init_database()
        self._load_model()
        
        # Build FAISS index if embeddings exist
        if self.get_stats()["total_embeddings"] > 0:
            self._build_faiss_index()
    
    def _init_database(self):
        """Initialize SQLite database with schema"""
        self.conn = sqlite3.connect(self.db_path)
        self.conn.execute("PRAGMA foreign_keys = ON")
        
        # Main chunks table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                source_file TEXT NOT NULL,
                source_url TEXT,
                title TEXT,
                content TEXT NOT NULL,
                content_hash TEXT NOT NULL,
                strudel_functions TEXT,  -- JSON array
                music_concepts TEXT,     -- JSON array
                code_examples TEXT,      -- JSON array
                difficulty_level TEXT,
                chunk_size INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(content_hash)
            )
        """)
        
        # Multi-vector embeddings table
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS embeddings (
                chunk_id TEXT,
                vector_type TEXT,  -- 'content', 'code', 'functions', 'concepts'
                embedding BLOB,    -- Serialized numpy array
                model_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (chunk_id) REFERENCES chunks(id),
                PRIMARY KEY (chunk_id, vector_type)
            )
        """)
        
        # File processing tracker
        self.conn.execute("""
            CREATE TABLE IF NOT EXISTS processed_files (
                file_path TEXT PRIMARY KEY,
                file_hash TEXT NOT NULL,
                processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                chunk_count INTEGER
            )
        """)
        
        self.conn.commit()
    
    def _load_model(self):
        """Load sentence transformer model with M3 optimization"""
        print(f"🧠 Loading model: {self.model_name}")
        
        # Fix multiprocessing issues
        import torch
        torch.set_num_threads(1)
        
        self.model = SentenceTransformer(self.model_name)
        
        # M3 optimization - use Metal Performance Shaders if available
        if hasattr(self.model, 'to'):
            try:
                self.model = self.model.to('mps')  # M3 GPU acceleration
                print("✅ Using M3 Metal acceleration")
            except Exception as e:
                print(f"⚠️  Using CPU (Metal not available: {e})")
    
    def _generate_content_hash(self, content: str) -> str:
        """Generate hash for content deduplication"""
        return hashlib.md5(content.encode('utf-8')).hexdigest()
    
    def _generate_file_hash(self, file_path: str) -> str:
        """Generate hash for file change detection"""
        with open(file_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    
    def _clean_strudel_syntax(self, text: str) -> str:
        """Clean double-escaped characters in Strudel code"""
        if not text:
            return text
        
        # Fix common double-escape issues
        text = text.replace('\\[', '[')
        text = text.replace('\\]', ']')
        text = text.replace('\\*', '*')
        text = text.replace('\\(', '(')
        text = text.replace('\\)', ')')
        text = text.replace('\\"', '"')
        
        return text
    
    def _extract_strudel_functions(self, text: str) -> List[str]:
        """Extract Strudel functions from text"""
        import re
        
        # Common Strudel function patterns
        patterns = [
            r'\$:', r'sound\(', r'note\(', r'n\(', r's\(',
            r'\.lpf\(', r'\.delay\(', r'\.room\(', r'\.gain\(',
            r'\.fast\(', r'\.slow\(', r'\.rev\(', r'\.jux\(',
            r'\.scale\(', r'\.bank\(', r'setcpm\(', r'samples\('
        ]
        
        functions = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                # Clean up function names
                func_name = pattern.replace('\\(', '').replace('\\.', '').replace('\\', '')
                functions.append(func_name)
        
        return list(set(functions))
    
    def _classify_music_concepts(self, text: str) -> List[str]:
        """Classify music concepts in text"""
        concepts = {
            'rhythm_timing': ['beat', 'rhythm', 'tempo', 'cycle', 'bpm', 'drum', 'percussion'],
            'melody_harmony': ['note', 'chord', 'scale', 'pitch', 'melody', 'harmony'],
            'audio_effects': ['filter', 'reverb', 'delay', 'lpf', 'effect', 'distortion'],
            'synthesis': ['oscillator', 'waveform', 'envelope', 'attack', 'decay', 'sustain'],
            'sampling': ['sample', 'sound', 'audio', 'wav', 'mp3'],
            'pattern_structure': ['sequence', 'pattern', 'loop', 'repeat', 'variation'],
            'mini_notation': ['bracket', 'notation', 'syntax', 'symbol', 'operator'],
            'live_coding': ['performance', 'improvisation', 'live', 'coding', 'real-time']
        }
        
        found_concepts = []
        text_lower = text.lower()
        
        for concept, keywords in concepts.items():
            if any(keyword in text_lower for keyword in keywords):
                found_concepts.append(concept)
        
        return found_concepts
    
    def _create_multi_vector_embeddings(self, chunk_data: Dict) -> Dict[str, np.ndarray]:
        """Create multiple embeddings for different aspects of the chunk"""
        embeddings = {}
        
        # Main content embedding
        if chunk_data.get('content'):
            embeddings['content'] = self.model.encode(chunk_data['content'])
        
        # Code examples embedding
        if chunk_data.get('code_examples'):
            code_text = ' '.join(chunk_data['code_examples'])
            if code_text.strip():
                embeddings['code'] = self.model.encode(code_text)
        
        # Functions embedding
        if chunk_data.get('strudel_functions'):
            func_text = ' '.join(chunk_data['strudel_functions'])
            if func_text.strip():
                embeddings['functions'] = self.model.encode(func_text)
        
        # Concepts embedding
        if chunk_data.get('music_concepts'):
            concept_text = ' '.join(chunk_data['music_concepts'])
            if concept_text.strip():
                embeddings['concepts'] = self.model.encode(concept_text)
        
        return embeddings
    
    def is_file_processed(self, file_path: str) -> bool:
        """Check if file has been processed and hasn't changed"""
        if not os.path.exists(file_path):
            return False
        
        current_hash = self._generate_file_hash(file_path)
        
        result = self.conn.execute(
            "SELECT file_hash FROM processed_files WHERE file_path = ?",
            (file_path,)
        ).fetchone()
        
        if result and result[0] == current_hash:
            print(f"⏭️  Skipping {file_path} (already processed)")
            return True
        
        return False
    
    def process_json_file(self, file_path: str) -> Dict[str, int]:
        """Process a single JSON file and store embeddings"""
        if self.is_file_processed(file_path):
            return {"chunks_added": 0, "chunks_skipped": 1}
        
        print(f"📄 Processing {file_path}...")
        
        # Check file size and warn if large
        file_size = os.path.getsize(file_path) / (1024 * 1024)  # MB
        if file_size > 10:
            print(f"   ⚠️  Large file detected ({file_size:.1f}MB), processing in batches...")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Handle different JSON formats
        if isinstance(data, list):
            entries = data
        elif isinstance(data, dict) and 'chunks' in data:
            # Handle enhanced_knowledge_base.json format
            entries = data['chunks']
        elif isinstance(data, dict) and 'data' in data:
            # Handle scraped data format with nested 'data' field
            entries = [data['data']]
        else:
            entries = [data]
        
        chunks_added = 0
        chunks_skipped = 0
        batch_size = 50  # Process in batches to manage memory
        
        print(f"   📊 Processing {len(entries)} entries...")
        
        for i, entry in enumerate(entries):
            if i % batch_size == 0 and i > 0:
                print(f"   📈 Processed {i}/{len(entries)} entries...")
                # Commit batch to database
                self.conn.commit()
            # Handle enhanced_knowledge_base format vs raw scraped format
            if 'content' in entry and 'id' in entry:
                # Enhanced knowledge base format - already processed
                content = entry.get('content', '')
                chunk_id = entry.get('id', f"{os.path.basename(file_path).replace('.json', '')}_{i}")
                source_url = entry.get('source_url', '')
                title = entry.get('source_title', entry.get('title', ''))
                strudel_functions = entry.get('strudel_functions', [])
                music_concepts = entry.get('music_concepts', [])
                code_examples = entry.get('code_examples', [])
                difficulty_level = entry.get('difficulty_level', 'beginner')
            else:
                # Raw scraped format - needs processing
                content = self._clean_strudel_syntax(entry.get('content', ''))
                chunk_id = f"{os.path.basename(file_path).replace('.json', '')}_{i}_{chunks_added}"
                
                # Get source URL from entry or parent data
                source_url = entry.get('source_url', '')
                if not source_url and 'source_url' in data:
                    source_url = data['source_url']
                
                title = entry.get('title', '')
                
                # Clean code examples
                code_examples = []
                for code in entry.get('code_examples', []):
                    cleaned_code = self._clean_strudel_syntax(code)
                    if cleaned_code.strip():
                        code_examples.append(cleaned_code)
                
                # Extract features
                strudel_functions = self._extract_strudel_functions(content + ' '.join(code_examples))
                music_concepts = self._classify_music_concepts(content)
                difficulty_level = self._assess_difficulty(content, strudel_functions)
            
            if not content.strip():
                continue
            
            # Check for duplicates
            content_hash = self._generate_content_hash(content)
            
            existing = self.conn.execute(
                "SELECT id FROM chunks WHERE content_hash = ?",
                (content_hash,)
            ).fetchone()
            
            if existing:
                chunks_skipped += 1
                continue
            
            chunk_data = {
                'id': chunk_id,
                'source_file': file_path,
                'source_url': source_url,
                'title': title,
                'content': content,
                'content_hash': content_hash,
                'strudel_functions': strudel_functions,
                'music_concepts': music_concepts,
                'code_examples': code_examples,
                'difficulty_level': difficulty_level,
                'chunk_size': len(content)
            }
            
            # Store chunk
            self._store_chunk(chunk_data)
            
            # Create and store embeddings
            try:
                embeddings = self._create_multi_vector_embeddings(chunk_data)
                self._store_embeddings(chunk_id, embeddings)
                chunks_added += 1
            except Exception as e:
                print(f"   ⚠️  Error creating embeddings for chunk {chunk_id}: {e}")
                chunks_skipped += 1
                continue
        
        # Mark file as processed
        self._mark_file_processed(file_path, chunks_added)
        
        print(f"   ✅ Added {chunks_added} chunks, skipped {chunks_skipped}")
        return {"chunks_added": chunks_added, "chunks_skipped": chunks_skipped}
    
    def _assess_difficulty(self, content: str, functions: List[str]) -> str:
        """Assess content difficulty level"""
        if len(functions) >= 5:
            return "advanced"
        elif len(functions) >= 2:
            return "intermediate"
        else:
            return "beginner"
    
    def _store_chunk(self, chunk_data: Dict):
        """Store chunk in database"""
        self.conn.execute("""
            INSERT OR REPLACE INTO chunks 
            (id, source_file, source_url, title, content, content_hash, 
             strudel_functions, music_concepts, code_examples, 
             difficulty_level, chunk_size)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            chunk_data['id'],
            chunk_data['source_file'],
            chunk_data['source_url'],
            chunk_data['title'],
            chunk_data['content'],
            chunk_data['content_hash'],
            json.dumps(chunk_data['strudel_functions']),
            json.dumps(chunk_data['music_concepts']),
            json.dumps(chunk_data['code_examples']),
            chunk_data['difficulty_level'],
            chunk_data['chunk_size']
        ))
        self.conn.commit()
    
    def _store_embeddings(self, chunk_id: str, embeddings: Dict[str, np.ndarray]):
        """Store embeddings in database"""
        for vector_type, embedding in embeddings.items():
            self.conn.execute("""
                INSERT OR REPLACE INTO embeddings 
                (chunk_id, vector_type, embedding, model_name)
                VALUES (?, ?, ?, ?)
            """, (
                chunk_id,
                vector_type,
                embedding.tobytes(),
                self.model_name
            ))
        self.conn.commit()
    
    def _mark_file_processed(self, file_path: str, chunk_count: int):
        """Mark file as processed"""
        file_hash = self._generate_file_hash(file_path)
        self.conn.execute("""
            INSERT OR REPLACE INTO processed_files 
            (file_path, file_hash, chunk_count)
            VALUES (?, ?, ?)
        """, (file_path, file_hash, chunk_count))
        self.conn.commit()
    
    def process_scraped_data_directory(self, scraped_data_dir: str) -> Dict[str, Any]:
        """Process all JSON files in scraped_data directory"""
        if not os.path.exists(scraped_data_dir):
            raise FileNotFoundError(f"Directory not found: {scraped_data_dir}")
        
        json_files = [f for f in os.listdir(scraped_data_dir) if f.endswith('.json')]
        
        if not json_files:
            print(f"⚠️  No JSON files found in {scraped_data_dir}")
            return {"total_files": 0, "total_chunks": 0}
        
        print(f"🚀 Processing {len(json_files)} JSON files from {scraped_data_dir}")
        
        total_chunks = 0
        total_skipped = 0
        processed_files = 0
        
        for json_file in sorted(json_files):
            file_path = os.path.join(scraped_data_dir, json_file)
            result = self.process_json_file(file_path)
            
            total_chunks += result["chunks_added"]
            total_skipped += result["chunks_skipped"]
            if result["chunks_added"] > 0:
                processed_files += 1
        
        # Build FAISS index after processing
        self._build_faiss_index()
        
        print(f"\n🎉 Processing complete!")
        print(f"   📊 Files processed: {processed_files}/{len(json_files)}")
        print(f"   📈 Total chunks added: {total_chunks}")
        print(f"   ⏭️  Total chunks skipped: {total_skipped}")
        
        return {
            "total_files": len(json_files),
            "processed_files": processed_files,
            "total_chunks": total_chunks,
            "total_skipped": total_skipped
        }
    
    def _build_faiss_index(self):
        """Build FAISS index for fast similarity search"""
        print("🔧 Building FAISS index...")
        
        try:
            # Get all content embeddings
            embeddings_data = self.conn.execute("""
                SELECT chunk_id, embedding FROM embeddings 
                WHERE vector_type = 'content'
                ORDER BY chunk_id
            """).fetchall()
            
            if not embeddings_data:
                print("⚠️  No embeddings found for indexing")
                return
            
            # Convert to numpy array in batches to avoid memory issues
            embeddings_matrix = []
            chunk_ids = []
            
            print(f"   📊 Processing {len(embeddings_data)} embeddings...")
            
            for i, (chunk_id, embedding_blob) in enumerate(embeddings_data):
                if i % 100 == 0 and i > 0:
                    print(f"   📈 Processed {i}/{len(embeddings_data)} embeddings...")
                
                embedding = np.frombuffer(embedding_blob, dtype=np.float32)
                embeddings_matrix.append(embedding)
                chunk_ids.append(chunk_id)
            
            embeddings_matrix = np.array(embeddings_matrix, dtype=np.float32)
            
            # Create FAISS index
            dimension = embeddings_matrix.shape[1]
            self.faiss_index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
            
            # Normalize embeddings for cosine similarity
            faiss.normalize_L2(embeddings_matrix)
            
            # Add to index
            self.faiss_index.add(embeddings_matrix)
            
            # Store chunk ID mapping
            self.chunk_id_map = {i: chunk_id for i, chunk_id in enumerate(chunk_ids)}
            
            print(f"   ✅ FAISS index built with {len(chunk_ids)} vectors")
            
        except Exception as e:
            print(f"   ❌ Error building FAISS index: {e}")
            self.faiss_index = None
            self.chunk_id_map = {}
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        chunk_count = self.conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
        file_count = self.conn.execute("SELECT COUNT(*) FROM processed_files").fetchone()[0]
        embedding_count = self.conn.execute("SELECT COUNT(*) FROM embeddings").fetchone()[0]
        
        return {
            "total_chunks": chunk_count,
            "processed_files": file_count,
            "total_embeddings": embedding_count,
            "faiss_index_size": len(self.chunk_id_map) if self.chunk_id_map else 0
        }


if __name__ == "__main__":
    # Example usage
    db = VectorDatabase()
    
    # Process scraped data directory
    scraped_data_path = "../scraped_data"
    results = db.process_scraped_data_directory(scraped_data_path)
    
    # Show statistics
    stats = db.get_stats()
    print(f"\n📊 Final Statistics:")
    for key, value in stats.items():
        print(f"   {key}: {value}") 