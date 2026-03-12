'use client'

import { useEffect, useRef } from 'react'
import type { Message } from 'ai'
import { MessageBubble } from './MessageBubble'
import { ChatInput } from './ChatInput'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { FormEvent } from 'react'

type ChatContainerProps = {
  messages: Message[]
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void
  isLoading?: boolean
  placeholder?: string
  className?: string
  bottomSlot?: React.ReactNode
}

export function ChatContainer({
  messages,
  input,
  handleInputChange,
  handleSubmit,
  isLoading = false,
  placeholder,
  className,
  bottomSlot,
}: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isLoading])

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="text-4xl mb-4">💬</div>
              <p className="text-sm text-muted-foreground max-w-xs">
                Start a conversation to share your thoughts about this project.
              </p>
            </div>
          )}
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              role={message.role as 'user' | 'assistant'}
              content={message.content}
            />
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <MessageBubble role="assistant" content="" isLoading />
          )}
          {bottomSlot}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-border p-3 bg-background">
        <ChatInput
          value={input}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          isLoading={isLoading}
          placeholder={placeholder}
        />
      </div>
    </div>
  )
}
