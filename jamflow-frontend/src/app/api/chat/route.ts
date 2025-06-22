import { NextRequest } from 'next/server'

export const runtime = 'edge'

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
      maxOutputTokens: 4000, // Increased for reasoning models
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
      signal: AbortSignal.timeout(45000) // Longer timeout
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
    'marching', 'band', 'orchestra', 'ensemble', 'layered', 'stack'
  ]
  
  const lowerMessage = message.toLowerCase()
  return musicKeywords.some(keyword => lowerMessage.includes(keyword))
}

function createEnhancedPrompt(userMessage: string, conversationHistory: any[]): string {
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
    // Enhanced music-focused prompt with comprehensive Strudel knowledge
    return `You are Jamflow, an expert AI assistant specialized in Strudel live-coding music creation. You have access to comprehensive Strudel documentation and can create complex, multi-layered musical patterns.

CONVERSATION CONTEXT:
${conversationContext}

COMPREHENSIVE STRUDEL SYNTAX REFERENCE:
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
Instruments: piano, bass, lead, pad, strings, brass, organ

ADVANCED MULTI-INSTRUMENT TECHNIQUES:
// Method 1: Comma separation for simple layering
sound("bd sd hh, cr ~ hh ~, cb*4")

// Method 2: Stack function for complex arrangements
stack(
  sound("bd sd hh"),
  sound("cr ~ hh ~").gain(0.7),
  sound("cb*8").gain(0.5)
)

// Method 3: Different instrument banks
sound("bd sd hh").bank("RolandTR808")
sound("hh*8").bank("RolandTR909").gain(0.6)
note("c3 e3 g3").bank("piano")

// Method 4: Separate tracks with different timing
$: sound("bd sd").slow(2)
$: sound("hh*8").fast(2)
$: sound("cr ~ ~ cr")

EFFECTS AND PROCESSING:
.gain(0.7)      // Volume control
.lpf(800)       // Low-pass filter
.delay(0.25)    // Echo effect
.room(0.5)      // Reverb
.pan(0.3)       // Stereo positioning

NOTES AND MELODY:
note("c3 e3 g3 c4")           // Play notes
note("<c3 e3 g3> <f3 a3 c4>") // Chord progressions
note("c3 ~ e3 ~")             // Notes with rests

Current user request: ${userMessage}

INSTRUCTIONS:
1. Use ONLY real sound patterns and instrument names from the reference above
2. Create rich, multi-layered compositions using multiple techniques
3. Always start with setcpm() to set the tempo
4. Balance volumes with .gain() when layering multiple instruments
5. Generate complete, runnable Strudel code that sounds professional
6. Provide clear explanations of how the patterns work together musically
7. Use proper JavaScript syntax with semicolons and proper formatting
8. When using stack() or multiple $: patterns, explain the layering approach

Provide a comprehensive response with both detailed explanation and complete, runnable code:

Response:`
  } else {
    // General conversation prompt
    return `You are Jamflow, a friendly AI assistant that specializes in music creation and Strudel live-coding. You can have normal conversations while being particularly knowledgeable about music, audio production, and creative coding.

CONVERSATION CONTEXT:
${conversationContext}

Current user message: ${userMessage}

Respond naturally and helpfully. If the conversation turns to music or if the user wants to create beats/patterns, you can offer to help generate Strudel code. Be conversational, friendly, and engaging.

Response:`
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
    // Extract metadata from code
    const tempo = response.match(/setcpm\s*\(\s*(\d+)\s*\)/)?.[1]
    const instruments = Array.from(new Set([
      ...Array.from(response.matchAll(/sound\s*\(\s*["']([^"']+)["']\s*\)/g), m => m[1]),
      ...Array.from(response.matchAll(/\.bank\s*\(\s*["']([^"']+)["']\s*\)/g), m => m[1])
    ]))
    
    const patterns = Array.from(response.matchAll(/sound\s*\(\s*["']([^"']+)["']\s*\)/g), m => m[1])
    
    return {
      type: 'music',
      explanation: codeAnalysis.explanation,
      code: codeAnalysis.codeBlocks,
      confidence: codeAnalysis.confidence,
      metadata: {
        hasStrudel: true,
        patterns,
        tempo: tempo ? parseInt(tempo) : undefined,
        instruments
      }
    }
  } else {
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
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()
    
    if (!messages || !Array.isArray(messages)) {
      return new Response('Invalid request body', { status: 400 })
    }

    const lastMessage = messages[messages.length - 1]
    
    if (!lastMessage || lastMessage.role !== 'user') {
      return new Response('No user message found', { status: 400 })
    }

    // Create enhanced prompt
    const prompt = createEnhancedPrompt(lastMessage.content, messages)
    
    try {
      // Call Gemini 2.5 Flash
      const geminiResponse = await callGemini25Flash(prompt)
      
      if (!geminiResponse) {
        throw new Error('Empty response from Gemini')
      }

      // Analyze the response for better frontend handling
      const structuredResponse = analyzeResponse(geminiResponse)
      
      // Log for your teammate's database integration
      console.log('🎵 JAMFLOW RESPONSE ANALYSIS:', {
        type: structuredResponse.type,
        hasCode: structuredResponse.metadata?.hasStrudel,
        codeBlocks: structuredResponse.code?.length || 0,
        confidence: structuredResponse.confidence,
        tempo: structuredResponse.metadata?.tempo,
        instruments: structuredResponse.metadata?.instruments,
        patterns: structuredResponse.metadata?.patterns?.length,
        timestamp: new Date().toISOString(),
        userQuery: lastMessage.content
      })

      // Create streaming response that works with useChat hook
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          let intervalId: NodeJS.Timeout | null = null
          
          // Stream the response character by character
          let i = 0
          intervalId = setInterval(() => {
            try {
              if (i < geminiResponse.length) {
                controller.enqueue(encoder.encode(geminiResponse[i]))
                i++
              } else {
                if (intervalId) clearInterval(intervalId)
                controller.close()
              }
            } catch (error) {
              // Handle controller already closed error gracefully
              if (intervalId) clearInterval(intervalId)
              if (error instanceof Error && !error.message.includes('already closed')) {
                console.error('Streaming error:', error)
              }
            }
          }, 15) // Slightly faster streaming
        },
        cancel() {
          // Clean up when client disconnects
          console.log('Stream cancelled by client')
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
          // Add metadata headers for your teammate
          'X-Jamflow-Type': structuredResponse.type,
          'X-Jamflow-Has-Code': structuredResponse.metadata?.hasStrudel ? 'true' : 'false',
          'X-Jamflow-Confidence': structuredResponse.confidence?.toString() || '0',
          'X-Jamflow-Code-Blocks': structuredResponse.code?.length.toString() || '0'
        },
      })

    } catch (geminiError) {
      console.error('Gemini generation failed:', geminiError)
      
      // Fallback response
      const fallbackResponse = `I apologize, but I'm having trouble generating a response right now. Please try again in a moment.

If you were asking about music creation, I can help you with:
- Creating drum patterns and rhythms
- Generating Strudel code for live-coding music
- Explaining music theory and composition
- Setting up multi-layered musical arrangements

Please feel free to ask again!`

      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder()
          controller.enqueue(encoder.encode(fallbackResponse))
          controller.close()
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Jamflow-Error': 'true'
        },
      })
    }

  } catch (error) {
    console.error('API Error:', error)
    return new Response('Internal server error', { status: 500 })
  }
} 