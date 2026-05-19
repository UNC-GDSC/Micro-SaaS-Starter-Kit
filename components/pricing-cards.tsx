'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Check } from 'lucide-react'
import { PRICING_PLANS } from '@/lib/pricing'

export function PricingCards() {
  const { data: session } = useSession()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Send plan ID (slug) to server — the server resolves the Stripe price ID.
  // Never send price IDs from the client: process.env.STRIPE_PRICE_ID_* is not
  // a NEXT_PUBLIC_ var so it's always undefined in client bundles.
  const handleSubscribe = async (planId: string) => {
    if (!session) {
      router.push('/login?callbackUrl=/pricing')
      return
    }

    setIsLoading(planId)
    setErrorMsg(null)

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      })

      if (!response.ok) {
        const text = await response.text()
        setErrorMsg(text || 'Something went wrong. Please try again.')
        return
      }

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setErrorMsg('No checkout URL returned. Please try again.')
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.')
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <>
      {errorMsg && (
        <div className="mx-auto mb-6 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {errorMsg}
        </div>
      )}
      <div className="grid gap-8 md:grid-cols-3">
        {PRICING_PLANS.map((plan) => {
          const isPro = plan.id === 'pro'
          const isFree = plan.id === 'free'
          return (
            <Card key={plan.id} className={isPro ? 'border-primary shadow-lg' : ''}>
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold">${plan.price}</span>
                  {plan.price > 0 && <span className="text-muted-foreground">/month</span>}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start">
                      <Check className="mr-2 h-5 w-5 shrink-0 text-primary" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={isPro ? 'default' : 'outline'}
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isLoading === plan.id || isFree}
                >
                  {isLoading === plan.id
                    ? 'Loading...'
                    : isFree
                    ? 'Current Plan'
                    : 'Get Started'}
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </>
  )
}
