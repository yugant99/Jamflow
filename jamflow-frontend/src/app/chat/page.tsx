"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useRequireAuth } from "@/lib/auth-utils"
import { Chat } from "@/components/ui/chat"
import { ChatList } from "@/components/ui/chat-list"
import { generateResponseFromPrompt, getRecentChat, createChat, getChats, deleteChat, shareChat, unshareChat, getChat } from "@/lib/api"
import type { GetChatResponseData } from "@/lib/types"

type Snippet = {
  type: "CODE" | "TEXT"
  content: string
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  snippets?: Snippet[]
  timestamp?: Date
}

type ChatPageProps = {
  initialChatId?: string
}

export default function ChatPage({ initialChatId }: ChatPageProps = {}) {
  const router = useRouter()
  const token = useRequireAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [chats, setChats] = useState<{ id: string, messages: Message[] }[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [chatId, setChatId] = useState<string | null>(initialChatId || null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const [iframeKey, setIframeKey] = useState(0)

  // Fetch all chats
  useEffect(() => {
    async function fetchChats() {
      if (!token) return

      try {
        const response = await getChats(token)
        if (!("error" in response)) {
          const formattedChats = response.data.chats.map(chat => ({
            id: chat.id,
            messages: chat.messages.map(msg => ({
              id: msg.id,
              content: msg.snippets?.map(s => s.content).join("\n") || "",
              role: (msg.from === "USER" ? "user" : "assistant") as "user" | "assistant",
              timestamp: new Date()
            }))
          }))
          setChats(formattedChats)
        }
      } catch (error) {
        console.error("Error fetching chats:", error)
      }
    }

    fetchChats()
  }, [token])

  // Initialize chat - either get recent chat, load specific chat, or create new one
  useEffect(() => {
    async function initializeChat() {
      if (!token) return

      try {
        if (initialChatId) {
          // If we have an initialChatId, try to load that specific chat
          const response = await getChat(initialChatId, token)
          
          if ("error" in response) {
            throw new Error(response.error)
          }

          const convertedMessages = response.data.messages.map((msg: any) => ({
            id: msg.id,
            content: msg.snippets?.map((s: any) => s.content).join("\n") || "",
            role: msg.from === "USER" ? "user" : "assistant" as "user" | "assistant",
            timestamp: msg.createdAt
          }))
          setMessages(convertedMessages)
          setChatId(initialChatId)
          return
        }

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

        if (recentChatResponse.data.messages?.length) {
          const convertedMessages = recentChatResponse.data.messages.map((msg) => {
            const anyMsg = msg as any

            // If backend already sent a flattened content string, use it
            if (anyMsg.content) {
              return {
                id: msg.id,
                content: anyMsg.content,
                role: msg.from === "USER" ? "user" : "assistant",
              }
            }

            // Otherwise build content from snippets
            const snippetParts = (anyMsg.snippets as Array<{ type: "CODE" | "TEXT"; content: string }>) ?? []

            const content = snippetParts
              .map((s) =>
                s.type === "CODE"
                  ? `\`\`\`javascript\n${s.content}\n\`\`\`` // fence code
                  : s.content,
              )
              .join("\n")

            return {
              id: msg.id,
              content,
              role: msg.from === "USER" ? "user" : "assistant",
            }
          })
          setMessages(convertedMessages as Message[])
        }
      } catch (error) {
        console.error("Error initializing chat:", error)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeChat()
  }, [token, initialChatId])

  const handleCreateNewChat = async () => {
    if (!token) return

    try {
      const createResponse = await createChat(token)
      if ("error" in createResponse) {
        throw new Error(createResponse.error)
      }
      
      // Update chats list
      setChats(prev => [...prev, { id: createResponse.data.id, messages: [] }])
      
      // Set as current chat
      setChatId(createResponse.data.id)
      setMessages([])
      
      // Refresh chats list
      const response = await getChats(token)
      if (!("error" in response)) {
        const formattedChats = response.data.chats.map(chat => ({
          id: chat.id,
          messages: chat.messages.map(msg => ({
            id: msg.id,
            content: msg.snippets?.map(s => s.content).join("\n") || "",
            role: (msg.from === "USER" ? "user" : "assistant") as "user" | "assistant",
            timestamp: new Date()
          }))
        }))
        setChats(formattedChats)
      }
    } catch (error) {
      console.error("Error creating new chat:", error)
    }
  }

  const handleSelectChat = async (selectedChatId: string) => {
    if (!token) return

    try {
      // Update URL without full page reload
      router.push(`/chat/${selectedChatId}`, { scroll: false })
      
      // Fetch and load the selected chat
      const response = await getChat(selectedChatId, token)
      
      if ("error" in response) {
        throw new Error(response.error)
      }

      const convertedMessages = response.data.messages.map((msg) => ({
        id: msg.id,
        content: msg.content || "",
        role: msg.from === "USER" ? "user" : "assistant" as "user" | "assistant",
        timestamp: msg.createdAt
      }))
      
      setMessages(convertedMessages)
      setChatId(selectedChatId)
    } catch (error) {
      console.error("Error selecting chat:", error)
    }
  }

  const handleDeleteChat = async (chatIdToDelete: string) => {
    if (!token) return

    try {
      const response = await deleteChat(chatIdToDelete, token)
      if (!("error" in response)) {
        // Remove from chats list
        setChats(prev => prev.filter(chat => chat.id !== chatIdToDelete))
        
        // If current chat was deleted, create a new one
        if (chatId === chatIdToDelete) {
          handleCreateNewChat()
        }
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
    }
  }

  const handleShareChat = async (chatIdToShare: string) => {
    if (!token) return

    try {
      const response = await shareChat(chatIdToShare, token)
      if (!("error" in response)) {
        // Update chat in the list
        setChats(prev => prev.map(chat => 
          chat.id === chatIdToShare 
            ? { ...chat, public: true }
            : chat
        ))
        
        // Show success message
        console.log("Chat shared successfully")
      }
    } catch (error) {
      console.error("Error sharing chat:", error)
    }
  }

  const handleUnshareChat = async (chatIdToUnshare: string) => {
    if (!token) return

    try {
      const response = await unshareChat(chatIdToUnshare, token)
      if (!("error" in response)) {
        // Update chat in the list
        setChats(prev => prev.map(chat => 
          chat.id === chatIdToUnshare 
            ? { ...chat, public: false }
            : chat
        ))
        
        // Show success message
        console.log("Chat unshared successfully")
      }
    } catch (error) {
      console.error("Error unsharing chat:", error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !token || !chatId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: "user",
    }

    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput("")
    setIsLoading(true)

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok || !response.body) {
        throw new Error("Failed to stream response")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "",
        role: "assistant",
      }

      // Add the assistant message to the state
      setMessages((prev) => [...prev, assistantMessage])

      let accumulated = ""

      // Read the stream
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          accumulated += chunk
          assistantMessage.content = accumulated

          // Update UI progressively
          setMessages((prev) =>
            prev.map((msg) => (msg.id === assistantMessage.id ? { ...msg, content: accumulated } : msg)),
          )
        }

        // Save to backend only after stream completes successfully
        const saveRes = await generateResponseFromPrompt(chatId, input, accumulated, token)
        if ("error" in saveRes) throw new Error(saveRes.error)
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        console.log("Request aborted")
        return
      }

      console.error("Chat error:", error)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === (Date.now() + 1).toString()
            ? { ...m, content: "I'm sorry, I'm having trouble connecting right now. Please try again!" }
            : m,
        ),
      )
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  return (
    <main className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:bg-grid-slate-700/25 dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
      
      {/* Chat List Sidebar */}
      <aside className="w-80 border-r border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10">
        <ChatList
          chats={chats}
          onCreateNewChat={handleCreateNewChat}
          onSelectChat={handleSelectChat}
          onDeleteChat={handleDeleteChat}
          onShareChat={handleShareChat}
          onUnshareChat={handleUnshareChat}
          currentChatId={chatId || undefined}
        />
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1">
        <Chat
          messages={messages}
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={isLoading || isInitializing}
          stop={stop}
          iframeKey={iframeKey}
          setIframeKey={setIframeKey}
        />
      </div>
    </main>
  )
}
