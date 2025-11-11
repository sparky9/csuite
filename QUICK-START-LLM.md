# Quick Start: Fireworks LLM Integration

## Setup (5 minutes)

### 1. Get Fireworks API Key

1. Sign up at [fireworks.ai](https://fireworks.ai)
2. Create an API key from dashboard
3. Copy the key

### 2. Configure Environment

Add to `.env`:

```bash
FIREWORKS_API_KEY=your-key-here
```

Optional overrides:
```bash
FIREWORKS_MODEL=accounts/fireworks/models/qwen2p5-72b-instruct
FIREWORKS_MAX_TOKENS=2048
FIREWORKS_TEMPERATURE=0.7
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Test It

```bash
# Run tests
npm test tests/unit/llm

# Start dev server
npm run dev
```

## Usage Examples

### Basic Chat Request

```bash
curl -X POST http://localhost:3001/c-suite/ceo/chat \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What should I focus on this quarter?",
    "personaType": "ceo"
  }'
```

### With Conversation History

```bash
curl -X POST http://localhost:3001/c-suite/ceo/chat \
  -H "Authorization: Bearer YOUR_CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Can you elaborate on that?",
    "conversationId": "existing-conversation-id",
    "personaType": "ceo"
  }'
```

### Different Personas

```bash
# CEO - Strategic guidance
"personaType": "ceo"

# CFO - Financial advice
"personaType": "cfo"

# CMO - Marketing strategy
"personaType": "cmo"

# CTO - Technical direction
"personaType": "cto"
```

## Response Format (SSE)

```
event: start
data: {"conversationId":"uuid","personaType":"ceo"}

event: chunk
data: {"content":"Based on ","conversationId":"uuid"}

event: chunk
data: {"content":"your metrics","conversationId":"uuid"}

event: done
data: {"conversationId":"uuid"}
```

## Programmatic Usage

### Stream Completion

```typescript
import { streamCompletion } from './services/llm/fireworks-client';

for await (const chunk of streamCompletion({
  messages: [
    { role: 'system', content: 'You are a CEO advisor' },
    { role: 'user', content: 'Help me grow my business' }
  ],
  tenantId: 'tenant-123',
  userId: 'user-456',
})) {
  if (chunk.done) break;
  process.stdout.write(chunk.content);
}
```

### Build Persona Prompt

```typescript
import { buildPersonaPrompt } from './services/llm/prompt-builder';

const messages = await buildPersonaPrompt(
  'What should I focus on?',
  {
    tenantId: 'tenant-123',
    userId: 'user-456',
    businessProfile: {
      industry: 'SaaS',
      size: 'small',
      stage: 'growth',
    },
    recentAnalytics: {
      sessions: 1500,
      users: 450,
      conversions: 23,
      revenue: 12500,
    },
  },
  'ceo'
);
```

## Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| Chat | 10 requests | 1 minute |
| General API | 100 requests | 15 minutes |
| Bulk Operations | 5 requests | 1 hour |

**Rate limit exceeded response:**
```json
{
  "error": "Too Many Requests",
  "message": "Please wait before sending another message",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

## Common Issues

### "Fireworks API error: 401"
- Check your API key is correct
- Ensure `FIREWORKS_API_KEY` is set in `.env`
- Verify key hasn't expired

### "No response body"
- Network issue or API timeout
- Check Fireworks API status
- Verify Redis is running

### Rate limit hit
- Wait for the retry period
- Increase limits in `rate-limit.ts` if needed
- Implement request queuing

### Slow responses
- Check Fireworks API latency
- Optimize context size
- Consider response caching

## Monitoring

### Check Token Usage

```sql
-- Total tokens last 30 days
SELECT
  tenant_id,
  SUM((metadata->>'tokens')::jsonb->>'total') as total_tokens
FROM messages
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY tenant_id;
```

### Check Error Rate

```bash
# View logs
tail -f logs/app.log | grep ERROR

# Count errors
grep "ERROR" logs/app.log | wc -l
```

### Monitor Rate Limits

```bash
# Check Redis rate limit keys
redis-cli KEYS "rate_limit:*"

# See specific tenant limits
redis-cli GET "rate_limit:chat:tenant-123"
```

## Cost Estimation

```typescript
// Approximate costs (adjust based on Fireworks pricing)
const COST_PER_1K_TOKENS = 0.002;

function estimateCost(tokens: number): number {
  return (tokens / 1000) * COST_PER_1K_TOKENS;
}

// Example: 2000 tokens = $0.004
```

## Testing

### Run All Tests
```bash
npm test
```

### Run LLM Tests Only
```bash
npm test tests/unit/llm
```

### Watch Mode
```bash
npm run test:watch tests/unit/llm
```

### Coverage
```bash
npm run test:coverage
```

## Development Tips

1. **Use Mock in Development**
   - Set `FIREWORKS_API_KEY=mock` to use mock responses
   - Saves API costs during development

2. **Monitor Token Usage**
   - Keep prompts under 4k tokens
   - Check token counts in logs

3. **Optimize Context**
   - Only include relevant business data
   - Limit conversation history

4. **Handle Errors Gracefully**
   - Always catch streaming errors
   - Provide fallback responses

5. **Test Rate Limits**
   - Test limit behavior in staging
   - Verify error messages

## Need Help?

- 📖 Full docs: `apps/api/src/services/llm/README.md`
- 📋 Implementation details: `FIREWORKS-LLM-IMPLEMENTATION.md`
- 🧪 Test examples: `tests/unit/llm/*.test.ts`
- 🔧 Config schema: `apps/api/src/config/index.ts`

## Next Steps

1. ✅ Set up environment variables
2. ✅ Test with your API key
3. ✅ Try different personas
4. ✅ Monitor token usage
5. ✅ Set up cost alerts
6. 🚀 Deploy to production

## Quick Commands

```bash
# Development
npm run dev              # Start API server
npm run dev:workers      # Start workers

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode

# Production
npm run build            # Build for production
npm start                # Start production server

# Type checking
npm run typecheck        # Check TypeScript types
```

That's it! You're ready to use the Fireworks LLM integration. 🎉
