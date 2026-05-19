'use client'

/**
 * /extension/connect
 *
 * OAuth-style connection page for the ResumeAI Chrome extension.
 *
 * Flow:
 *   1. Extension opens this page in a new tab.
 *   2. If the user is not signed in, they are redirected to /login.
 *   3. User clicks "Connect extension" → a new extension-scoped API key is
 *      generated via POST /api/keys.
 *   4. The raw key is shown (copy-once UX) and posted to window via
 *      postMessage so the content-bridge script can forward it to the extension.
 *   5. After 3 s the tab is closed automatically; user can also close it.
 */
import { useEffect, useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { CheckCircle, Loader2, AlertCircle, Plug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type Step = 'loading' | 'unauthenticated' | 'idle' | 'generating' | 'done' | 'error'

export default function ExtensionConnectPage() {
  const { data: session, status } = useSession()
  const [step, setStep] = useState<Step>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [countdown, setCountdown] = useState(5)

  // Resolve initial step once session is known
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      setStep('unauthenticated')
    } else {
      setStep('idle')
    }
  }, [status])

  // Countdown + auto-close after key is delivered
  useEffect(() => {
    if (step !== 'done') return
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval)
          window.close()
          return 0
        }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  async function handleConnect() {
    setStep('generating')
    setErrorMsg('')
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Chrome Extension',
          scope: 'extension',
        }),
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const { key } = await res.json()

      // Broadcast key to the extension's content-bridge script
      window.postMessage({ type: 'RESUMEAI_API_KEY', key }, '*')

      setStep('done')
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong')
      setStep('error')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (step === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <Plug className="h-6 w-6 text-blue-600" />
            </div>
            <CardTitle>Sign in to connect</CardTitle>
            <CardDescription>
              Sign in to your ResumeAI account to link the Chrome extension.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full"
              onClick={() => signIn(undefined, { callbackUrl: '/extension/connect' })}
            >
              Sign in to ResumeAI
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <CardTitle>Extension connected!</CardTitle>
            <CardDescription>
              The ResumeAI extension is now linked to{' '}
              <strong>{session?.user?.email}</strong>.
              This tab will close in {countdown}s.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => window.close()}>
              Close tab now
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="w-full max-w-md shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Connection failed</CardTitle>
            <CardDescription className="text-red-600">{errorMsg}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={handleConnect}>
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // step === 'idle' | 'generating'
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            <Plug className="h-6 w-6 text-blue-600" />
          </div>
          <CardTitle>Connect Chrome Extension</CardTitle>
          <CardDescription>
            Signed in as <strong>{session?.user?.email}</strong>
            <br />
            Click below to authorise the ResumeAI extension to autofill job applications on your behalf.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            className="w-full"
            disabled={step === 'generating'}
            onClick={handleConnect}
          >
            {step === 'generating' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting…
              </>
            ) : (
              'Connect extension'
            )}
          </Button>
          <p className="text-center text-xs text-slate-500">
            This generates a secure API key for the extension.
            You can revoke it any time from{' '}
            <a href="/dashboard/api-keys" className="underline">
              Dashboard → API Keys
            </a>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
