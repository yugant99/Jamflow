"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import ChatPage from "../page"
import { getChat } from "@/lib/api"
import { useRequireAuth } from "@/lib/auth-utils"

export default function ChatWithIdPage() {
  const params = useParams()
  const router = useRouter()
  const token = useRequireAuth()
  const chatId = params.chatId as string
  const [isValidChat, setIsValidChat] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function validateChat() {
      if (!chatId) {
        router.push('/login')
        return
      }

      try {
        // Try to fetch the chat first without token to check if it's public
        const response = await getChat(chatId)
        
        if ("error" in response) {
          // If error and no token, redirect to login
          if (!token) {
            router.push('/login')
            return
          }
          
          // If we have a token, try again with token
          const authResponse = await getChat(chatId, token)
          if ("error" in authResponse) {
            // If still error, redirect to login
            router.push('/login')
            return
          }
          
          setIsValidChat(true)
        } else {
          // Public chat is accessible
          setIsValidChat(true)
        }
      } catch (error) {
        console.error("Error validating chat:", error)
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }

    validateChat()
  }, [chatId, token, router])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  if (!isValidChat) {
    return null // This will never render as we redirect in useEffect
  }

  return <ChatPage initialChatId={chatId} />
} 