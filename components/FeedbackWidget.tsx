'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { getRecentErrorSummary } from '@/lib/feedback-errors'

type FeedbackType = 'feedback' | 'bug' | 'suggestion'

const TYPE_LABELS: { value: FeedbackType; label: string }[] = [
  { value: 'feedback', label: 'Feedback' },
  { value: 'bug', label: 'Bug' },
  { value: 'suggestion', label: 'Suggestion' },
]

/** Track recent pages visited for context */
const navigationHistory: string[] = []
const MAX_NAV_HISTORY = 10

function trackNavigation() {
  if (typeof window === 'undefined') return
  const current = window.location.pathname + window.location.search
  if (navigationHistory[navigationHistory.length - 1] !== current) {
    navigationHistory.push(current)
    if (navigationHistory.length > MAX_NAV_HISTORY) navigationHistory.shift()
  }
}

/** Capture DOM screenshot via html2canvas */
async function captureScreenshot(): Promise<string | null> {
  try {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(document.body, {
      scale: 0.5,
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#F8F9FB',
      ignoreElements: (el) => {
        return el.getAttribute('data-testid') === 'feedback-tab' ||
          el.getAttribute('data-testid') === 'feedback-modal' ||
          el.closest?.('[data-testid="feedback-modal"]') !== null
      },
    })
    return canvas.toDataURL('image/png', 0.7)
  } catch (err) {
    console.warn('[feedback] Screenshot capture failed:', err)
    return null
  }
}

export default function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [type, setType] = useState<FeedbackType>('feedback')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [includeScreenshot, setIncludeScreenshot] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track navigation on mount and route changes
  useEffect(() => {
    trackNavigation()
    const observer = new MutationObserver(() => trackNavigation())
    observer.observe(document.querySelector('title') || document.head, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    return () => observer.disconnect()
  }, [])

  // Auto-capture screenshot when the modal opens
  const captureOnOpen = useCallback(async () => {
    if (!isOpen) return
    const shot = await captureScreenshot()
    setScreenshotPreview(shot)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      captureOnOpen()
      if (textareaRef.current) textareaRef.current.focus()
    }
  }, [isOpen, captureOnOpen])

  // Reset state when closing
  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setMessage('')
        setType('feedback')
        setSubmitted(false)
        setScreenshotPreview(null)
        setIncludeScreenshot(true)
      }, 200)
      return () => clearTimeout(t)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return
    setSubmitting(true)

    try {
      const errorSummary = getRecentErrorSummary()
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          url: window.location.href,
          screenshot: includeScreenshot ? screenshotPreview : undefined,
          metadata: {
            recentErrors: errorSummary || undefined,
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            navigationHistory: navigationHistory.slice(),
            viewport: {
              width: window.innerWidth,
              height: window.innerHeight,
            },
          },
        }),
      })
      setSubmitted(true)
      setTimeout(() => setIsOpen(false), 1200)
    } catch {
      // Silently fail — best effort
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Right-edge tab — attached to browser edge, vertically centered */}
      {!isOpen && (
        <button
          data-testid="feedback-tab"
          onClick={() => setIsOpen(true)}
          className="fixed z-50 flex items-center justify-center transition-opacity hover:opacity-80"
          style={{
            right: 0,
            top: '50%',
            transform: 'translateY(-50%) rotate(-90deg)',
            transformOrigin: 'bottom right',
            backgroundColor: '#0063FF',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            padding: '6px 14px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase' as const,
            whiteSpace: 'nowrap' as const,
          }}
          aria-label="Send feedback"
        >
          Feedback
        </button>
      )}

      {/* Modal overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false)
          }}
        >
          {/* Modal card — anchored to right edge, vertically centered */}
          <div
            data-testid="feedback-modal"
            className="w-80 border flex flex-col mr-0"
            style={{
              backgroundColor: '#fff',
              borderColor: '#E5E7EB',
              borderRight: 'none',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#E5E7EB' }}>
              <span className="text-sm font-semibold" style={{ color: '#111827' }}>
                Send feedback
              </span>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs hover:opacity-80"
                style={{ color: '#9CA3AF', cursor: 'pointer', border: 'none', background: 'none' }}
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {submitted ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium" style={{ color: '#111827' }}>
                  Thanks for the feedback!
                </p>
                <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                  We will review it shortly.
                </p>
              </div>
            ) : (
              <>
                {/* Type selector */}
                <div className="px-4 pt-3 flex gap-1.5">
                  {TYPE_LABELS.map(({ value, label }) => (
                    <button
                      key={value}
                      onClick={() => setType(value)}
                      className="px-2.5 py-1 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{
                        backgroundColor: type === value ? '#0063FF' : '#F3F4F6',
                        color: type === value ? '#fff' : '#6B7280',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Message textarea */}
                <div className="px-4 pt-3 pb-2">
                  <textarea
                    ref={textareaRef}
                    data-testid="feedback-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      type === 'bug'
                        ? 'What happened? What did you expect?'
                        : type === 'suggestion'
                          ? 'What would make this better?'
                          : 'Tell us what you think...'
                    }
                    className="w-full text-sm resize-none focus:outline-none focus:border-blue-400"
                    style={{
                      border: '1px solid #E5E7EB',
                      padding: '8px 10px',
                      minHeight: '80px',
                      color: '#111827',
                      backgroundColor: '#FAFAFA',
                    }}
                    maxLength={5000}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        handleSubmit()
                      }
                    }}
                  />
                </div>

                {/* Screenshot preview */}
                {screenshotPreview && (
                  <div className="px-4 pb-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={includeScreenshot}
                        onChange={(e) => setIncludeScreenshot(e.target.checked)}
                        className="accent-blue-500"
                      />
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-gray-400">
                        Include screenshot
                      </span>
                    </label>
                    {includeScreenshot && (
                      <div
                        className="mt-1.5 border overflow-hidden cursor-pointer"
                        style={{ borderColor: '#E5E7EB', maxHeight: '80px' }}
                        onClick={() => {
                          const w = window.open()
                          if (w) {
                            w.document.write(`<img src="${screenshotPreview}" style="max-width:100%"/>`)
                          }
                        }}
                      >
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          style={{ width: '100%', display: 'block' }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="px-4 pb-3 flex items-center justify-between">
                  <span className="text-[10px]" style={{ color: '#9CA3AF' }}>
                    {message.length > 0 ? `${message.length}/5000` : 'Cmd+Enter to send'}
                  </span>
                  <button
                    data-testid="feedback-submit"
                    onClick={handleSubmit}
                    disabled={!message.trim() || submitting}
                    className="px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80"
                    style={{
                      backgroundColor: message.trim() ? '#0063FF' : '#D1D5DB',
                      color: '#fff',
                      border: 'none',
                      cursor: message.trim() && !submitting ? 'pointer' : 'default',
                      opacity: submitting ? 0.6 : 1,
                    }}
                  >
                    {submitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
