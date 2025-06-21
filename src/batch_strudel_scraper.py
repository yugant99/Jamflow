import os
import json
from dotenv import load_dotenv
from firecrawl import FirecrawlApp
from urllib.parse import urlparse
import time
import re

class BatchStrudelScraper:
    def __init__(self):
        # Load environment variables
        load_dotenv()
        self.api_key = os.getenv('FIRECRAWL_API_KEY')
        
        if not self.api_key:
            raise ValueError("FIRECRAWL_API_KEY not found in .env file")
        
        self.app = FirecrawlApp(api_key=self.api_key)
        self.output_dir = "scraped_data"
        self.batch_size = 3
        
        # Create output directory
        os.makedirs(self.output_dir, exist_ok=True)
    
    def read_urls_from_file(self, file_path="docs/strudel_docs.txt"):
        """Read URLs from the strudel_docs.txt file"""
        urls = []
        
        # Try different possible paths
        possible_paths = [
            file_path,  # Original path
            os.path.join("..", file_path),  # If running from src/ directory
            os.path.join(os.path.dirname(os.path.dirname(__file__)), file_path.replace("docs/", ""))  # Relative to script location
        ]
        
        for path in possible_paths:
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    for line in f:
                        url = line.strip()
                        if url and url.startswith('http'):
                            urls.append(url)
                    print(f"✅ Successfully read {len(urls)} URLs from: {path}")
                    return urls
            except FileNotFoundError:
                continue
        
        print(f"❌ Could not find strudel_docs.txt in any of these locations:")
        for path in possible_paths:
            print(f"   - {os.path.abspath(path)}")
        return []
    
    def create_filename_from_url(self, url):
        """Create a safe filename from URL"""
        parsed = urlparse(url)
        path = parsed.path.strip('/')
        
        if not path:
            filename = "homepage"
        else:
            # Replace slashes with underscores and remove special characters
            filename = re.sub(r'[^\w\-_]', '_', path.replace('/', '_'))
            filename = re.sub(r'_+', '_', filename)  # Remove multiple underscores
            filename = filename.strip('_')
        
        return filename
    
    def batch_urls(self, urls, batch_size=3):
        """Split URLs into batches"""
        for i in range(0, len(urls), batch_size):
            yield urls[i:i + batch_size]
    
    def scrape_batch(self, urls_batch, batch_number):
        """Scrape a batch of URLs and return JSON data"""
        try:
            print(f"🔥 Scraping batch {batch_number} with {len(urls_batch)} URLs:")
            for url in urls_batch:
                print(f"   - {url}")
            
            # Use batch scrape with correct API format
            params = {
                'formats': ['json'],
                'jsonOptions': {
                    'prompt': 'Extract the title, description, main content, and any code examples from the page. Focus on documentation content.',
                    'schema': {
                        'type': 'object',
                        'properties': {
                            'title': {'type': 'string'},
                            'description': {'type': 'string'},
                            'content': {'type': 'string'},
                            'code_examples': {
                                'type': 'array',
                                'items': {'type': 'string'}
                            },
                            'sections': {
                                'type': 'array',
                                'items': {
                                    'type': 'object',
                                    'properties': {
                                        'heading': {'type': 'string'},
                                        'content': {'type': 'string'}
                                    }
                                }
                            }
                        },
                        'required': ['title', 'content']
                    }
                }
            }
            
            batch_result = self.app.batch_scrape_urls(urls_batch, params=params)
            
            if batch_result and 'data' in batch_result:
                # Save batch result
                batch_filename = f"batch_{batch_number:02d}.json"
                batch_filepath = os.path.join(self.output_dir, batch_filename)
                
                # Add metadata to the batch result
                enhanced_result = {
                    'batch_number': batch_number,
                    'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                    'urls_count': len(urls_batch),
                    'urls': urls_batch,
                    'data': batch_result['data']
                }
                
                with open(batch_filepath, 'w', encoding='utf-8') as f:
                    json.dump(enhanced_result, f, indent=2, ensure_ascii=False)
                
                print(f"✅ Batch {batch_number} saved: {batch_filename}")
                
                # Also save individual JSON files for each URL
                for i, url_data in enumerate(batch_result['data']):
                    if url_data and 'json' in url_data:
                        url = urls_batch[i]
                        individual_filename = f"{self.create_filename_from_url(url)}.json"
                        individual_filepath = os.path.join(self.output_dir, individual_filename)
                        
                        # Enhanced individual file with metadata
                        individual_data = {
                            'source_url': url,
                            'scraped_at': time.strftime('%Y-%m-%d %H:%M:%S'),
                            'batch_number': batch_number,
                            'data': url_data['json']
                        }
                        
                        with open(individual_filepath, 'w', encoding='utf-8') as f:
                            json.dump(individual_data, f, indent=2, ensure_ascii=False)
                        
                        print(f"   📄 Individual file: {individual_filename}")
                    else:
                        print(f"   ⚠️  No JSON data for URL {i+1}: {urls_batch[i]}")
                
                return True
            else:
                print(f"❌ No data returned for batch {batch_number}")
                return False
                
        except Exception as e:
            print(f"❌ Error scraping batch {batch_number}: {str(e)}")
            return False
    
    def scrape_all_docs(self):
        """Scrape all URLs from strudel_docs.txt in batches"""
        urls = self.read_urls_from_file()
        
        if not urls:
            print("❌ No URLs found to scrape")
            return
        
        print(f"📋 Found {len(urls)} URLs to scrape")
        print(f"📦 Processing in batches of {self.batch_size}")
        print(f"📁 Output directory: {self.output_dir}")
        print("-" * 60)
        
        batches = list(self.batch_urls(urls, self.batch_size))
        successful_batches = 0
        total_batches = len(batches)
        
        for batch_num, batch_urls in enumerate(batches, 1):
            print(f"\n[Batch {batch_num}/{total_batches}]")
            
            if self.scrape_batch(batch_urls, batch_num):
                successful_batches += 1
            
            # Rate limiting between batches
            if batch_num < total_batches:
                print("⏳ Waiting 2 seconds before next batch...")
                time.sleep(2)
        
        print("\n" + "=" * 60)
        print(f"✅ Scraping completed!")
        print(f"📊 Successfully processed: {successful_batches}/{total_batches} batches")
        print(f"📁 Files saved in: {self.output_dir}/")
        
        # List generated files
        json_files = [f for f in os.listdir(self.output_dir) if f.endswith('.json')]
        if json_files:
            print(f"\n📄 Generated {len(json_files)} JSON files:")
            batch_files = [f for f in json_files if f.startswith('batch_')]
            individual_files = [f for f in json_files if not f.startswith('batch_')]
            
            if batch_files:
                print("   📦 Batch files:")
                for filename in sorted(batch_files):
                    print(f"      - {filename}")
            
            if individual_files:
                print("   📄 Individual files:")
                for filename in sorted(individual_files):
                    print(f"      - {filename}")

if __name__ == "__main__":
    try:
        scraper = BatchStrudelScraper()
        scraper.scrape_all_docs()
    except ValueError as e:
        print(f"❌ Configuration error: {e}")
        print("💡 Make sure to set your FIRECRAWL_API_KEY in the .env file")
    except Exception as e:
        print(f"❌ Unexpected error: {e}") 