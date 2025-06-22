import React from "react"
import { useRouter } from "next/navigation"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import {
  MessageSquare,
  Plus,
  Share2,
  Trash2,
  Clock,
  Lock,
  Globe,
} from "lucide-react"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp?: Date
}

type Chat = {
  messages: Message[]
  id: string
  public?: boolean
}

interface ChatListProps {
  chats: Chat[]
  onCreateNewChat: () => void
  onSelectChat: (chatId: string) => void
  onDeleteChat?: (chatId: string) => void
  onShareChat?: (chatId: string) => void
  onUnshareChat?: (chatId: string) => void
  currentChatId?: string
  className?: string
}

export function ChatList({
  chats,
  onCreateNewChat,
  onSelectChat,
  onDeleteChat,
  onShareChat,
  onUnshareChat,
  currentChatId,
  className = "",
}: ChatListProps) {
  const router = useRouter()

  // Helper function to get chat title from first message
  const getChatTitle = (messages: Message[]) => {
    const firstUserMessage = messages.find((m) => m.role === "user")
    if (!firstUserMessage) return "New Chat"
    
    return firstUserMessage.content
      ? firstUserMessage.content.slice(0, 30) + (firstUserMessage.content.length > 30 ? "..." : "")
      : "New Chat"
  }

  // Helper function to format relative time
  const getRelativeTime = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) {
      return `${days}d ago`
    } else if (hours > 0) {
      return `${hours}h ago`
    } else if (minutes > 0) {
      return `${minutes}m ago`
    } else {
      return 'Just now'
    }
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <Button
          onClick={onCreateNewChat}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Chat
        </Button>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 p-2">
          {chats.map((chat) => {
            const isCurrentChat = chat.id === currentChatId
            const title = getChatTitle(chat.messages)
            const lastMessage = chat.messages[chat.messages.length - 1]
            const timestamp = lastMessage?.timestamp || new Date()

            return (
              <div
                key={chat.id}
                className={`group relative rounded-lg transition-all duration-200 ${
                  isCurrentChat
                    ? "bg-purple-50 dark:bg-purple-900/20"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
              >
                <Button
                  variant="ghost"
                  className="w-full h-auto p-4 justify-start space-x-3"
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare
                    className={`h-5 w-5 ${
                      isCurrentChat
                        ? "text-purple-500"
                        : "text-slate-500 dark:text-slate-400"
                    }`}
                  />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">{title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center mt-1">
                      <Clock className="h-3 w-3 mr-1" />
                      {getRelativeTime(timestamp)}
                    </p>
                  </div>
                </Button>

                {/* Action buttons */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {(onShareChat || onUnshareChat) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (chat.public && onUnshareChat) {
                          onUnshareChat(chat.id)
                        } else if (!chat.public && onShareChat) {
                          onShareChat(chat.id)
                        }
                      }}
                    >
                      {chat.public ? (
                        <Globe className="h-4 w-4 text-green-500" />
                      ) : (
                        <Share2 className="h-4 w-4 text-purple-500" />
                      )}
                    </Button>
                  )}
                  {onDeleteChat && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 hover:bg-red-100 dark:hover:bg-red-900/30"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(chat.id)
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
} 