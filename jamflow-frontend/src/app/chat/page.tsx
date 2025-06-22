'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/lib/auth-utils';
import { Chat } from '@/components/ui/chat';
import { generateResponseFromPrompt, getRecentChat, createChat } from '@/lib/api';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
};

export default function ChatPage() {
  const router = useRouter();
  const token = useRequireAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // Initialize chat - either get recent chat or create new one
  useEffect(() => {
    async function initializeChat() {
      if (!token) return;

      try {
        const recentChatResponse = await getRecentChat(token);
        
        if ('error' in recentChatResponse || !recentChatResponse.data?.id) {
          const createResponse = await createChat(token);
          if ('error' in createResponse) {
            throw new Error(createResponse.error);
          }
          setChatId(createResponse.data.id);
          return;
        }

        setChatId(recentChatResponse.data.id);

        if (recentChatResponse.data.messages?.length) {
          const convertedMessages = recentChatResponse.data.messages.map(msg => {
            const anyMsg = msg as any;

            // If backend already sent a flattened content string, use it
            if (anyMsg.content) {
              return {
                id: msg.id,
                content: anyMsg.content,
                role: msg.from === 'USER' ? 'user' : 'assistant',
              };
            }

            // Otherwise build content from snippets
            const snippetParts =
              (anyMsg.snippets as Array<{ type: 'CODE' | 'TEXT'; content: string }>) ??
              [];

            const content = snippetParts
              .map(s =>
                s.type === 'CODE'
                  ? `\`\`\`javascript\n${s.content}\n\`\`\`` // fence code
                  : s.content
              )
              .join('\n');

            return {
            id: msg.id,
              content,
              role: msg.from === 'USER' ? 'user' : 'assistant',
            };
          });
          setMessages(convertedMessages as Message[]);
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        setIsInitializing(false);
      }
    }

    initializeChat();
  }, [token]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !token || !chatId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: input.trim(),
      role: 'user',
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Create new abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: newMessages,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to stream response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
      };

      // Add the assistant message to the state
      setMessages(prev => [...prev, assistantMessage]);

      let accumulated = '';

      // Read the stream
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;
          assistantMessage.content = accumulated;

          // Update UI progressively
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessage.id
                ? { ...msg, content: accumulated }
                : msg
            )
          );
        }

        // Save to backend only after stream completes successfully
        const saveRes = await generateResponseFromPrompt(chatId, input, accumulated, token);
        if ('error' in saveRes) throw new Error(saveRes.error);
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request aborted');
        return;
      }

      console.error('Chat error:', error);
      setMessages(prev =>
        prev.map(m =>
          m.id === (Date.now() + 1).toString()
            ? { ...m, content: "I'm sorry, I'm having trouble connecting right now. Please try again!" }
            : m
        )
      );
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
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
    </main>
  );
} 