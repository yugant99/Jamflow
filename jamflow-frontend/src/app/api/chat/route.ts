import { NextRequest } from 'next/server'
import fs from 'fs'
import path from 'path'

// Change to Node.js runtime to support fs and real RAG
export const runtime = 'nodejs'

// Real RAG System Integration (from test_rag_full_context_final.py)
interface RAGResult {
  content: string;
  score: number;
  rank: number;
  chunk_id: string;
}

interface QueryAnalysis {
  complexity: 'simple' | 'intermediate' | 'advanced';
  instruments: string[];
  categories: string[];
  estimated_tokens: number;
}

// Cache for enhanced knowledge base
let enhancedKnowledgeBase: any[] | null = null;

function loadEnhancedKnowledgeBase(): any[] {
  if (enhancedKnowledgeBase) return enhancedKnowledgeBase;
  
  try {
    // Correct path to knowledge base
    const kbPath = path.join(process.cwd(), '../../src/scraped_data/enhanced_knowledge_base.json');
    const kbData = fs.readFileSync(kbPath, 'utf-8');
    const data = JSON.parse(kbData);
    
    // Extract chunks correctly (like in Python script)
    enhancedKnowledgeBase = data.chunks || data;
    console.log(`✅ Loaded ${enhancedKnowledgeBase?.length || 0} knowledge base entries`);
    return enhancedKnowledgeBase || [];
  } catch (error) {
    console.error('❌ Failed to load knowledge base:', error);
    // Fallback: try different path
    try {
      const fallbackPath = path.join(process.cwd(), '../src/scraped_data/enhanced_knowledge_base.json');
      const kbData = fs.readFileSync(fallbackPath, 'utf-8');
      const data = JSON.parse(kbData);
      enhancedKnowledgeBase = data.chunks || data;
      console.log(`✅ Loaded ${enhancedKnowledgeBase?.length || 0} knowledge base entries (fallback path)`);
      return enhancedKnowledgeBase || [];
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError);
      return [];
    }
  }
}

function detectQueryComplexity(query: string): QueryAnalysis {
  const queryLower = query.toLowerCase();
  
  // Instrument detection (from Python script)
  const instruments: string[] = [];
  if (queryLower.includes('piano') || queryLower.includes('key') || queryLower.includes('chord') || queryLower.includes('note')) {
    instruments.push('piano');
  }
  if (queryLower.includes('drum') || queryLower.includes('beat') || queryLower.includes('rhythm') || queryLower.includes('bd') || queryLower.includes('sd') || queryLower.includes('hh')) {
    instruments.push('drums');
  }
  if (queryLower.includes('bass') || queryLower.includes('sub') || queryLower.includes('low')) {
    instruments.push('bass');
  }
  if (queryLower.includes('synth') || queryLower.includes('lead') || queryLower.includes('pad') || queryLower.includes('electronic')) {
    instruments.push('synth');
  }
  
  // Complexity detection (from Python script)
  let complexity: 'simple' | 'intermediate' | 'advanced' = 'simple';
  
  const complexityIndicators = {
    simple: ['simple', 'basic', 'easy', 'quick'],
    intermediate: ['piano', 'multi', 'layer', 'stack', 'effect'],
    advanced: ['complex', 'polyrhythm', 'experimental', 'advanced', 'fusion', 'jazz']
  };
  
  for (const [level, keywords] of Object.entries(complexityIndicators)) {
    if (keywords.some(keyword => queryLower.includes(keyword))) {
      complexity = level as 'simple' | 'intermediate' | 'advanced';
    }
  }
  
  // Required categories (from Python script)
  const categories = ['sound', 'pattern'];
  if (instruments.includes('piano')) {
    categories.push('piano', 'note', 'chord', 'melody');
  }
  if (complexity === 'intermediate' || complexity === 'advanced') {
    categories.push('stack', 'effect', 'advanced');
  }
  if (complexity === 'advanced') {
    categories.push('experimental', 'polyrhythm', 'complex');
  }
  
  return {
    complexity,
    instruments,
    categories,
    estimated_tokens: complexity === 'simple' ? 25000 : complexity === 'intermediate' ? 50000 : 100000
  };
}

