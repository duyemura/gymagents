/**
 * Client-side error buffer for the feedback pipeline.
 *
 * Captures window.onerror and unhandledrejection events, buffers them
 * (max 5 per minute), and auto-reports to /api/feedback. Exposes the
 * recent error buffer so the FeedbackWidget can attach context.
 *
 * Auto-captures screenshots on errors (rate-limited to 1/minute).
 */

type CapturedError = {
  message: string
  stack?: string
  timestamp: number
}

/** Module-level buffer of recent errors — accessible by the feedback widget */
export const recentErrors: CapturedError[] = []

const MAX_BUFFER = 20
const MAX_REPORTS_PER_MINUTE = 5
let reportsThisMinute = 0
let minuteResetTimer: ReturnType<typeof setTimeout> | null = null

// Screenshot rate limiting for auto-error capture
let lastScreenshotTime = 0
const SCREENSHOT_COOLDOWN_MS = 60_000 // 1 screenshot per minute max

function resetMinuteCounter() {
  reportsThisMinute = 0
  minuteResetTimer = null
}

function addToBuffer(err: CapturedError) {
  recentErrors.push(err)
  if (recentErrors.length > MAX_BUFFER) {
    recentErrors.shift()
  }
}

/** Capture screenshot for error context (rate-limited) */
async function captureErrorScreenshot(): Promise<string | null> {
  const now = Date.now()
  if (now - lastScreenshotTime < SCREENSHOT_COOLDOWN_MS) return null
  lastScreenshotTime = now

  try {
    const html2canvas = (await import('html2canvas')).default
    const canvas = await html2canvas(document.body, {
      scale: 0.4, // lower resolution for auto-captures
      logging: false,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#F8F9FB',
    })
    return canvas.toDataURL('image/png', 0.5) // lower quality for auto-captures
  } catch {
    return null
  }
}

async function reportError(message: string, stack?: string) {
  if (reportsThisMinute >= MAX_REPORTS_PER_MINUTE) return

  reportsThisMinute++
  if (!minuteResetTimer) {
    minuteResetTimer = setTimeout(resetMinuteCounter, 60_000)
  }

  // Capture screenshot in parallel with the report
  const screenshotPromise = captureErrorScreenshot()

  try {
    const screenshot = await screenshotPromise
    await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'error',
        message: message.slice(0, 2000),
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        screenshot: screenshot ?? undefined,
        metadata: {
          stack: stack?.slice(0, 3000),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          timestamp: new Date().toISOString(),
          auto: true,
          viewport: typeof window !== 'undefined' ? {
            width: window.innerWidth,
            height: window.innerHeight,
          } : undefined,
        },
      }),
    })
  } catch {
    // Silently fail — we don't want error reporting to cause more errors
  }
}

/**
 * Initialize global error listeners. Call once from a top-level useEffect.
 * Returns a cleanup function to remove listeners.
 */
export function initErrorCapture(): () => void {
  if (typeof window === 'undefined') return () => {}

  const handleError = (event: ErrorEvent) => {
    const captured: CapturedError = {
      message: event.message || 'Unknown error',
      stack: event.error?.stack,
      timestamp: Date.now(),
    }
    addToBuffer(captured)
    reportError(captured.message, captured.stack)
  }

  const handleRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason
    const message = reason?.message || String(reason) || 'Unhandled promise rejection'
    const stack = reason?.stack
    const captured: CapturedError = { message, stack, timestamp: Date.now() }
    addToBuffer(captured)
    reportError(message, stack)
  }

  window.addEventListener('error', handleError)
  window.addEventListener('unhandledrejection', handleRejection)

  return () => {
    window.removeEventListener('error', handleError)
    window.removeEventListener('unhandledrejection', handleRejection)
  }
}

/** Get a summary of recent errors for attaching to manual feedback */
export function getRecentErrorSummary(): string | undefined {
  if (recentErrors.length === 0) return undefined
  const recent = recentErrors.slice(-5)
  return recent
    .map(e => `[${new Date(e.timestamp).toISOString()}] ${e.message}`)
    .join('\n')
}
