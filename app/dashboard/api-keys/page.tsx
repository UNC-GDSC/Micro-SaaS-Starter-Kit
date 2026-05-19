'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Key, Copy, Trash2, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'

interface ApiKey {
  id: string
  name: string
  lastUsed: string | null
  createdAt: string
  expiresAt: string | null
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/keys')
      const data = await response.json()
      setApiKeys(data.apiKeys)
    } catch (error) {
      console.error('Error fetching API keys:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void fetchApiKeys()
  }, [])

  const createApiKey = async () => {
    setIsCreating(true)
    try {
      const response = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      })
      const data = await response.json()
      setNewKey(data.key)
      setApiKeys([data.apiKey, ...apiKeys])
      setNewKeyName('')
    } catch (error) {
      console.error('Error creating API key:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const deleteApiKey = async (id: string) => {
    try {
      await fetch(`/api/keys?id=${id}`, { method: 'DELETE' })
      setApiKeys(apiKeys.filter((key) => key.id !== id))
    } catch (error) {
      console.error('Error deleting API key:', error)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">API Keys</h1>
        <p className="text-gray-500">Manage your API keys for programmatic access</p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Create New API Key</CardTitle>
          <CardDescription>
            Generate a new API key to access the API programmatically
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                placeholder="My API Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      if (newKeyName) {
                        createApiKey()
                        setDialogOpen(true)
                      }
                    }}
                    disabled={!newKeyName || isCreating}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Key
                  </Button>
                </DialogTrigger>
                {newKey && (
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>API Key Created</DialogTitle>
                      <DialogDescription>
                        Make sure to copy your API key now. You won&apos;t be able to see it again!
                      </DialogDescription>
                    </DialogHeader>
                    <div className="my-4">
                      <div className="flex items-center gap-2 rounded-md border p-3 bg-muted font-mono text-sm">
                        <code className="flex-1 break-all">{newKey}</code>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(newKey)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => {
                          setNewKey(null)
                          setDialogOpen(false)
                        }}
                      >
                        Done
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                )}
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>Manage and revoke your existing API keys</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Loading...</p>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Key className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No API keys yet. Create one to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{key.name}</h3>
                      <Badge variant="outline">Active</Badge>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      Created {formatDate(key.createdAt)}
                      {key.lastUsed && ` • Last used ${formatDate(key.lastUsed)}`}
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteApiKey(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
