'use client'

import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'

type MessageBubbleProps = {
  role: 'user' | 'assistant'
  content: string
  isLoading?: boolean
}

export function MessageBubble({ role, content, isLoading }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar dot */}
      <div
        className={cn(
          'mt-1 h-6 w-6 shrink-0 rounded-full',
          isUser
            ? 'bg-talwa-teal'
            : 'bg-talwa-olive'
        )}
      />

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
          isUser
            ? 'bg-talwa-teal text-white rounded-tr-sm'
            : 'bg-white border border-talwa-sky text-talwa-navy rounded-tl-sm'
        )}
      >
        {isLoading ? (
          <span className="flex gap-1 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" />
          </span>
        ) : isUser ? (
          <p className="whitespace-pre-wrap">{content}</p>
        ) : (
          <ReactMarkdown
            className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1"
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="my-2 ml-4 list-disc">{children}</ul>,
              ol: ({ children }) => <ol className="my-2 ml-4 list-decimal">{children}</ol>,
              li: ({ children }) => <li className="mb-1">{children}</li>,
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  )
}
