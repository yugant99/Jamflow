"use client"

import React, { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Send,
  Music,
  Play,
  ExternalLink,
  Copy,
  Check,
  Bot,
  User,
  Sparkles,
  AudioWaveformIcon as Waveform,
  Volume2,
  Headphones,
  Zap,
} from "lucide-react"

// Simple message type that matches our custom implementation
type Message = {
  id: string
  role: "user" | "assistant"
  content: string
}

interface ChatProps {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading?: boolean
  stop?: () => void
  iframeKey: number
  setIframeKey: React.Dispatch<React.SetStateAction<number>>
}

// Enhanced Strudel code detection
function containsStrudelCode(content: string): boolean {
  const strudelPatterns = [
    /setcpm\s*$$\s*\d+\s*$$/,
    /sound\s*$$\s*["'][^"']+["']\s*$$/,
    /note\s*$$\s*["'][^"']+["']\s*$$/,
    /stack\s*\(/,
    /d1\s*$$\s*[^)]+\s*$$/,
    /s\s*$$\s*["'][^"']+["']\s*$$/,
    /\$\s*:\s*sound/,
    /\.gain\s*\(/,
    /\.room\s*\(/,
    /\.delay\s*\(/,
    /\.lpf\s*\(/,
  ]

  return strudelPatterns.some((pattern) => pattern.test(content))
}

// Enhanced code extraction with better parsing
function extractStrudelCode(content: string): string | null {
  if (!containsStrudelCode(content)) return null

  // Try to extract from code blocks first (\`\`\`javascript, \`\`\`strudel, etc.)
  const codeBlockPatterns = [
    /```(?:javascript|js|strudel)\n?([\s\S]*?)\n?```/g,
    /```\n?([\s\S]*?setcpm[\s\S]*?)\n?```/g,
  ]

  for (const pattern of codeBlockPatterns) {
    const matches = Array.from(content.matchAll(pattern))
    if (matches.length > 0) {
      return matches.map((match) => match[1].trim()).join("\n\n")
    }
  }

  // Extract individual Strudel lines
  const lines = content.split("\n")
  const codeLines = lines.filter((line) => {
    const trimmed = line.trim()
    return (
      containsStrudelCode(trimmed) &&
      !trimmed.startsWith("//") && // Skip comments
      trimmed.length > 3
    ) // Skip very short lines
  })

  return codeLines.length > 0 ? codeLines.join("\n") : null
}

// Extract explanatory text (non-code parts)
function extractExplanation(content: string): string {
  // Remove code blocks
  const explanation = content.replace(/```[\s\S]*?```/g, "")

  // Remove individual code lines
  const lines = explanation.split("\n")
  const textLines = lines.filter((line) => {
    const trimmed = line.trim()
    return !containsStrudelCode(trimmed) || trimmed.startsWith("//")
  })

  return textLines.join("\n").trim()
}

// Modern Strudel Player Component
const StrudelPlayer = React.memo(function StrudelPlayer({
  code,
  title,
  messageId,
}: {
  code: string
  title?: string
  messageId?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [showPlayer, setShowPlayer] = useState(false)
  const strudelContainerRef = useRef<HTMLDivElement>(null)
  const strudelElementRef = useRef<HTMLElement | null>(null)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePlayInline = () => {
    console.log("🎵 Play Inline clicked - Creating Strudel embed component")
    console.log("🎵 Code to load:", code.substring(0, 100) + "...")

    setIsLoading(true)
    setShowPlayer(true)

    // Create the Strudel embed component dynamically
    setTimeout(() => {
      if (strudelContainerRef.current) {
        // Clear any existing component
        strudelContainerRef.current.innerHTML = ""

        // Create new strudel-repl element
        const strudelElement = document.createElement("strudel-repl")
        strudelElement.setAttribute("code", code)

        // Add some styling
        strudelElement.style.width = "100%"
        strudelElement.style.height = "400px"
        strudelElement.style.border = "1px solid #e5e7eb"
        strudelElement.style.borderRadius = "12px"

        // Store reference and append
        strudelElementRef.current = strudelElement
        strudelContainerRef.current.appendChild(strudelElement)

        console.log("🎵 Strudel embed component created successfully")
        setIsLoading(false)
      }
    }, 100)
  }

  // Load Strudel embed script on component mount
  useEffect(() => {
    // Check if script is already loaded
    if (!document.querySelector('script[src*="@strudel/embed"]')) {
      const script = document.createElement("script")
      script.src = "https://unpkg.com/@strudel/embed@latest"
      script.async = true
      script.onload = () => {
        console.log("🎵 Strudel embed script loaded successfully")
      }
      script.onerror = () => {
        console.error("🎵 Failed to load Strudel embed script")
      }
      document.head.appendChild(script)
    }
  }, [])

  // Update code when it changes
  useEffect(() => {
    if (strudelElementRef.current && showPlayer) {
      console.log("🎵 Updating Strudel code:", code.substring(0, 50) + "...")
      strudelElementRef.current.setAttribute("code", code)
    }
  }, [code, showPlayer])

  console.log("🎵 StrudelPlayer rendering:", {
    messageId,
    codeLength: code.length,
    showPlayer,
    isExpanded,
  })

  return (
    <div className="space-y-4 border-0 rounded-xl p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/50 dark:via-pink-950/50 dark:to-orange-950/50 backdrop-blur-sm shadow-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg">
              <Music className="h-5 w-5 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
          </div>
          <div>
            <span className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400 bg-clip-text text-transparent">
              {title || "Generated Strudel Code"}
            </span>
            {messageId && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Pattern ID: {messageId.slice(-4)}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-8 w-8 p-0 border-purple-200 hover:border-purple-300 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/50"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-600" />
            ) : (
              <Copy className="h-3 w-3 text-purple-600 dark:text-purple-400" />
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 px-3 border-purple-200 hover:border-purple-300 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400"
          >
            {isExpanded ? "Hide" : "Show"} Code
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="relative">
          <pre className="bg-slate-900 text-green-400 p-4 rounded-xl text-sm overflow-x-auto border border-slate-700 max-h-60 overflow-y-auto shadow-inner">
            <code>{code}</code>
          </pre>
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="bg-slate-800 text-slate-300 text-xs">
              Strudel
            </Badge>
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <Button
          size="sm"
          className="flex-1 flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover:shadow-xl transition-all duration-200"
          onClick={handlePlayInline}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {isLoading ? "Loading..." : "Play Inline"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex items-center gap-2 border-purple-200 hover:border-purple-300 hover:bg-purple-50 dark:border-purple-800 dark:hover:bg-purple-900/50 text-purple-600 dark:text-purple-400"
          onClick={() => {
            const encodedCode = encodeURIComponent(code.trim())
            const timestamp = Date.now()
            const url = `https://strudel.cc/?code=${encodedCode}&t=${timestamp}`
            console.log("🎵 Opening in new tab:", url)
            window.open(url, "_blank")
          }}
        >
          <ExternalLink className="h-3 w-3" />
          Open in Strudel
        </Button>
      </div>

      {showPlayer && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <Waveform className="h-3 w-3" />
            {isLoading ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-purple-600" />
                Loading Strudel embed component...
              </span>
            ) : (
              <span>Embedded Strudel Player - Pattern {messageId?.slice(-4)}</span>
            )}
          </div>
          <div
            ref={strudelContainerRef}
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 shadow-inner overflow-hidden"
            style={{ minHeight: "400px" }}
          />
        </div>
      )}
    </div>
  )
})

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
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector("[data-radix-scroll-area-viewport]")
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }, [messages])

  // Debug logging
  useEffect(() => {
    console.log("🎵 Chat re-rendered with", messages.length, "messages, isLoading:", isLoading)
    messages.forEach((msg, i) => {
      const hasCode = msg.role === "assistant" && containsStrudelCode(msg.content)
      console.log(`Message ${i}: ${msg.role}, hasCode: ${hasCode}, length: ${msg.content.length}`)
    })
  }, [messages, isLoading])

  return (
    <div className="flex flex-col h-screen max-w-6xl mx-auto p-6">
      {/* Modern Header */}
      <div className="flex items-center gap-4 mb-8 p-6 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10 dark:from-purple-500/20 dark:via-pink-500/20 dark:to-orange-500/20 rounded-2xl border border-purple-200/50 dark:border-purple-800/50 backdrop-blur-sm shadow-lg">
        <div className="relative">
          <div className="h-16 w-16 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-2xl flex items-center justify-center shadow-xl">
            <Music className="h-8 w-8 text-white" />
          </div>
          <div className="absolute -top-2 -right-2 h-6 w-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
            <Sparkles className="h-3 w-3 text-yellow-800" />
          </div>
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 dark:from-purple-400 dark:via-pink-400 dark:to-orange-400 bg-clip-text text-transparent">
            🎵 Jamflow
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            AI-powered conversational assistant & Strudel music generator with embedded player
          </p>
        </div>
        <div className="flex gap-2">
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-800">
            <Volume2 className="h-3 w-3 mr-1" />
            Live
          </Badge>
          <Badge
            variant="outline"
            className="border-purple-200 text-purple-600 dark:border-purple-800 dark:text-purple-400"
          >
            <Zap className="h-3 w-3 mr-1" />
            AI Powered
          </Badge>
        </div>
      </div>

      {/* Messages Area */}
      <Card className="flex-1 flex flex-col border-0 shadow-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
        <ScrollArea className="flex-1 p-6" ref={scrollAreaRef}>
          <div className="space-y-6">
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="relative mb-8">
                  <div className="h-20 w-20 bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 rounded-3xl flex items-center justify-center shadow-2xl mx-auto">
                    <Headphones className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 h-8 w-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                    <Sparkles className="h-4 w-4 text-yellow-800" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Welcome to Jamflow!</h2>
                <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
                  I'm your AI assistant for both conversation and music creation with Strudel.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-sm">
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h3 className="font-semibold text-blue-700 dark:text-blue-300 mb-2">💬 Chat with me</h3>
                    <p className="text-blue-600 dark:text-blue-400">
                      "Hi, what day is it?" or "Tell me about music production"
                    </p>
                  </div>
                  <div className="p-4 bg-purple-50 dark:bg-purple-950/30 rounded-xl border border-purple-200 dark:border-purple-800">
                    <h3 className="font-semibold text-purple-700 dark:text-purple-300 mb-2">🎵 Create music</h3>
                    <p className="text-purple-600 dark:text-purple-400">
                      "Create an energetic drum pattern at 140 BPM"
                    </p>
                  </div>
                  <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl border border-green-200 dark:border-green-800">
                    <h3 className="font-semibold text-green-700 dark:text-green-300 mb-2">📚 Learn Strudel</h3>
                    <p className="text-green-600 dark:text-green-400">"How does Strudel work?"</p>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-800">
                    <h3 className="font-semibold text-orange-700 dark:text-orange-300 mb-2">🎹 Embedded Player</h3>
                    <p className="text-orange-600 dark:text-orange-400">Generated code includes live Strudel player!</p>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message, index) => {
                const hasStrudelCode = message.role === "assistant" && containsStrudelCode(message.content)
                const strudelCode = hasStrudelCode ? extractStrudelCode(message.content) : null
                const explanation = hasStrudelCode ? extractExplanation(message.content) : message.content

                return (
                  <div
                    key={`${message.id}-${message.content.length}`}
                    className={`flex gap-4 animate-in slide-in-from-bottom-2 duration-300 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    {message.role === "assistant" && (
                      <Avatar className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-white dark:border-slate-800 shadow-lg">
                        <AvatarFallback className="bg-transparent text-white">
                          <Bot className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-6 py-4 shadow-lg ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/25"
                          : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-200/50 dark:border-slate-700/50"
                      }`}
                    >
                      {hasStrudelCode && strudelCode ? (
                        <div className="space-y-6">
                          {/* Show the conversational explanation */}
                          {explanation && explanation.length > 10 && (
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{explanation}</div>
                          )}

                          {/* Show the Strudel player - only render when message is complete */}
                          {message.content && !message.content.endsWith("...") && (
                            <StrudelPlayer code={strudelCode} title="Generated Music Pattern" messageId={message.id} />
                          )}
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                      )}
                    </div>

                    {message.role === "user" && (
                      <Avatar className="h-10 w-10 bg-gradient-to-br from-slate-600 to-slate-700 border-2 border-white dark:border-slate-800 shadow-lg">
                        <AvatarFallback className="bg-transparent text-white">
                          <User className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                )
              })
            )}

            {isLoading && (
              <div className="flex gap-4 animate-in slide-in-from-bottom-2">
                <Avatar className="h-10 w-10 bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-white dark:border-slate-800 shadow-lg">
                  <AvatarFallback className="bg-transparent text-white">
                    <Bot className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white dark:bg-slate-800 rounded-2xl px-6 py-4 shadow-lg border border-slate-200/50 dark:border-slate-700/50">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <div
                        className="h-2 w-2 bg-purple-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <div
                        className="h-2 w-2 bg-pink-500 rounded-full animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <div
                        className="h-2 w-2 bg-orange-500 rounded-full animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                    <span className="text-sm text-slate-600 dark:text-slate-400">Generating music...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Enhanced Input Area */}
        <div className="border-t border-slate-200/50 dark:border-slate-700/50 p-6 bg-slate-50/50 dark:bg-slate-800/50 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex gap-3 mb-4">
            <div className="relative flex-1">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask me anything or request Strudel music patterns..."
                className="h-12 pr-12 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:border-purple-500 dark:focus:border-purple-400 focus:ring-purple-500/20 rounded-xl text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 shadow-sm"
                disabled={isLoading}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-1.5 font-mono text-[10px] font-medium text-slate-600 dark:text-slate-400">
                  ⏎
                </kbd>
              </div>
            </div>

            {isLoading ? (
              <Button
                type="button"
                onClick={stop}
                size="lg"
                variant="outline"
                className="h-12 px-6 bg-red-50 hover:bg-red-100 border-red-200 text-red-600 hover:text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl"
              >
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="lg"
                disabled={!input.trim()}
                className="h-12 px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 disabled:opacity-50 disabled:shadow-none rounded-xl transition-all duration-200"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>

          {/* Enhanced Quick Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const event = {
                  target: { value: "Hi, how are you today?" },
                } as any
                handleInputChange(event)
              }}
              className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg"
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
                } as any
                handleInputChange(event)
              }}
              className="bg-purple-50 hover:bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-900/30 rounded-lg"
            >
              🥁 Make Beats
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const event = {
                  target: { value: "Explain how Strudel live-coding works" },
                } as any
                handleInputChange(event)
              }}
              className="bg-green-50 hover:bg-green-100 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400 dark:hover:bg-green-900/30 rounded-lg"
            >
              📚 Learn Strudel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
