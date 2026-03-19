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
  hideInput?: boolean
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
  hideInput = false,
}: ChatContainerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive or a widget is inserted
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, isLoading, bottomSlot])

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
          {messages
            .filter((m) => {
              if (m.role === 'user') return true
              // For assistant messages, check for actual text content.
              // content may be a string or an array of content parts (AI SDK v4).
              const c = m.content
              if (typeof c === 'string') return c.trim().length > 0
              if (Array.isArray(c)) {
                return c.some(
                  (part: unknown) =>
                    typeof part === 'object' &&
                    part !== null &&
                    'type' in part &&
                    (part as { type: string }).type === 'text' &&
                    'text' in part &&
                    ((part as { text: string }).text ?? '').trim().length > 0
                )
              }
              return !!c
            })
            .map((message) => {
              // Extract text content — handle both string and array forms
              const text =
                typeof message.content === 'string'
                  ? message.content
                  : Array.isArray(message.content)
                    ? (message.content as Array<{ type: string; text?: string }>)
                        .filter((p) => p.type === 'text')
                        .map((p) => p.text ?? '')
                        .join('')
                    : String(message.content ?? '')
              return (
                <MessageBubble
                  key={message.id}
                  role={message.role as 'user' | 'assistant'}
                  content={text}
                />
              )
            })}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
            <MessageBubble role="assistant" content="" isLoading />
          )}
          {bottomSlot}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {!hideInput && (
        <div className="border-t border-border p-3 bg-background">
          <ChatInput
            value={input}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            placeholder={placeholder}
          />
        </div>
      )}
    </div>
  )
}
