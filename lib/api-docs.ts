/**
 * API Documentation Generator
 * - OpenAPI/Swagger specification
 * - Auto-generated from route annotations
 * - Interactive API playground
 */

import swaggerJsdoc from 'swagger-jsdoc'

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'ResumeAI API',
    version: '1.0.0',
    description: 'Complete API documentation for the ResumeAI platform',
    contact: {
      name: 'API Support',
      email: 'support@example.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Development server',
    },
    {
      url: 'https://api.example.com',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'Authorization',
        description: 'API key authentication (Bearer token)',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Team: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          ownerId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ApiKey: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          key: { type: 'string' },
          lastUsed: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
        },
      },
      Notification: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          type: { type: 'string', enum: ['info', 'success', 'warning', 'error'] },
          read: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      SupportTicket: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          subject: { type: 'string' },
          description: { type: 'string' },
          status: {
            type: 'string',
            enum: ['open', 'in_progress', 'waiting', 'resolved', 'closed'],
          },
          priority: { type: 'string', enum: ['low', 'medium', 'high', 'urgent'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Feedback: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: ['feature', 'bug', 'improvement', 'question', 'other'],
          },
          title: { type: 'string' },
          description: { type: 'string' },
          votes: { type: 'integer' },
          status: {
            type: 'string',
            enum: ['under_review', 'planned', 'in_progress', 'completed', 'declined'],
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Invoice: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          invoiceNumber: { type: 'string' },
          amount: { type: 'integer' },
          currency: { type: 'string' },
          status: { type: 'string' },
          paidAt: { type: 'string', format: 'date-time' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          message: { type: 'string' },
          statusCode: { type: 'integer' },
        },
      },
    },
    responses: {
      UnauthorizedError: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      ForbiddenError: {
        description: 'Insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      NotFoundError: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
      ValidationError: {
        description: 'Invalid input data',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/Error' },
          },
        },
      },
    },
  },
  tags: [
    {
      name: 'Authentication',
      description: 'User authentication and session management',
    },
    {
      name: 'Users',
      description: 'User management operations',
    },
    {
      name: 'Teams',
      description: 'Team and organization management',
    },
    {
      name: 'API Keys',
      description: 'API key generation and management',
    },
    {
      name: 'Notifications',
      description: 'In-app notification system',
    },
    {
      name: 'Support',
      description: 'Customer support tickets',
    },
    {
      name: 'Feedback',
      description: 'User feedback and feature requests',
    },
    {
      name: 'Invoices',
      description: 'Invoice and billing management',
    },
    {
      name: 'Analytics',
      description: 'Analytics and usage tracking',
    },
  ],
}

const options: swaggerJsdoc.Options = {
  definition: swaggerDefinition,
  apis: ['./app/api/**/*.ts'], // Path to API routes
}

/**
 * Generate OpenAPI specification
 */
export function generateOpenApiSpec() {
  return swaggerJsdoc(options)
}

/**
 * Example API route documentation
 *
 * Add these JSDoc comments to your API routes:
 *
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user
 *     tags: [Users]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *
 * @swagger
 * /api/teams:
 *   post:
 *     summary: Create a new team
 *     tags: [Teams]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Team created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Team'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */

/**
 * API endpoint examples for documentation
 */
export const apiExamples = {
  // Authentication
  login: {
    curl: `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL}/api/auth/signin \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "password": "password"}'`,
    javascript: `fetch('${process.env.NEXT_PUBLIC_APP_URL}/api/auth/signin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com', password: 'password' })
})`,
  },

  // API Key usage
  apiKey: {
    curl: `curl -X GET ${process.env.NEXT_PUBLIC_APP_URL}/api/users/me \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    javascript: `fetch('${process.env.NEXT_PUBLIC_APP_URL}/api/users/me', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
})`,
  },

  // Create team
  createTeam: {
    curl: `curl -X POST ${process.env.NEXT_PUBLIC_APP_URL}/api/teams \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Team"}'`,
    javascript: `fetch('${process.env.NEXT_PUBLIC_APP_URL}/api/teams', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ name: 'My Team' })
})`,
  },

  // Get notifications
  getNotifications: {
    curl: `curl -X GET ${process.env.NEXT_PUBLIC_APP_URL}/api/notifications \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    javascript: `fetch('${process.env.NEXT_PUBLIC_APP_URL}/api/notifications', {
  headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
})`,
  },
}

/**
 * Rate limiting documentation
 */
export const rateLimitDocs = {
  default: {
    limit: 100,
    window: '15 minutes',
    description: 'Default rate limit for authenticated requests',
  },
  strict: {
    limit: 20,
    window: '15 minutes',
    description: 'Strict rate limit for sensitive operations',
  },
  public: {
    limit: 50,
    window: '15 minutes',
    description: 'Rate limit for public/unauthenticated endpoints',
  },
}

/**
 * Webhook documentation
 */
export const webhookDocs = {
  events: [
    'user.created',
    'user.updated',
    'subscription.created',
    'subscription.updated',
    'subscription.cancelled',
    'payment.succeeded',
    'payment.failed',
    'team.created',
    'team.member.added',
    'team.member.removed',
  ],
  format: {
    id: 'evt_...',
    type: 'user.created',
    data: {
      object: {
        /* resource data */
      },
    },
    created: 1234567890,
  },
}
