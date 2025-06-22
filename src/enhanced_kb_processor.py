import json
import re
import hashlib
import os
from datetime import datetime
from typing import List, Dict, Any, Set, Tuple
from collections import defaultdict

try:
    from sentence_transformers import SentenceTransformer
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    print("Warning: sentence-transformers not available, using fallback methods")
    TRANSFORMERS_AVAILABLE = False

class EnhancedKnowledgeProcessor:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        """
        Initialize with sentence transformer model
        all-MiniLM-L6-v2: Fast, good balance of speed/quality
        """
        self.similarity_threshold = 0.85  # For duplicate detection
        
        if TRANSFORMERS_AVAILABLE:
            print(f"Loading sentence transformer model: {model_name}")
            self.model = SentenceTransformer(model_name)
        else:
            print("Using fallback mode without transformers")
            self.model = None
        
        # Strudel function patterns (comprehensive list)
        self.strudel_patterns = [
            r'sound\(', r'note\(', r'\.s\(', r'\$:', r'setcpm\(',
            r'\.bank\(', r'\.delay\(', r'\.lpf\(', r'\.room\(', r'\.gain\(',
            r'\.pan\(', r'\.speed\(', r'\.attack\(', r'\.decay\(', r'\.sustain\(',
            r'\.release\(', r'\.adsr\(', r'\.vowel\(', r'\.rev\(', r'\.jux\(',
            r'\.add\(', r'\.slow\(', r'\.fast\(', r'\.ply\(', r'\.off\(',
            r'\.scale\(', r'\.chord\(', r'\.voicing\(', r'\.clip\(', r'\.chop\(',
            r'\.slice\(', r'\.fit\(', r'\.loop\(', r'\.begin\(', r'\.end\(',
            r'samples\(', r'\.midi\(', r'\.osc\(', r'\.vib\(', r'\.fm\(',
            r'\.scope\(', r'\.pianoroll\(', r'\.color\(', r'n\(', r'freq\(',
            r'\.hpf\(', r'\.bpf\(', r'\.crush\(', r'\.distort\(', r'\.chorus\(',
            r'\.phaser\(', r'\.tremolo\(', r'\.compress\(', r'\.eq\(', r'\.filter\(',
            r'\.cutoff\(', r'\.resonance\(', r'\.envelope\(', r'\.lfo\(',
            r'\.stack\(', r'\.layer\(', r'\.parallel\('
        ]
        
        # Enhanced music concept taxonomy
        self.music_concepts = {
            'rhythm_timing': ['rhythm', 'beat', 'tempo', 'cycle', 'timing', 'euclidean', 'polyrhythm', 'polymeter'],
            'melody_harmony': ['note', 'chord', 'scale', 'pitch', 'melody', 'harmony', 'interval', 'key', 'mode'],
            'audio_effects': ['reverb', 'delay', 'echo', 'chorus', 'phaser', 'distortion', 'filter', 'eq', 'compression'],
            'synthesis': ['oscillator', 'waveform', 'FM', 'additive', 'subtractive', 'wavetable', 'granular'],
            'sampling': ['sample', 'bank', 'loop', 'chop', 'slice', 'drum machine', 'break', 'one-shot'],
            'pattern_structure': ['sequence', 'pattern', 'stack', 'layer', 'parallel', 'alternation', 'repetition'],
            'live_coding': ['live coding', 'improvisation', 'performance', 'real-time', 'interactive'],
            'mini_notation': ['mini-notation', 'brackets', 'angles', 'multiplication', 'subdivision', 'euclidean']
        }

    def generate_content_hash(self, content: str) -> str:
        """Generate hash for content deduplication"""
        normalized = re.sub(r'\s+', ' ', content.lower().strip())
        return hashlib.md5(normalized.encode()).hexdigest()

    def clean_strudel_syntax(self, text: str) -> str:
        """Advanced Strudel syntax cleaning - fixes the double-escaped characters"""
        if not text:
            return text
        
        # Fix double-escaped characters (main issue from scraping)
        fixes = [
            (r'\\(\[|\])', r'\1'),           # Brackets: \\[ -> [
            (r'\\(\*|~|\+|\-)', r'\1'),      # Operators: \\* -> *
            (r'\\(\(|\))', r'\1'),           # Parentheses: \\( -> (
            (r'\\(<|>)', r'\1'),             # Angle brackets: \\< -> <
            (r'\\(,|:)', r'\1'),             # Delimiters: \\, -> ,
            (r'\\(!|@|&|\|)', r'\1'),        # Special chars: \\! -> !
            (r'\\(/)', r'\1'),               # Slashes: \\/ -> /
        ]
        
        for pattern, replacement in fixes:
            text = re.sub(pattern, replacement, text)
        
        return text

    def extract_strudel_functions(self, text: str) -> List[str]:
        """Extract Strudel functions with better categorization"""
        functions = set()
        
        for pattern in self.strudel_patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                func_name = match.group(0).replace('(', '').replace('.', '')
                if func_name and func_name not in ['$', '']:
                    functions.add(func_name)
        
        # Extract method chains
        chain_pattern = r'\.(\w+)\('
        methods = re.findall(chain_pattern, text)
        functions.update(methods)
        
        return sorted(list(functions))

    def semantic_chunking(self, content: str, max_chunk_size: int = 400) -> List[str]:
        """Create semantically coherent chunks using sentence similarity"""
        
        # Split into sentences (basic approach)
        sentences = re.split(r'[.!?]+', content)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 10]
        
        if len(sentences) <= 1:
            return [content]
        
        if self.model and TRANSFORMERS_AVAILABLE:
            try:
                # Get embeddings for all sentences
                embeddings = self.model.encode(sentences)
                
                chunks = []
                current_chunk = [sentences[0]]
                current_embedding = [embeddings[0]]
                current_size = len(sentences[0])
                
                for i in range(1, len(sentences)):
                    sentence = sentences[i]
                    sentence_emb = embeddings[i]
                    
                    # Calculate similarity with current chunk
                    chunk_avg_emb = np.mean(current_embedding, axis=0)
                    similarity = cosine_similarity([sentence_emb], [chunk_avg_emb])[0][0]
                    
                    # Add to current chunk if similar and under size limit
                    if similarity > 0.7 and current_size + len(sentence) <= max_chunk_size:
                        current_chunk.append(sentence)
                        current_embedding.append(sentence_emb)
                        current_size += len(sentence)
                    else:
                        # Start new chunk
                        chunks.append('. '.join(current_chunk) + '.')
                        current_chunk = [sentence]
                        current_embedding = [sentence_emb]
                        current_size = len(sentence)
                
                if current_chunk:
                    chunks.append('. '.join(current_chunk) + '.')
                
                return chunks
                
            except Exception as e:
                print(f"Semantic chunking failed, using fallback: {e}")
        
        # Fallback to paragraph-based chunking
        paragraphs = content.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for para in paragraphs:
            if len(current_chunk + para) > max_chunk_size and current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = para
            else:
                current_chunk += "\n\n" + para if current_chunk else para
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks

    def detect_duplicates(self, existing_chunks: List[Dict], new_chunk_content: str) -> Tuple[bool, float]:
        """Detect semantic duplicates using transformer similarity"""
        
        if not existing_chunks:
            return False, 0.0
        
        if self.model and TRANSFORMERS_AVAILABLE:
            try:
                # Get embedding for new chunk
                new_embedding = self.model.encode([new_chunk_content])
                
                # Get embeddings for existing chunks
                existing_contents = [chunk['content'] for chunk in existing_chunks]
                existing_embeddings = self.model.encode(existing_contents)
                
                # Calculate similarities
                similarities = cosine_similarity(new_embedding, existing_embeddings)[0]
                max_similarity = np.max(similarities)
                
                is_duplicate = max_similarity > self.similarity_threshold
                return is_duplicate, float(max_similarity)
                
            except Exception as e:
                print(f"Semantic duplicate detection failed, using hash fallback: {e}")
        
        # Fallback to hash-based detection
        new_hash = self.generate_content_hash(new_chunk_content)
        for chunk in existing_chunks:
            if chunk.get('content_hash') == new_hash:
                return True, 1.0
        return False, 0.0

    def process_knowledge_base(self, 
                             input_files: List[str], 
                             output_file: str = 'enhanced_knowledge_base.json',
                             incremental: bool = True) -> Dict[str, Any]:
        """
        Process multiple knowledge base files with incremental updates
        """
        
        print(f"🚀 Starting enhanced knowledge base processing...")
        print(f"📁 Input files: {input_files}")
        print(f"💾 Output file: {output_file}")
        
        # Load existing data if incremental
        existing_data = []
        processed_sources = set()
        
        if incremental and os.path.exists(output_file):
            print(f"📖 Loading existing data from {output_file}")
            with open(output_file, 'r', encoding='utf-8') as f:
                existing_output = json.load(f)
                existing_data = existing_output.get('chunks', [])
                processed_sources = set(chunk.get('source_url', '') for chunk in existing_data)
            print(f"   Found {len(existing_data)} existing chunks from {len(processed_sources)} sources")
        
        # Process each input file
        all_processed_chunks = existing_data.copy()
        stats = {
            'files_processed': 0,
            'new_entries': 0,
            'chunks_created': 0,
            'duplicates_skipped': 0,
            'functions_found': set(),
            'concepts_found': set()
        }
        
        for input_file in input_files:
            if not os.path.exists(input_file):
                print(f"⚠️  File not found: {input_file}")
                continue
                
            print(f"\n📄 Processing {input_file}...")
            
            with open(input_file, 'r', encoding='utf-8') as f:
                kb_data = json.load(f)
            
            if isinstance(kb_data, dict) and 'chunks' in kb_data:
                # Already processed format
                entries = kb_data['chunks']
            else:
                # Raw knowledge base format
                entries = kb_data
            
            new_chunks_from_file = 0
            
            for entry in entries:
                source_url = entry.get('source_url', '')
                
                # Skip if already processed (unless forcing reprocess)
                if incremental and source_url in processed_sources:
                    continue
                
                processed_entry_chunks = self.process_single_entry(entry, existing_data)
                
                for chunk in processed_entry_chunks:
                    # Check for duplicates against ONLY existing data, not currently processed chunks
                    is_duplicate, similarity = self.detect_duplicates(existing_data, chunk['content'])
                    
                    if is_duplicate:
                        stats['duplicates_skipped'] += 1
                        print(f"   ⏭️  Skipping duplicate (similarity: {similarity:.2f})")
                        continue
                    
                    # Add new chunk
                    all_processed_chunks.append(chunk)
                    new_chunks_from_file += 1
                    
                    # Update stats
                    stats['functions_found'].update(chunk['strudel_functions'])
                    stats['concepts_found'].update(chunk['music_concepts'])
                
                processed_sources.add(source_url)
                stats['new_entries'] += 1
            
            stats['files_processed'] += 1
            stats['chunks_created'] += new_chunks_from_file
            print(f"   ✅ Added {new_chunks_from_file} new chunks from {input_file}")
        
        # Create enhanced output
        output_data = {
            'metadata': {
                'total_chunks': len(all_processed_chunks),
                'total_sources': len(processed_sources),
                'processing_stats': {
                    'files_processed': stats['files_processed'],
                    'new_entries_added': stats['new_entries'],
                    'chunks_created': stats['chunks_created'],
                    'duplicates_skipped': stats['duplicates_skipped']
                },
                'strudel_functions': sorted(list(stats['functions_found'])),
                'music_concepts': sorted(list(stats['concepts_found'])),
                'model_used': str(self.model) if self.model else 'fallback_methods',
                'similarity_threshold': self.similarity_threshold,
                'processing_date': datetime.now().isoformat(),
                'version': '2.0_enhanced'
            },
            'chunks': all_processed_chunks
        }
        
        # Save enhanced knowledge base
        print(f"\n💾 Saving enhanced knowledge base to {output_file}...")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        # Print summary
        print(f"\n🎉 Processing complete!")
        print(f"   📊 Total chunks: {len(all_processed_chunks)}")
        print(f"   🔧 Strudel functions: {len(stats['functions_found'])}")
        print(f"   🎵 Music concepts: {len(stats['concepts_found'])}")
        print(f"   ⏭️  Duplicates skipped: {stats['duplicates_skipped']}")
        print(f"   📈 New chunks added: {stats['chunks_created']}")
        
        return output_data

    def process_single_entry(self, entry: Dict[str, Any], existing_chunks: List[Dict]) -> List[Dict[str, Any]]:
        """Process a single knowledge base entry into enhanced chunks"""
        
        processed_chunks = []
        
        # Clean content
        raw_content = entry.get('content', '')
        cleaned_content = self.clean_strudel_syntax(raw_content)
        
        # Clean code examples
        cleaned_code_examples = []
        for code in entry.get('code_examples', []):
            cleaned_code = self.clean_strudel_syntax(code)
            cleaned_code_examples.append(cleaned_code)
        
        # Create semantic chunks
        content_chunks = self.semantic_chunking(cleaned_content)
        
        for i, chunk_content in enumerate(content_chunks):
            # Extract enhanced features
            strudel_functions = self.extract_strudel_functions(chunk_content)
            
            # Classify music concepts
            music_concepts = []
            chunk_lower = chunk_content.lower()
            for category, terms in self.music_concepts.items():
                if any(term in chunk_lower for term in terms):
                    music_concepts.append(category)
            
            # Filter relevant code examples
            relevant_code = []
            chunk_functions = set(strudel_functions)
            for code in cleaned_code_examples:
                code_functions = set(self.extract_strudel_functions(code))
                if chunk_functions.intersection(code_functions) or len(relevant_code) < 3:
                    relevant_code.append(code)
            
            # Create enhanced chunk
            enhanced_chunk = {
                'id': f"{entry['source_url'].split('/')[-2]}_{i}",
                'source_url': entry['source_url'],
                'source_title': entry.get('title', 'Unknown'),
                'source_description': entry.get('description', ''),
                'chunk_index': i,
                'total_chunks': len(content_chunks),
                
                # Cleaned content
                'content': chunk_content,
                'content_hash': self.generate_content_hash(chunk_content),
                'content_type': 'code' if len(strudel_functions) >= 2 else 'text',
                
                # Enhanced semantic features
                'strudel_functions': strudel_functions,
                'music_concepts': music_concepts,
                'code_examples': relevant_code,
                
                # Metadata
                'chunk_size': len(chunk_content),
                'function_count': len(strudel_functions),
                'concept_count': len(music_concepts),
                'difficulty_level': self.assess_difficulty(chunk_content, strudel_functions),
                
                # Processing info
                'processing_version': '2.0_enhanced',
                'processed_date': datetime.now().isoformat()
            }
            
            processed_chunks.append(enhanced_chunk)
        
        return processed_chunks

    def assess_difficulty(self, content: str, functions: List[str]) -> str:
        """Assess content difficulty level"""
        content_lower = content.lower()
        
        beginner_indicators = ['first', 'basic', 'introduction', 'getting started', 'simple', 'beginner']
        advanced_indicators = ['advanced', 'complex', 'synthesis', 'FM', 'wavetable', 'MIDI', 'OSC']
        
        if any(word in content_lower for word in advanced_indicators):
            return 'advanced'
        elif len(functions) > 8:
            return 'advanced'
        elif len(functions) > 4:
            return 'intermediate'
        elif any(word in content_lower for word in beginner_indicators):
            return 'beginner'
        else:
            return 'intermediate'


if __name__ == "__main__":
    # Example usage
    processor = EnhancedKnowledgeProcessor()
    
    # Process knowledge base files
    input_files = ['knowledge_base.json']  # Add more files as needed
    
    result = processor.process_knowledge_base(
        input_files=input_files,
        output_file='enhanced_knowledge_base.json',
        incremental=True
    ) 