function extractKnowledgeByCategory(categories: string[], knowledgeBase: any[]): string {
  const extractedContent: string[] = [];
  
  for (const entry of knowledgeBase) {
    // Check content, music_concepts, and strudel_functions (like Python script)
    const contentText = entry.content?.toLowerCase() || '';
    const concepts = String(entry.music_concepts || []).toLowerCase();
    const functions = String(entry.strudel_functions || []).toLowerCase();
    
    if (categories.some(cat => 
      contentText.includes(cat.toLowerCase()) ||
      concepts.includes(cat.toLowerCase()) ||
      functions.includes(cat.toLowerCase())
    )) {
      extractedContent.push(entry.content);
    }
  }
  
  return extractedContent.slice(0, 30).join('\n'); // Limit to first 30 matches (like Python)
}

// Enhanced Strudel code detection for backend
function detectStrudelCode(text: string): {
  hasCode: boolean;
  codeBlocks: string[];
  explanation: string;
  confidence: number;
} {
  const strudelPatterns = [
    { pattern: /setcpm\s*\(\s*\d+\s*\)/, weight: 10 },
    { pattern: /sound\s*\(\s*["'][^"']+["']\s*\)/, weight: 10 },
    { pattern: /note\s*\(\s*["'][^"']+["']\s*\)/, weight: 8 },
    { pattern: /stack\s*\(/, weight: 8 },
    { pattern: /\$\s*:\s*sound/, weight: 9 },
    { pattern: /\.gain\s*\(/, weight: 5 },
    { pattern: /\.room\s*\(/, weight: 5 },
    { pattern: /\.delay\s*\(/, weight: 5 },
    { pattern: /\.lpf\s*\(/, weight: 5 },
    { pattern: /\[bd|sd|hh|cr\]/, weight: 7 },
    { pattern: /"bd|sd|hh|cr|oh|cp"/, weight: 7 }
  ]

  let confidence = 0
  const codeBlocks: string[] = []
  
  // Extract code blocks first
  const codeBlockMatches = Array.from(text.matchAll(/```(?:javascript|js|strudel)?\n?([\s\S]*?)\n?```/g))
  codeBlockMatches.forEach(match => {
    codeBlocks.push(match[1].trim())
  })
  
  // Calculate confidence score
  strudelPatterns.forEach(({ pattern, weight }) => {
    const matches = text.match(pattern)
    if (matches) {
      confidence += weight * matches.length
    }
  })
  
  // Extract individual code lines if no code blocks found
  if (codeBlocks.length === 0) {
    const lines = text.split('\n')
    const codeLines = lines.filter(line => {
      const trimmed = line.trim()
      return strudelPatterns.some(({ pattern }) => pattern.test(trimmed)) &&
             !trimmed.startsWith('//') &&
             trimmed.length > 3
    })
    
    if (codeLines.length > 0) {
      codeBlocks.push(codeLines.join('\n'))
    }
  }
  
  // Extract explanation (remove code blocks and code lines)
  let explanation = text.replace(/```[\s\S]*?```/g, '')
  const explanationLines = explanation.split('\n').filter(line => {
    const trimmed = line.trim()
    return !strudelPatterns.some(({ pattern }) => pattern.test(trimmed)) || 
           trimmed.startsWith('//')
  })
  explanation = explanationLines.join('\n').trim()
  
  return {
    hasCode: codeBlocks.length > 0 && confidence > 15,
    codeBlocks,
    explanation,
    confidence
  }
}

async function callGemini25Flash(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not found in environment variables')
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
  
  const payload = {
    contents: [{
      parts: [{ text: prompt }]
    }],
    generationConfig: {
      maxOutputTokens: 30000, // Increased to 30K to prevent truncation
      temperature: 0.7,
      topP: 0.8
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60000) // Longer timeout for large context
    })

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()
    
    if (result.candidates && result.candidates[0] && result.candidates[0].content) {
      const content = result.candidates[0].content
      if (content.parts && content.parts[0] && content.parts[0].text) {
        return content.parts[0].text
      }
    }
    
    throw new Error('No content found in Gemini response')
    
  } catch (error) {
    console.error('Gemini API call failed:', error)
    throw error
  }
}

function isMusicRequest(message: string): boolean {
  const musicKeywords = [
    'music', 'beat', 'drum', 'rhythm', 'pattern', 'sound', 'tempo', 'bpm',
    'strudel', 'generate', 'create', 'make', 'compose', 'bass', 'snare', 
    'hihat', 'crash', 'kick', 'cymbal', 'percussion', 'song', 'track',
    'energetic', 'chill', 'ambient', 'rock', 'electronic', 'dance',
    'jazz', 'blues', 'funk', 'techno', 'house', 'synth', 'melody',
    'harmony', 'chord', 'scale', 'loop', 'sample', 'effect', 'reverb',
    'delay', 'filter', 'distortion', 'polyrhythm', 'polyrhythmic',
    'marching', 'band', 'orchestra', 'ensemble', 'layered', 'stack',
    'piano', 'keys', 'note', 'notes'
  ]
  
  const lowerMessage = message.toLowerCase()
  return musicKeywords.some(keyword => lowerMessage.includes(keyword))
}

function createComprehensiveRAGPrompt(userMessage: string, conversationHistory: any[]): string {
  // Build conversation context
  let conversationContext = ""
  if (conversationHistory.length > 1) {
    const recentMessages = conversationHistory.slice(-6) // Last 6 messages for context
    conversationContext = recentMessages.map(msg => 
      `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
    ).join('\n')
  }

  const isMusicQuery = isMusicRequest(userMessage)

  if (isMusicQuery) {
    // REAL RAG INTEGRATION - Load knowledge base and analyze query (from Python script)
    const knowledgeBase = loadEnhancedKnowledgeBase();
    const queryAnalysis = detectQueryComplexity(userMessage);
    const kbContent = extractKnowledgeByCategory(queryAnalysis.categories, knowledgeBase);
    
    console.log(`🎵 RAG Analysis: ${queryAnalysis.complexity} query with ${queryAnalysis.instruments.join(', ') || 'general'} instruments`);
    console.log(`📚 Extracted ${kbContent.length} chars from knowledge base`);
    
    // COMPREHENSIVE PROMPT (from test_rag_full_context_final.py)
    return `You are Jamflow, the world's most advanced Strudel live-coding music AI. You have access to the complete Strudel documentation and can generate complex, professional-quality musical compositions.

QUERY ANALYSIS:
- Complexity: ${queryAnalysis.complexity}
- Instruments: ${queryAnalysis.instruments.join(', ') || 'general'}
- Estimated context needed: ${queryAnalysis.estimated_tokens} tokens

CONVERSATION CONTEXT:
${conversationContext}

COMPREHENSIVE STRUDEL DOCUMENTATION:

=== RELEVANT RAG CONTEXT ===
${kbContent}

=== ENHANCED KNOWLEDGE BASE ===
${kbContent}

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
// Method 1: Sequential notes
note("c3 e3 g3 c4").sound("piano")  // Play notes in sequence
note("b g e c").sound("piano")      // Simple melody

// Method 2: Chord progressions with commas and brackets
note("c2, eb3 g3 [bb3 c4]").sound("piano")     // Bass note + chord
note("c3, e3 g3").sound("piano")               // Simple chord
note("[c3 e3 g3], [f3 a3 c4]").sound("piano") // Chord sequence

// Method 3: Alternating patterns with <>
note("<c3 e3 g3> <f3 a3 c4>").sound("piano")  // Alternating chords
note("<c e g> <f a c>").sound("piano")         // Simple progression

// Method 4: IMPORTANT - Use ONLY these valid piano sounds:
// For acoustic piano: use "piano" (most reliable)
note("c3 e3 g3").sound("piano")                // Standard acoustic piano
// For electric piano: use "gm_electric_piano_1" (only if specifically requested)
note("c3 e3 g3").sound("gm_electric_piano_1")  // Electric piano sound

// Method 5: Using n() with scales
n("0 2 4 7").scale("C:major").sound("piano")   // Scale-based approach

// CRITICAL: NEVER use "gm_acoustic_grand_piano" - it doesn't exist in Strudel
// Always use "piano" for acoustic piano sounds unless electric piano is specifically requested

ADVANCED MULTI-INSTRUMENT TECHNIQUES:
// Method 1: Comma separation for simple layering
sound("bd sd hh, cr ~ hh ~, cb*4")

// Method 2: Stack function for complex arrangements (CORRECT SYNTAX)
stack(
  sound("bd sd hh cr").gain(0.8),          // ← COMMA required
  sound("hh*8").gain(0.6),                 // ← COMMA required  
  note("c3 e3 g3").sound("piano").gain(0.7) // ← NO comma on last line
)

// CORRECT: Complex piano patterns (single-line strings)
stack(
  // Bass line with chord progression - using standard piano sound
  note("<c2 g2 a2 f2>").sound("piano").gain(0.6),
  // Chord stabs - CORRECT single-line format
  note("<[c3 e3 g3] [g3 b3 d4] [a3 c4 e4] [f3 a3 c4]>").sound("piano").gain(0.7),
  // Melody line - CORRECT alternating pattern  
  note("<c4 e4 g4 e4> <g4 b4 d5 b4> <a4 c5 e5 c5> <f4 a4 c5 a4>").sound("piano").gain(0.8)
)

// Example with electric piano (only when specifically requested)
stack(
  note("<c2 g2 a2 f2>").sound("gm_electric_piano_1").gain(0.6),
  note("<[c3 e3 g3] [g3 b3 d4]>").sound("gm_electric_piano_1").gain(0.7)
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

USER QUERY: ${userMessage}

CRITICAL SYNTAX RULES:
- ALWAYS end each line in stack() with a comma, except the last line
- Use proper note syntax: note("c3 e3 g3") NOT note("<c3 e3 g3 b3>")
- For chords: note("c3, e3 g3") or note("[c3 e3 g3]") 
- For alternating: note("<c3 e3 g3> <f3 a3 c4>")
- Close all parentheses and brackets correctly
- NEVER put comments inside string literals: note("c3 // comment") is INVALID
- NEVER use multi-line strings: keep all note() patterns on single lines
- Put comments OUTSIDE the code: // comment BEFORE note("pattern")
- Use simple, single-line patterns: note("<c3 e3 g3> <f3 a3 c4>")
- NO line breaks inside quotes: "pattern" must be on one line

PIANO SELECTION RULES:
- If user asks for "acoustic piano", "grand piano", or just "piano" → use .sound("piano")
- If user asks for "electric piano", "rhodes", or "EP" → use .sound("gm_electric_piano_1")
- Default to .sound("piano") for all piano requests unless electric is specifically mentioned
- NEVER use "gm_acoustic_grand_piano" - this sound name does not exist in Strudel

INSTRUCTIONS:
1. Generate complete, runnable Strudel code that produces actual sound
2. Use ONLY real sound patterns and instrument names from the documentation above
3. Always start with setcpm() to set appropriate tempo
4. For piano requests, use proper note() syntax with real chord progressions
5. Apply PIANO SELECTION RULES above to choose the correct piano sound
6. Balance volumes with .gain() when layering multiple instruments
7. Include comprehensive comments explaining the musical structure
8. Generate professional-quality compositions appropriate for the complexity level
9. Ensure all patterns use real drum abbreviations and instrument names
10. VERIFY syntax: every line in stack() ends with comma except last line

Generate a comprehensive response with detailed explanation and complete, runnable code:`

  } else {
    // Conversational prompt for non-music queries
    return `You are Jamflow, a helpful AI assistant specializing in Strudel live-coding music. 

CONVERSATION CONTEXT:
${conversationContext}

For non-music questions, provide helpful conversational responses. If the user wants to create music, guide them to ask about beats, rhythms, melodies, or Strudel patterns.

USER QUERY: ${userMessage}

Respond conversationally and helpfully:`
  }
}

// Structure the response for better parsing by frontend
interface StructuredResponse {
  type: 'conversation' | 'music';
  explanation: string;
  code?: string[];
  confidence?: number;
  metadata?: {
    hasStrudel: boolean;
    patterns: string[];
    tempo?: number;
    instruments?: string[];
  };
}

function analyzeResponse(response: string): StructuredResponse {
  const codeAnalysis = detectStrudelCode(response)
  
  if (codeAnalysis.hasCode) {
    // Extract metadata for database integration
    const tempoMatch = response.match(/setcpm\s*\(\s*(\d+)\s*\)/)
    const tempo = tempoMatch ? parseInt(tempoMatch[1]) : undefined
    
    // Extract instrument patterns
    const instrumentMatches = Array.from(response.matchAll(/sound\s*\(\s*["']([^"']+)["']\s*\)/g))
    const instruments = instrumentMatches.map(match => match[1])
    
    // Extract note patterns  
    const noteMatches = Array.from(response.matchAll(/note\s*\(\s*["']([^"']+)["']\s*\)/g))
    const patterns = [...instruments, ...noteMatches.map(match => match[1])]
    
    return {
      type: 'music',
      explanation: codeAnalysis.explanation,
      code: codeAnalysis.codeBlocks,
      confidence: codeAnalysis.confidence,
      metadata: {
        hasStrudel: true,
        patterns,
        tempo,
        instruments
      }
    }
  }
  
  return {
    type: 'conversation',
    explanation: response,
    metadata: {
      hasStrudel: false,
      patterns: [],
      instruments: []
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request format', { status: 400 })
    }

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'user') {
      return new Response('No user message found', { status: 400 })
    }

    // Create comprehensive RAG prompt with 100K context
    const prompt = createComprehensiveRAGPrompt(lastMessage.content, messages)
    
    // Call Gemini with enhanced context and 30K token limit
    const geminiResponse = await callGemini25Flash(prompt)
    
    // Analyze response for database integration
    const analysis = analyzeResponse(geminiResponse)
    
    // Log analysis for database integration
    console.log('🎵 JAMFLOW RESPONSE ANALYSIS:', {
      type: analysis.type,
      hasCode: analysis.metadata?.hasStrudel || false,
      codeBlocks: analysis.code?.length || 0,
      confidence: analysis.confidence || 0,
      tempo: analysis.metadata?.tempo,
      instruments: analysis.metadata?.instruments || [],
      patterns: analysis.metadata?.patterns?.length || 0,
      timestamp: new Date().toISOString(),
      userQuery: lastMessage.content
    })

    // Add metadata headers for backend integration
    const headers = new Headers({
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Jamflow-Type': analysis.type,
      'X-Jamflow-Has-Code': String(analysis.metadata?.hasStrudel || false),
      'X-Jamflow-Confidence': String(analysis.confidence || 0),
      'X-Jamflow-Patterns': String(analysis.metadata?.patterns?.length || 0),
    })

    if (analysis.metadata?.tempo) {
      headers.set('X-Jamflow-Tempo', String(analysis.metadata.tempo))
    }

    // Create streaming response with proper error handling
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let intervalId: NodeJS.Timeout | null = null
        let isClosed = false
        
        // Stream the response character by character
        let i = 0
        intervalId = setInterval(() => {
          try {
            if (isClosed) {
              if (intervalId) clearInterval(intervalId)
              return
            }
            
            if (i < geminiResponse.length) {
              controller.enqueue(encoder.encode(geminiResponse[i]))
              i++
            } else {
              if (intervalId) clearInterval(intervalId)
              if (!isClosed) {
                controller.close()
                isClosed = true
              }
            }
          } catch (error) {
            // Handle controller already closed error gracefully
            if (intervalId) clearInterval(intervalId)
            isClosed = true
            console.warn('Streaming controller error (handled):', error)
          }
        }, 10) // Slower streaming for stability
      },
      
      cancel() {
        // Handle client disconnect
        console.log('Stream cancelled by client')
      }
    })

    return new Response(stream, { headers })

  } catch (error) {
    console.error('API route error:', error)
    
    // Fallback response
    const fallbackResponse = `I apologize, but I encountered an error generating your Strudel music. Here's a simple working pattern to get you started:

\`\`\`javascript
// Simple drum beat at 120 BPM
setcpm(120);
sound("bd hh sd hh");
\`\`\`

Please try your request again!`

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        let i = 0
        const intervalId = setInterval(() => {
          if (i < fallbackResponse.length) {
            controller.enqueue(encoder.encode(fallbackResponse[i]))
            i++
          } else {
            clearInterval(intervalId)
            controller.close()
          }
        }, 10)
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Jamflow-Type': 'fallback',
        'X-Jamflow-Has-Code': 'true'
      }
    })
  }
} 