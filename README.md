# @harshil1712/tanstack-cf-ai-adapter

Cloudflare AI Gateway adapter for [TanStack AI](https://tanstack.com/ai). Route your AI requests through [Cloudflare's AI Gateway](https://developers.cloudflare.com/ai-gateway/) to get caching, rate limiting, cost controls, and observability out of the box.

> ⚠️ **Proof of Concept**: This package is a POC demonstrating AI Gateway integration with TanStack AI. Standard authentication with API keys works great, but advanced features (BYOK, Unified Billing, cache control, custom metadata) are not yet implemented. See [Limitations](#limitations--notes) for details.

## Features

**Working today:**
- 🚀 **Works with Cloudflare Workers Bindings** - Uses `env.AI.gateway()` for optimal performance
- 🔄 **Simple API** - One function to wrap any TanStack AI adapter
- 📊 **Built-in analytics** - Track usage, costs, and performance in Cloudflare dashboard
- 🔍 **Automatic request logging** - Debug and monitor all AI requests

**Planned (not yet implemented):**
- 💾 **Request caching** - Cache identical requests to save costs
- 🛡️ **Rate limiting** - Protect against abuse and control costs
- 💰 **BYOK & Unified Billing** - Alternative authentication modes

## Installation

```bash
npm install @harshil1712/tanstack-cf-ai-adapter @tanstack/ai
```

You'll also need the adapter for your AI provider:

```bash
npm install @tanstack/ai-anthropic  # For Claude
# or
npm install @tanstack/ai-openai     # For GPT models
```

## Setup

### 1. Configure AI Gateway in Cloudflare Dashboard

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com/) → AI Gateway
2. Create a new gateway and note the gateway name

### 2. Configure wrangler.toml

Add the Workers AI binding to your `wrangler.toml`:

```toml
name = "my-ai-worker"
main = "src/index.ts"
compatibility_date = "2024-12-05"

[ai]
binding = "AI"
```

### 3. Add binding types (TypeScript)

Create or update `worker-configuration.d.ts`:

```typescript
interface Env {
  AI: import('@harshil1712/tanstack-cf-ai-adapter').AIBinding
  ANTHROPIC_API_KEY: string
}
```

## Usage

### Basic Example

```typescript
import { AI } from '@tanstack/ai'
import { anthropic } from '@tanstack/ai-anthropic'
import { withAiGateway } from '@harshil1712/tanstack-cf-ai-adapter'

export default {
  async fetch(request: Request, env: Env) {
    // Create gateway wrapper
    const gateway = withAiGateway(env.AI, "my-gateway")

    // Wrap adapters
    const ai = new AI({
      adapters: {
        anthropic: await gateway(anthropic, {
          apiKey: env.ANTHROPIC_API_KEY
        })
      }
    })

    // Use normally - all requests go through the gateway!
    const stream = await ai.chatStream({
      adapter: 'anthropic',
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: 'Hello!' }]
    })

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream' }
    })
  }
}
```

### Multiple Providers

```typescript
import { anthropic } from '@tanstack/ai-anthropic'
import { openai } from '@tanstack/ai-openai'
import { withAiGateway } from '@harshil1712/tanstack-cf-ai-adapter'

const gateway = withAiGateway(env.AI, "my-gateway")

const ai = new AI({
  adapters: {
    anthropic: await gateway(anthropic, {
      apiKey: env.ANTHROPIC_API_KEY
    }),
    openai: await gateway(openai, {
      apiKey: env.OPENAI_API_KEY
    })
  }
})

// Use either provider - both go through the gateway
```

## Authentication Modes

### 1. Standard Authentication (Default)

Pass provider API keys directly:

```typescript
const adapter = await gateway(anthropic, {
  apiKey: env.ANTHROPIC_API_KEY
})
```

### 2. BYOK (Bring Your Own Keys)

Store keys in Cloudflare dashboard, reference them by name:

```typescript
// First, store your key in dashboard:
// AI Gateway → your-gateway → Provider Keys → Add API Key

const adapter = await gateway(anthropic, {
  storedKey: "ANTHROPIC_KEY_1",  // Reference to stored key
  cfToken: env.CF_API_TOKEN       // Cloudflare API token
})
```

**Benefits:**
- Secure storage with Secrets Store
- Easy key rotation
- No keys in code or environment variables

### 3. Unified Billing

Use Cloudflare's unified billing - no provider API keys needed:

```typescript
const adapter = await gateway(anthropic, {
  unifiedBilling: true,
  cfToken: env.CF_API_TOKEN
})
```

**Benefits:**
- Single bill from Cloudflare
- Consolidated costs across all providers
- Spend limits and auto top-up

## Advanced Features

### Gateway Features Configuration

```typescript
const adapter = await gateway(anthropic, {
  auth: {
    apiKey: env.ANTHROPIC_API_KEY
  },
  cache: {
    ttl: 3600,      // Cache for 1 hour
    skipCache: false
  },
  metadata: {
    environment: 'production',
    team: 'backend'
  },
  logging: {
    skipLogging: false
  }
})
```

### Getting Gateway URL Directly

For advanced use cases, get the gateway URL:

```typescript
import { getGatewayUrl } from '@harshil1712/tanstack-cf-ai-adapter'

const url = await getGatewayUrl(env.AI, "my-gateway", "openai")
// url: https://gateway.ai.cloudflare.com/v1/{account}/{gateway}/openai

// Use with custom SDK configuration
const client = new OpenAI({
  apiKey: env.OPENAI_API_KEY,
  baseURL: url
})
```

## Supported Providers

All providers supported by both TanStack AI and Cloudflare AI Gateway:

- ✅ Anthropic (Claude)
- ✅ OpenAI (GPT models)
- ✅ Google AI Studio (Gemini)
- ✅ Groq
- ✅ Cohere
- ✅ Mistral AI
- ✅ Perplexity
- ✅ DeepSeek
- ✅ xAI (Grok)
- ✅ Workers AI

## How It Works

1. **`withAiGateway(env.AI, "gateway-name")`** creates a gateway wrapper
2. **Wrapper calls `env.AI.gateway().getUrl(provider)`** to get the gateway URL
3. **Gateway URL is injected** into the adapter's `baseURL` config
4. **Adapter routes requests** through the gateway transparently
5. **Gateway features** (caching, analytics, etc.) applied automatically

```
Your App → TanStack AI Adapter → AI Gateway → AI Provider
                                      ↓
                                  Analytics
                                  Caching
                                  Rate Limits
```

## Configuration Reference

### `withAiGateway(binding, gatewayName)`

Creates a gateway wrapper function.

**Parameters:**
- `binding: AIBinding` - The `env.AI` binding from wrangler.toml
- `gatewayName: string` - Your gateway name from Cloudflare dashboard

**Returns:** `(adapter, config) => Promise<Adapter>`

### Gateway Wrapper Function

**Parameters:**
- `adapter: AdapterFactory` - TanStack AI adapter factory (e.g., `anthropic`, `openai`)
- `config: AuthConfig | GatewayAdapterConfig` - Authentication and features config

**AuthConfig types:**
```typescript
// Standard
{ apiKey: string }

// BYOK
{ storedKey: string, cfToken: string }

// Unified Billing
{ unifiedBilling: true, cfToken: string }
```

**GatewayAdapterConfig:**
```typescript
{
  auth: AuthConfig
  cache?: { ttl?: number, skipCache?: boolean }
  metadata?: Record<string, string>
  logging?: { skipLogging?: boolean }
  providerConfig?: Record<string, any>  // Provider-specific options
}
```

## Limitations & Notes

### Current Limitations

This is a **proof-of-concept** package. The following features have limitations:

1. **Standard Authentication (API Keys)** ✅
   - **WORKS**: Passing provider API keys directly works perfectly
   - Use this mode for production until other modes are fully implemented

2. **BYOK (Bring Your Own Keys)** ⚠️
   - **INCOMPLETE**: Accepted but not fully functional
   - Missing: Custom fetch handler to add `cf-aig-authorization` header
   - The stored key reference needs to be passed in headers, not as the API key
   - **Do not use in production yet**

3. **Unified Billing** ⚠️
   - **INCOMPLETE**: Accepted but not fully functional
   - Missing: Custom fetch handler to add `cf-aig-authorization` header
   - May require `/compat` endpoint or provider-specific handling
   - **Do not use in production yet**

4. **Gateway Features (Caching, Metadata, Logging)** ⚠️
   - **INCOMPLETE**: Accepted in config but silently ignored
   - These features require per-request HTTP headers:
     - `cf-aig-cache-ttl`: Cache TTL in seconds
     - `cf-aig-skip-cache`: Skip cache boolean
     - `cf-aig-metadata`: JSON metadata
     - `cf-aig-skip-logging`: Skip logging boolean
   - Requires custom fetch handler or adapter wrapping
   - **Features are not active yet**

5. **Provider baseURL Support** ⚠️
   - **Depends on adapter implementation**
   - Works with adapters that accept `baseURL` config parameter
   - OpenAI adapter: ✅ Has `baseURL` support
   - Anthropic adapter: 🔄 Needs testing
   - Other adapters: 🔄 Depends on implementation

### What Works Today

✅ **Fully functional:**
- Standard authentication with provider API keys
- Automatic provider detection
- Gateway URL injection via `baseURL`
- Request routing through AI Gateway
- Basic analytics and logging (automatically enabled by gateway)

### What Needs Work

🚧 **Requires implementation:**
- BYOK authentication (needs custom fetch + headers)
- Unified Billing (needs custom fetch + headers)
- Cache control (needs per-request headers)
- Custom metadata (needs per-request headers)
- Logging controls (needs per-request headers)

### Recommended Usage

**For production today:**
```typescript
// ✅ Use standard auth - fully tested and working
const adapter = await gateway(anthropic, {
  apiKey: env.ANTHROPIC_API_KEY
})
```

**Avoid for now:**
```typescript
// ⚠️ These modes are incomplete
const adapter = await gateway(anthropic, {
  storedKey: "ANTHROPIC_KEY_1",  // BYOK - not working yet
  cfToken: env.CF_API_TOKEN
})

const adapter = await gateway(anthropic, {
  unifiedBilling: true,  // Unified Billing - not working yet
  cfToken: env.CF_API_TOKEN
})

const adapter = await gateway(anthropic, {
  apiKey: env.KEY,
  cache: { ttl: 3600 },  // Cache - not working yet
  metadata: { env: "prod" }  // Metadata - not working yet
})
```

## Testing

### Quick Start

The `example/` directory contains a full-stack Hono + React + Vite application demonstrating the adapter.

```bash
cd example
npm install
npm run dev
```

See [example/README.md](./example/README.md) for detailed setup instructions.

### What's in the Example

- **Hono Worker** with streaming AI responses using `streamText()`
- **React Frontend** with Vite
- **API endpoints** for Anthropic and OpenAI
- **Full TypeScript** support with generated types
- **Production-ready** deployment configuration

## Examples

- See [`example/`](./example/) for a complete full-stack application
- See [`example.ts`](./example.ts) for standalone code examples

## Development

### Build

```bash
npm run build
```

### Testing

```bash
npm run dev    # Watch mode
```

## Resources

- [TanStack AI Documentation](https://tanstack.com/ai)
- [Cloudflare AI Gateway Docs](https://developers.cloudflare.com/ai-gateway/)
- [AI Gateway Binding Methods](https://developers.cloudflare.com/ai-gateway/integrations/worker-binding-methods/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)

## Contributing

This is an experimental/POC package. Feedback, issues, and PRs are welcome!

## License

MIT
