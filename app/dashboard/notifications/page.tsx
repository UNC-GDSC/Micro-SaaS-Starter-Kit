'use client'

/**
 * /dashboard/notifications
 *
 * Telegram connection + per-type toggle settings.
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, MessageCircle, Bell, BellOff, CheckCircle, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface ChatStatus {
  connected: boolean
  chat: {
    username?: string
    connectedAt: string
    notifyOnSubmit: boolean
    notifyOnInterviewReply: boolean
    notifyOnLinkedInIssue: boolean
  } | null
}

interface Toggle {
  key: 'notifyOnSubmit' | 'notifyOnInterviewReply' | 'notifyOnLinkedInIssue'
  label: string
  description: string
  icon: string
}

const TOGGLES: Toggle[] = [
  {
    key: 'notifyOnSubmit',
    label: 'Application submitted',
    description: '✉️ Ping when a job application is sent',
    icon: '✉️',
  },
  {
    key: 'notifyOnInterviewReply',
    label: 'Recruiter reply',
    description: '📬 Ping when a recruiter replies to your inbox',
    icon: '📬',
  },
  {
    key: 'notifyOnLinkedInIssue',
    label: 'LinkedIn auth issue',
    description: '⚠️ Ping when LinkedIn needs re-authentication',
    icon: '⚠️',
  },
]

export default function NotificationsPage() {
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [deepLink, setDeepLink] = useState<string | null>(null)
  const [error, setError] = useState('')

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications/telegram/connect')
      if (res.ok) setStatus(await res.json())
    } catch {
      // non-fatal
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  async function handleConnect() {
    setConnecting(true)
    setError('')
    setDeepLink(null)
    try {
      const res = await fetch('/api/notifications/telegram/connect', { method: 'POST' })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      const { deepLink: link } = await res.json()
      setDeepLink(link)
    } catch (err: any) {
      setError(err.message ?? 'Failed to generate link')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    await fetch('/api/notifications/telegram/connect', { method: 'DELETE' })
    setDeepLink(null)
    fetchStatus()
  }

  async function handleToggle(key: Toggle['key'], value: boolean) {
    // Optimistic update
    setStatus((prev) =>
      prev?.chat ? { ...prev, chat: { ...prev.chat, [key]: value } } : prev,
    )
    await fetch('/api/notifications/telegram/connect', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Get Telegram pings for job application events.
        </p>
      </div>

      {/* Connection card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-blue-500" />
            Telegram
          </CardTitle>
          <CardDescription>
            Connect once — receive notifications directly in Telegram.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status?.connected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>
                  Connected
                  {status.chat?.username ? ` as @${status.chat.username}` : ''}
                  {status.chat?.connectedAt
                    ? ` since ${new Date(status.chat.connectedAt).toLocaleDateString()}`
                    : ''}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleDisconnect}
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {deepLink ? (
                <div className="space-y-3">
                  <p className="text-sm text-slate-600">
                    Click the button below to open Telegram and activate notifications.
                    This link expires in 5 minutes.
                  </p>
                  <Button asChild>
                    <a href={deepLink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in Telegram
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={fetchStatus}
                  >
                    Check connection
                  </Button>
                </div>
              ) : (
                <>
                  {error && (
                    <p className="text-sm text-red-600">{error}</p>
                  )}
                  <Button disabled={connecting} onClick={handleConnect}>
                    {connecting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating link…</>
                    ) : (
                      'Connect Telegram'
                    )}
                  </Button>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Toggles — only shown when connected */}
      {status?.connected && status.chat && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-slate-500" />
              Notification types
            </CardTitle>
            <CardDescription>
              Choose which events trigger a Telegram message.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="space-y-0.5">
                  <Label htmlFor={t.key} className="text-sm font-medium cursor-pointer">
                    {t.label}
                  </Label>
                  <p className="text-xs text-slate-500">{t.description}</p>
                </div>
                <Switch
                  id={t.key}
                  checked={status.chat![t.key]}
                  onCheckedChange={(v: boolean) => handleToggle(t.key, v)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Help when disconnected */}
      {!status?.connected && !deepLink && (
        <p className="text-xs text-slate-400 text-center">
          You&apos;ll be connected in under 30 seconds once you tap the link in Telegram.
        </p>
      )}
    </div>
  )
}
