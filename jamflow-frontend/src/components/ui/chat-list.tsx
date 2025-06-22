"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquare,
  Plus,
  Share2,
  Trash2,
  Clock,
  ChevronRight,
} from "lucide-react"
import { getChats, createChat, deleteChat } from "@/lib/api"

type ChatListProps = {
  token: string
  currentChatId: string | null
  onChatSelect: (chatId: string) => void
}

export function ChatList({ token, currentChatId, onChatSelect }: ChatListProps) {
  const router = useRouter()
  const [chats, setChats] = useState<Array<{
    id: string
    messages: Array<{
      id: string
      content: string
      from: "USER" | "BOT"
    }>
  }>>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchChats = async () => {
    try {
      const response = await getChats(token)
      if ("error" in response) {
        console.error("Error fetching chats:", response.error)
        return
      }
      setChats(response.data.chats)
    } catch (error) {
      console.error("Error fetching chats:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchChats()
  }, [token])

  const handleNewChat = async () => {
    try {
      const response = await createChat(token)
      if ("error" in response) {
        console.error("Error creating chat:", response.error)
        return
      }
      router.push(`/chat/${response.data.id}`)
      fetchChats()
    } catch (error) {
      console.error("Error creating chat:", error)
    }
  }

  const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await deleteChat(chatId, token)
      if ("error" in response) {
        console.error("Error deleting chat:", response.error)
        return
      }
      fetchChats()
      if (currentChatId === chatId) {
        router.push("/chat")
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
    }
  }

  const getChatPreview = (messages: any[]) => {
    const lastUserMessage = messages
      .filter((msg) => msg.from === "USER")
      .pop()
    return lastUserMessage?.content || "New conversation"
  }

  return (
    <Card className="w-80 h-full flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-0 shadow-xl">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <Button
          onClick={handleNewChat}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500">
              Loading chats...
            </div>
          ) : chats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-500">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p>No chats yet</p>
            </div>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                onClick={() => onChatSelect(chat.id)}
                className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                  currentChatId === chat.id
                    ? "bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <MessageSquare className="h-5 w-5 text-slate-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {getChatPreview(chat.messages)}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="secondary"
                          className="text-xs bg-slate-100 dark:bg-slate-800"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {chat.messages.length} messages
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </Card>
  )
} 