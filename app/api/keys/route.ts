import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateApiKey, getUserApiKeys, revokeApiKey } from '@/lib/api-keys'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const apiKeys = await getUserApiKeys(session.user.id)

    return NextResponse.json({ apiKeys })
  } catch (error: any) {
    console.error('Error fetching API keys:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { name, expiresAt, scope } = await req.json()

    if (!name) {
      return new NextResponse('Name is required', { status: 400 })
    }

    const { apiKey, rawKey } = await generateApiKey(
      session.user.id,
      name,
      expiresAt ? new Date(expiresAt) : undefined,
      scope ?? undefined,
    )

    return NextResponse.json({
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        scope: apiKey.scope,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      },
      key: rawKey, // Only returned once
    })
  } catch (error: any) {
    console.error('Error creating API key:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const keyId = searchParams.get('id')

    if (!keyId) {
      return new NextResponse('Key ID is required', { status: 400 })
    }

    await revokeApiKey(keyId, session.user.id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error revoking API key:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
