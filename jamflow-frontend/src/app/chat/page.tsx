"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { useRequireAuth } from "@/lib/auth-utils"
import { Chat } from "@/components/ui/chat"
import { ChatList } from "@/components/ui/chat-list"
import { generateResponseFromPrompt, getRecentChat, createChat, getChat } from "@/lib/api"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp?: Date
}

export default function ChatPage() {
  const router = useRouter()
  const token = useRequireAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [chatId, setChatId] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  const handleChatSelect = async (selectedChatId: string) => {
    if (!token) return
    
    try {
      const response = await getChat(selectedChatId, token)
      if ("error" in response) {
        console.error("Error loading chat:", response.error)
        return
      }
      
      const formattedMessages = response.data.messages.map((msg) => ({
        id: msg.id,
        role: msg.from === "USER" ? ("user" as const) : ("assistant" as const),
        content: msg.content || "",
        timestamp: msg.createdAt ? new Date(msg.createdAt) : undefined,
      }))
      
      setMessages(formattedMessages)
      setChatId(selectedChatId)
      router.push(`/chat/${selectedChatId}`)
    } catch (error) {
      console.error("Error loading chat:", error)
    }
  }

  // Initialize chat - either get recent chat or create new one
  useEffect(() => {
    async function initializeChat() {
      if (!token) return

      try {
        const recentChatResponse = await getRecentChat(token)

        if ("error" in recentChatResponse || !recentChatResponse.data?.id) {
          const createResponse = await createChat(token)
          if ("error" in createResponse) {
            throw new Error(createResponse.error)
          }
          setChatId(createResponse.data.id)
          return
        }

        setChatId(recentChatResponse.data.id)
        const formattedMessages = recentChatResponse.data.messages.map((msg) => ({
          id: msg.id,
          role: msg.from === "USER" ? ("user" as const) : ("assistant" as const),
          content: msg.content || "",
          timestamp: msg.createdAt ? new Date(msg.createdAt) : undefined,
        }))
        setMessages(formattedMessages)
      } catch (error) {
        console.error("Error initializing chat:", error)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeChat()
  }, [token])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || !chatId || !token) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: userMessage },
    ])

    setIsLoading(true)
    abortControllerRef.current = new AbortController()

    try {
      const response = await generateResponseFromPrompt(
        chatId,
        userMessage,
        "Generating response...",
        token
      )

      if ("error" in response) {
        throw new Error(response.error)
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: response.message,
        },
      ])
    } catch (error) {
      console.error("Error generating response:", error)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: "assistant",
          content: "Sorry, there was an error generating the response.",
        },
      ])
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
      setIsLoading(false)
    }
  }

  if (!token) {
    return null
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-slate-950 dark:via-slate-900 dark:to-purple-950">
      <ChatList
        token={token}
        currentChatId={chatId}
        onChatSelect={handleChatSelect}
      />
      <div className="flex-1 p-4">
        <Chat
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading}
          stop={handleStop}
          iframeKey={iframeKey}
          setIframeKey={setIframeKey}
        />
      </div>
    </div>
  )
}
