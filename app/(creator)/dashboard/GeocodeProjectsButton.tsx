'use client'

import { useState } from 'react'
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { geocodeProjectsAction } from './actions'

type Status = 'idle' | 'loading' | 'done' | 'error'

export function GeocodeProjectsButton() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<{ updated: number; skipped: number; failed: string[] } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleClick() {
    setStatus('loading')
    setResult(null)
    setErrorMsg(null)
    try {
      const res = await geocodeProjectsAction()
      if ('error' in res) {
        setErrorMsg(res.error)
        setStatus('error')
      } else {
        setResult(res)
        setStatus('done')
      }
    } catch (e) {
      setErrorMsg(String(e))
      setStatus('error')
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-talwa-navy flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-talwa-teal" />
            Geocode Projects
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Fetches neighborhood &amp; coordinates for projects missing location data.
            Safe to re-run — only processes projects with no lat/lng yet.
          </p>
        </div>
        <button
          onClick={handleClick}
          disabled={status === 'loading'}
          className="shrink-0 rounded-lg bg-talwa-teal text-white text-xs font-medium px-3 py-1.5 hover:bg-talwa-teal/90 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {status === 'loading' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {status === 'loading' ? 'Running…' : 'Run backfill'}
        </button>
      </div>

      {status === 'done' && result && (
        <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            Done — <strong>{result.updated}</strong> updated
            {result.skipped > 0 && `, ${result.skipped} skipped (no location)`}
            {result.failed.length > 0 && (
              <span className="text-amber-700">
                , {result.failed.length} failed: {result.failed.join('; ')}
              </span>
            )}
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-2 text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  )
}
