"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Music, Play, ExternalLink, Copy, Check } from "lucide-react";

// Simple message type that matches our custom implementation
type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

interface ChatProps {
  messages: Message[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading?: boolean;
  stop?: () => void;
  iframeKey: number;
  setIframeKey: React.Dispatch<React.SetStateAction<number>>;
}

// Enhanced Strudel code detection
function containsStrudelCode(content: string): boolean {
  const strudelPatterns = [
    /setcpm\s*\(\s*\d+\s*\)/,
    /sound\s*\(\s*["'][^"']+["']\s*\)/,
    /note\s*\(\s*["'][^"']+["']\s*\)/,
    /stack\s*\(/,
    /d1\s*\(\s*[^)]+\s*\)/,
    /s\s*\(\s*["'][^"']+["']\s*\)/,
    /\$\s*:\s*sound/,
    /\.gain\s*\(/,
    /\.room\s*\(/,
    /\.delay\s*\(/,
    /\.lpf\s*\(/,
  ];

  return strudelPatterns.some((pattern) => pattern.test(content));
}

// Enhanced code extraction with better parsing
function extractStrudelCode(content: string): string | null {
  if (!containsStrudelCode(content)) return null;

  // Try to extract from code blocks first (```javascript, ```strudel, etc.)
  const codeBlockPatterns = [
    /```(?:javascript|js|strudel)\n?([\s\S]*?)\n?```/g,
    /```\n?([\s\S]*?setcpm[\s\S]*?)\n?```/g,
  ];

  for (const pattern of codeBlockPatterns) {
    const matches = Array.from(content.matchAll(pattern));
    if (matches.length > 0) {
      return matches.map((match) => match[1].trim()).join("\n\n");
    }
  }

  // Extract individual Strudel lines
  const lines = content.split("\n");
  const codeLines = lines.filter((line) => {
    const trimmed = line.trim();
    return (
      containsStrudelCode(trimmed) &&
      !trimmed.startsWith("//") && // Skip comments
      trimmed.length > 3
    ); // Skip very short lines
  });

  return codeLines.length > 0 ? codeLines.join("\n") : null;
}

// Extract explanatory text (non-code parts)
function extractExplanation(content: string): string {
  // Remove code blocks
  let explanation = content.replace(/```[\s\S]*?```/g, "");

  // Remove individual code lines
  const lines = explanation.split("\n");
  const textLines = lines.filter((line) => {
    const trimmed = line.trim();
    return !containsStrudelCode(trimmed) || trimmed.startsWith("//");
  });

  return textLines.join("\n").trim();
}

// Strudel Player Component using @strudel/embed - No more iframe caching issues!
const StrudelPlayer = React.memo(function StrudelPlayer({ code, title, messageId }: { code: string; title?: string; messageId?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const strudelContainerRef = useRef<HTMLDivElement>(null)
  const strudelElementRef = useRef<HTMLElement | null>(null)
  
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePlayInline = () => {
    console.log('🎵 Play Inline clicked - Creating Strudel embed component')
    console.log('🎵 Code to load:', code.substring(0, 100) + '...')
    
    setIsLoading(true)
    setShowPlayer(true)
    
    // Create the Strudel embed component dynamically
    setTimeout(() => {
      if (strudelContainerRef.current) {
        // Clear any existing component
        strudelContainerRef.current.innerHTML = ''
        
        // Create new strudel-repl element
        const strudelElement = document.createElement('strudel-repl')
        strudelElement.setAttribute('code', code)
        
        // Add some styling
        strudelElement.style.width = '100%'
        strudelElement.style.height = '400px'
        strudelElement.style.border = '1px solid #e5e7eb'
        strudelElement.style.borderRadius = '8px'
        
        // Store reference and append
        strudelElementRef.current = strudelElement
        strudelContainerRef.current.appendChild(strudelElement)
        
        console.log('🎵 Strudel embed component created successfully')
        setIsLoading(false)
      }
    }, 100)
  }
  
  // Load Strudel embed script on component mount
  useEffect(() => {
    // Check if script is already loaded
    if (!document.querySelector('script[src*="@strudel/embed"]')) {
      const script = document.createElement('script')
      script.src = 'https://unpkg.com/@strudel/embed@latest'
      script.async = true
      script.onload = () => {
        console.log('🎵 Strudel embed script loaded successfully')
      }
      script.onerror = () => {
        console.error('🎵 Failed to load Strudel embed script')
      }
      document.head.appendChild(script)
    }
  }, [])
  
  // Update code when it changes
  useEffect(() => {
    if (strudelElementRef.current && showPlayer) {
      console.log('🎵 Updating Strudel code:', code.substring(0, 50) + '...')
      strudelElementRef.current.setAttribute('code', code)
    }
  }, [code, showPlayer])
  
  console.log('🎵 StrudelPlayer rendering:', { 
    messageId, 
    codeLength: code.length, 
    showPlayer,
    isExpanded 
  })
  
  return (
    <div className="space-y-3 border rounded-lg p-4 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music className="h-4 w-4 text-green-600" />
          <span className="text-sm font-medium text-green-700 dark:text-green-300">
            {title || "Generated Strudel Code"}{" "}
            {messageId && `(${messageId.slice(-4)})`}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-8"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8"
          >
            {isExpanded ? "Hide" : "Show"} Code
          </Button>
        </div>
      </div>

      {isExpanded && (
        <pre className="bg-gray-900 text-green-400 p-3 rounded text-sm overflow-x-auto border max-h-60 overflow-y-auto">
          <code>{code}</code>
        </pre>
      )}

      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 flex items-center gap-2 bg-green-600 hover:bg-green-700"
          onClick={handlePlayInline}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isLoading ? "Loading..." : "Play Inline"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => {
            const encodedCode = encodeURIComponent(code.trim())
            const timestamp = Date.now()
            const url = `https://strudel.cc/?code=${encodedCode}&t=${timestamp}`
            console.log('🎵 Opening in new tab:', url)
            window.open(url, '_blank')
          }}
        >
          <ExternalLink className="h-3 w-3" />
          Open in Strudel
        </Button>
      </div>
      
      {showPlayer && (
        <div className="mt-4">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-2">
            <Music className="h-3 w-3" />
            {isLoading ? (
              <span className="flex items-center gap-1">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600"></div>
                Loading Strudel embed component...
              </span>
            ) : (
              `Embedded Strudel Player - Message ${messageId?.slice(-4)}`
            )}
          </div>
          <div 
            ref={strudelContainerRef}
            className="w-full border rounded-lg bg-white dark:bg-gray-900"
            style={{ minHeight: '400px' }}
          />
        </div>
      )}
    </div>
  );
});

export function Chat({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading = false,
  stop,
  iframeKey,
  setIframeKey,
}: ChatProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  // Debug logging
  useEffect(() => {
    console.log(
      "🎵 Chat re-rendered with",
      messages.length,
      "messages, isLoading:",
      isLoading
    );
    messages.forEach((msg, i) => {
      const hasCode =
        msg.role === "assistant" && containsStrudelCode(msg.content);
      console.log(
        `Message ${i}: ${msg.role}, hasCode: ${hasCode}, length: ${msg.content.length}`
      );
    });
  }, [messages, isLoading]);

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg border">
        <Music className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            🎵 Jamflow
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            AI-powered conversational assistant & Strudel music generator with
            embedded player
          </p>
        </div>
      </div>

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-gray-400 py-8">
                <Music className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium mb-2">Welcome to Jamflow!</p>
                <p className="text-sm mb-4">
                  I'm your AI assistant for both conversation and music creation
                  with Strudel.
                </p>
                <div className="mt-4 space-y-2 text-xs">
                  <p>
                    <strong>Try chatting:</strong> "Hi, what day is it?" or
                    "Tell me about music production"
                  </p>
                  <p>
                    <strong>Or create music:</strong> "Create an energetic drum
                    pattern at 140 BPM"
                  </p>
                  <p>
                    <strong>Ask for help:</strong> "How does Strudel work?"
                  </p>
                  <p>
                    <strong>🎵 New:</strong> Generated code will have an
                    embedded Strudel player!
                  </p>
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const hasStrudelCode =
                  message.role === "assistant" &&
                  containsStrudelCode(message.content);
                const strudelCode = hasStrudelCode
                  ? extractStrudelCode(message.content)
                  : null;
                const explanation = hasStrudelCode
                  ? extractExplanation(message.content)
                  : message.content;

                return (
                  <div
                    key={`${message.id}-${message.content.length}`}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[90%] rounded-lg px-4 py-3 ${
                        message.role === "user"
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {hasStrudelCode && strudelCode ? (
                        <div className="space-y-4">
                          {/* Show the conversational explanation */}
                          {explanation && explanation.length > 10 && (
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {explanation}
                            </div>
                          )}

                          {/* Show the Strudel player - only render when message is complete */}
                          {message.content &&
                            !message.content.endsWith("...") && (
                              <StrudelPlayer
                                code={strudelCode}
                                title="Generated Music Pattern"
                                messageId={message.id}
                                iframeKey={iframeKey}
                                setIframeKey={setIframeKey}
                              />
                            )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {message.content}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-3 max-w-[85%]">
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Generating music...
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={handleInputChange}
              placeholder="Ask me anything or request Strudel music patterns..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()}>
              {isLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
            {isLoading && stop && (
              <Button type="button" variant="outline" onClick={stop}>
                Stop
              </Button>
            )}
          </form>

          {/* Quick action buttons */}
          <div className="flex gap-2 mt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const event = {
                  target: { value: "Hi, how are you today?" },
                } as any;
                handleInputChange(event);
              }}
            >
              👋 Say Hello
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const event = {
                  target: {
                    value: "Create an energetic drum pattern at 140 BPM",
                  },
                } as any;
                handleInputChange(event);
              }}
            >
              🥁 Make Beats
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const event = {
                  target: { value: "Explain how Strudel live-coding works" },
                } as any;
                handleInputChange(event);
              }}
            >
              📚 Learn Strudel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
