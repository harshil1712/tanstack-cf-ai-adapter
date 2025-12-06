/**
 * Example usage of @harshil1712/tanstack-cf-ai-adapter
 *
 * This file shows how to use the Cloudflare AI Gateway adapter
 * with TanStack AI in a Cloudflare Worker using the withAiGateway function.
 */

import { AI } from '@tanstack/ai'
import { anthropic } from '@tanstack/ai-anthropic'
import { openai } from '@tanstack/ai-openai'
import { withAiGateway } from './src'

// Define your Worker environment with the AI binding
interface Env {
  AI: any // The [ai] binding from wrangler.toml
  ANTHROPIC_API_KEY: string
  OPENAI_API_KEY: string
  CF_API_TOKEN?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Example 1: Basic usage with standard authentication
    return handleBasicExample(request, env)

    // Example 2: Multiple providers
    // return handleMultipleProviders(request, env)

    // Example 3: BYOK (Stored Keys)
    // return handleBYOKExample(request, env)

    // Example 4: Unified Billing
    // return handleUnifiedBillingExample(request, env)

    // Example 5: Advanced features (caching, metadata)
    // return handleAdvancedFeatures(request, env)
  },
}

/**
 * Example 1: Basic usage with standard authentication
 */
async function handleBasicExample(
  request: Request,
  env: Env,
): Promise<Response> {
  // Create gateway wrapper
  const gateway = withAiGateway(env.AI, 'my-gateway')

  // Wrap the Anthropic adapter
  const ai = new AI({
    adapters: {
      anthropic: await gateway(anthropic, {
        apiKey: env.ANTHROPIC_API_KEY,
      }),
    },
  })

  // Use normally - all requests go through the gateway!
  try {
    const stream = await ai.chatStream({
      adapter: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      messages: [
        {
          role: 'user',
          content: 'Write a haiku about Cloudflare Workers',
        },
      ],
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to process request' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * Example 2: Using multiple providers
 */
async function handleMultipleProviders(
  request: Request,
  env: Env,
): Promise<Response> {
  const gateway = withAiGateway(env.AI, 'my-gateway')

  const ai = new AI({
    adapters: {
      anthropic: await gateway(anthropic, {
        apiKey: env.ANTHROPIC_API_KEY,
      }),
      openai: await gateway(openai, {
        apiKey: env.OPENAI_API_KEY,
      }),
    },
  })

  // Use either provider - both go through the gateway
  const url = new URL(request.url)
  const provider = url.searchParams.get('provider') || 'anthropic'

  const stream = await ai.chatStream({
    adapter: provider as 'anthropic' | 'openai',
    model:
      provider === 'openai' ? 'gpt-4' : 'claude-3-5-sonnet-20241022',
    messages: [
      { role: 'user', content: 'Hello! Tell me about yourself.' },
    ],
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/**
 * Example 3: BYOK (Bring Your Own Keys)
 * Keys are stored in Cloudflare dashboard
 */
async function handleBYOKExample(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.CF_API_TOKEN) {
    return new Response('CF_API_TOKEN not configured', { status: 500 })
  }

  const gateway = withAiGateway(env.AI, 'my-gateway')

  const ai = new AI({
    adapters: {
      anthropic: await gateway(anthropic, {
        storedKey: 'ANTHROPIC_KEY_1', // Reference to key in dashboard
        cfToken: env.CF_API_TOKEN,
      }),
    },
  })

  const stream = await ai.chatStream({
    adapter: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Hello!' }],
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/**
 * Example 4: Unified Billing
 * Use Cloudflare's billing - no provider API keys needed
 */
async function handleUnifiedBillingExample(
  request: Request,
  env: Env,
): Promise<Response> {
  if (!env.CF_API_TOKEN) {
    return new Response('CF_API_TOKEN not configured', { status: 500 })
  }

  const gateway = withAiGateway(env.AI, 'my-gateway')

  const ai = new AI({
    adapters: {
      anthropic: await gateway(anthropic, {
        unifiedBilling: true,
        cfToken: env.CF_API_TOKEN,
      }),
    },
  })

  const stream = await ai.chatStream({
    adapter: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Hello!' }],
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/**
 * Example 5: Advanced features - caching and metadata
 */
async function handleAdvancedFeatures(
  request: Request,
  env: Env,
): Promise<Response> {
  const gateway = withAiGateway(env.AI, 'my-gateway')

  const ai = new AI({
    adapters: {
      anthropic: await gateway(anthropic, {
        auth: {
          apiKey: env.ANTHROPIC_API_KEY,
        },
        cache: {
          ttl: 3600, // Cache responses for 1 hour
          skipCache: false,
        },
        metadata: {
          environment: 'production',
          worker: 'example-worker',
          version: '1.0.0',
        },
        logging: {
          skipLogging: false,
        },
      }),
    },
  })

  const stream = await ai.chatStream({
    adapter: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    messages: [{ role: 'user', content: 'Hello!' }],
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  })
}

/**
 * Example wrangler.toml configuration:
 *
 * name = "my-ai-worker"
 * main = "src/index.ts"
 * compatibility_date = "2024-12-05"
 *
 * [ai]
 * binding = "AI"
 *
 * # Add your API keys as secrets with:
 * # wrangler secret put ANTHROPIC_API_KEY
 * # wrangler secret put OPENAI_API_KEY
 * # wrangler secret put CF_API_TOKEN (for BYOK/Unified Billing)
 */
