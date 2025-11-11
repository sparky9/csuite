# API Reference - Phase 2

Complete API documentation for all Phase 2 endpoints.

## Base URL

```
Local: http://localhost:3001
Production: https://api.yourdomain.com
```

## Authentication

All endpoints (except health checks) require authentication via Clerk.

### Headers

```http
Authorization: Bearer <clerk_session_token>
Content-Type: application/json
```

### Getting a Token

Tokens are automatically managed by Clerk SDK in the frontend. For testing:

```javascript
// In browser console (after login)
const token = await window.Clerk.session.getToken();
console.log(token);
```

Or use Clerk's publishable key to get test tokens.

## Error Responses

All endpoints use consistent error format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Chat | 10 requests | 1 minute |
| General API | 100 requests | 15 minutes |
| Strict Operations | 5 requests | 1 hour |

Rate limit headers:

```http
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 9
X-RateLimit-Reset: 1635724800
Retry-After: 60
```

---

## Health & Monitoring

### GET /health

Basic health check (no auth required).

**Response**

```json
{
  "status": "ok",
  "timestamp": "2025-11-01T10:30:00.000Z",
  "uptime": 3600
}
```

### GET /health/detailed

Detailed health check with dependency status (no auth required).

**Response**

```json
{
  "status": "healthy",
  "timestamp": "2025-11-01T10:30:00.000Z",
  "uptime": 3600,
  "checks": {
    "database": {
      "status": "healthy",
      "responseTime": 5
    },
    "redis": {
      "status": "healthy"
    },
    "queues": {
      "status": "healthy",
      "queues": {
        "sync-connector": {
          "active": 0,
          "waiting": 2,
          "completed": 150,
          "failed": 1
        },
        "execute-task": {
          "active": 1,
          "waiting": 0,
          "completed": 89,
          "failed": 0
        },
        "sync-analytics": {
          "active": 0,
          "waiting": 0,
          "completed": 45,
          "failed": 2
        },
        "growth-pulse": {
          "active": 0,
          "waiting": 0,
          "completed": 12,
          "failed": 0
        }
      }
    }
  }
}
```

**Status Codes**
- `200` - All systems healthy
- `503` - One or more systems degraded

### GET /health/queues

Queue-specific health check (no auth required).

**Response**

```json
{
  "status": "healthy",
  "queues": {
    "sync-connector": { /* counts */ },
    "execute-task": { /* counts */ },
    "sync-analytics": { /* counts */ },
    "growth-pulse": { /* counts */ }
  }
}
```

### GET /metrics

Application metrics (no auth required).

**Response**

```json
{
  "process": {
    "uptime": 3600,
    "memory": {
      "rss": 104857600,
      "heapTotal": 52428800,
      "heapUsed": 41943040,
      "external": 1048576
    },
    "cpu": {
      "user": 1500000,
      "system": 300000
    }
  },
  "requests": {
    "total": 1234,
    "active": 5
  }
}
```

---

## Chat & Conversations

### POST /c-suite/ceo/chat

Stream a chat message with the CEO persona using real LLM.

**Rate Limit**: 10 requests/minute

**Request**

```json
{
  "message": "What should I focus on this quarter?",
  "conversationId": "clp123abc" // optional
}
```

**Request Schema**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `message` | string | Yes | User message (max 5000 chars) |
| `conversationId` | string | No | Existing conversation ID |

**Response** (Server-Sent Events)

```
event: start
data: {"conversationId":"clp123abc","personaType":"ceo"}

event: chunk
data: {"content":"Based on ","conversationId":"clp123abc"}

event: chunk
data: {"content":"your recent ","conversationId":"clp123abc"}

event: chunk
data: {"content":"analytics, I recommend focusing on...","conversationId":"clp123abc"}

event: done
data: {"conversationId":"clp123abc"}
```

**Event Types**

| Event | Description | Data |
|-------|-------------|------|
| `start` | Stream started | `{conversationId, personaType}` |
| `chunk` | Text chunk | `{content, conversationId}` |
| `done` | Stream complete | `{conversationId}` |
| `error` | Error occurred | `{error, conversationId}` |

**Error Response**

```json
{
  "success": false,
  "error": {
    "code": "STREAM_ERROR",
    "message": "Failed to stream response"
  }
}
```

**Example (curl)**

```bash
curl -N -X POST http://localhost:3001/c-suite/ceo/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What are my key priorities?",
    "conversationId": "clp123abc"
  }'
```

**Example (JavaScript)**

```javascript
const eventSource = new EventSource(
  'http://localhost:3001/c-suite/ceo/chat',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    method: 'POST',
    body: JSON.stringify({
      message: 'What should I focus on?'
    })
  }
);

eventSource.addEventListener('chunk', (event) => {
  const data = JSON.parse(event.data);
  console.log(data.content);
});

eventSource.addEventListener('done', () => {
  eventSource.close();
});
```

### GET /c-suite/ceo/conversations

List all conversations for authenticated user.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 20 | Max conversations to return |
| `offset` | number | 0 | Pagination offset |

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "clp123abc",
      "tenantId": "tenant123",
      "userId": "user123",
      "personaType": "ceo",
      "title": "Q4 Strategy Discussion",
      "createdAt": "2025-11-01T10:00:00.000Z",
      "updatedAt": "2025-11-01T10:30:00.000Z",
      "_count": {
        "messages": 12
      }
    }
  ],
  "pagination": {
    "total": 5,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

### POST /c-suite/ceo/conversations

Create a new conversation.

**Request**

```json
{
  "title": "Revenue Growth Strategy",
  "personaType": "ceo" // optional, defaults to ceo
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "id": "clp789xyz",
    "tenantId": "tenant123",
    "userId": "user123",
    "personaType": "ceo",
    "title": "Revenue Growth Strategy",
    "createdAt": "2025-11-01T11:00:00.000Z",
    "updatedAt": "2025-11-01T11:00:00.000Z"
  }
}
```

### GET /c-suite/ceo/conversations/:conversationId

Get a specific conversation.

**Response**

```json
{
  "success": true,
  "data": {
    "id": "clp123abc",
    "tenantId": "tenant123",
    "userId": "user123",
    "personaType": "ceo",
    "title": "Q4 Strategy Discussion",
    "createdAt": "2025-11-01T10:00:00.000Z",
    "updatedAt": "2025-11-01T10:30:00.000Z",
    "_count": {
      "messages": 12
    }
  }
}
```

### GET /c-suite/ceo/conversations/:conversationId/messages

Get messages for a conversation.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Max messages to return |
| `offset` | number | 0 | Pagination offset |

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "msg123",
      "conversationId": "clp123abc",
      "role": "user",
      "content": "What should I focus on this quarter?",
      "metadata": null,
      "createdAt": "2025-11-01T10:00:00.000Z"
    },
    {
      "id": "msg124",
      "conversationId": "clp123abc",
      "role": "assistant",
      "content": "Based on your recent analytics...",
      "metadata": {
        "inputTokens": 150,
        "outputTokens": 300,
        "model": "qwen2p5-72b-instruct"
      },
      "createdAt": "2025-11-01T10:00:05.000Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Modules & Insights

### GET /modules/insights

List all module insights for current tenant.

**Query Parameters**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `moduleSlug` | string | - | Filter by module (e.g., "growth-pulse") |
| `limit` | number | 10 | Max insights to return |
| `offset` | number | 0 | Pagination offset |

**Response**

```json
{
  "success": true,
  "data": [
    {
      "id": "insight123",
      "tenantId": "tenant123",
      "moduleSlug": "growth-pulse",
      "summary": "User growth accelerating - conversion rate up 15%",
      "severity": "info",
      "actionItems": [
        {
          "title": "Increase ad spend to capitalize on trend",
          "priority": "high",
          "estimatedImpact": "20% revenue increase"
        }
      ],
      "metadata": {
        "metrics": {
          "conversionRate": 0.15,
          "changePercent": 15
        }
      },
      "createdAt": "2025-11-01T09:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 15,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET /modules/growth-pulse/insights

List Growth Pulse insights specifically.

**Query Parameters**

Same as `/modules/insights`

**Response**

Same structure as `/modules/insights`

### GET /modules/growth-pulse/insights/:insightId

Get a specific Growth Pulse insight.

**Response**

```json
{
  "success": true,
  "data": {
    "id": "insight123",
    "tenantId": "tenant123",
    "moduleSlug": "growth-pulse",
    "summary": "User growth accelerating - conversion rate up 15%",
    "severity": "info",
    "actionItems": [
      {
        "title": "Increase ad spend to capitalize on trend",
        "priority": "high",
        "estimatedImpact": "20% revenue increase"
      }
    ],
    "metadata": {
      "metrics": {
        "conversionRate": 0.15,
        "changePercent": 15
      },
      "dateRange": {
        "start": "2025-10-01",
        "end": "2025-10-31"
      }
    },
    "createdAt": "2025-11-01T09:00:00.000Z"
  }
}
```

**Error Responses**

```json
{
  "success": false,
  "error": {
    "code": "INSIGHT_NOT_FOUND",
    "message": "Insight not found"
  }
}
```

### POST /modules/growth-pulse/run

Trigger a Growth Pulse analysis.

**Request**

```json
{
  "dateRange": "last_30_days" // optional
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "jobId": "job123",
    "status": "queued",
    "message": "Growth Pulse analysis started"
  }
}
```

**Status Code**: `202 Accepted`

### GET /modules/growth-pulse/job/:jobId

Check status of a Growth Pulse job.

**Response**

```json
{
  "success": true,
  "data": {
    "jobId": "job123",
    "state": "completed",
    "progress": 100,
    "data": {
      "tenantId": "tenant123",
      "triggeredBy": "user123",
      "dateRange": "last_30_days"
    },
    "returnvalue": {
      "insightId": "insight123"
    },
    "failedReason": null
  }
}
```

**Job States**

| State | Description |
|-------|-------------|
| `waiting` | Queued, not started |
| `active` | Currently processing |
| `completed` | Finished successfully |
| `failed` | Failed with error |
| `delayed` | Scheduled for later |

---

## Board Meeting

### POST /board-meeting

Generate a board meeting report with aggregated insights.

**Request**

```json
{}
```

**Response**

```json
{
  "success": true,
  "data": {
    "generatedAt": "2025-11-01T12:00:00.000Z",
    "agenda": [
      {
        "section": "Executive Summary",
        "items": [
          "15 module insights generated",
          "23 tasks completed this period",
          "3/3 integrations active"
        ]
      },
      {
        "section": "Growth & Revenue",
        "items": [
          "User growth accelerating - conversion rate up 15%",
          "Revenue trending upward - MRR increased 8%"
        ]
      },
      {
        "section": "Recent Discussions",
        "items": [
          "CEO: What should I focus on this quarter?",
          "CFO: How can we optimize our cash flow?"
        ]
      },
      {
        "section": "Action Items",
        "items": [
          "Increase ad spend to capitalize on trend",
          "Review pricing strategy for enterprise tier"
        ]
      }
    ],
    "risks": [
      {
        "severity": "warning",
        "module": "growth-pulse",
        "summary": "Customer acquisition cost rising faster than LTV"
      }
    ],
    "metrics": {
      "sessions": 12500,
      "users": 3200,
      "conversions": 480,
      "revenue": 125000
    },
    "decisions": [],
    "followUps": [
      {
        "title": "Increase ad spend to capitalize on trend",
        "priority": "high",
        "module": "growth-pulse"
      },
      {
        "title": "Review pricing strategy for enterprise tier",
        "priority": "medium",
        "module": "growth-pulse"
      }
    ]
  }
}
```

---

## Connectors

### GET /connectors

List all connectors for authenticated user's tenant.

**Response**

```json
{
  "connectors": [
    {
      "id": "conn123",
      "provider": "google",
      "status": "active",
      "lastSyncAt": "2025-11-01T10:00:00.000Z",
      "createdAt": "2025-10-15T08:00:00.000Z",
      "updatedAt": "2025-11-01T10:00:00.000Z",
      "metadata": {
        "accountEmail": "user@example.com",
        "propertyId": "GA-123456"
      }
    }
  ],
  "count": 1
}
```

**Connector Status Values**

| Status | Description |
|--------|-------------|
| `active` | Connected and syncing |
| `inactive` | Disabled by user |
| `error` | Connection error |
| `pending` | OAuth in progress |

### POST /connectors/:provider/authorize

Initiate OAuth flow for a connector.

**Supported Providers**

- `google` - Google Analytics

**Request**

```json
{}
```

**Response**

```json
{
  "success": true,
  "authorizationUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&state=..."
}
```

**Flow**

1. Frontend calls this endpoint
2. Redirect user to `authorizationUrl`
3. User approves in OAuth provider
4. Provider redirects to callback URL
5. Backend exchanges code for tokens
6. Tokens encrypted and stored

### GET /connectors/:provider/callback

OAuth callback handler (automatic, not called directly).

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from provider |
| `state` | string | State parameter for validation |
| `error` | string | Error from provider (if failed) |

**Success**: Redirects to frontend with success message

**Error**: Redirects to frontend with error message

---

## Tasks

### POST /execute

Execute a task (generic task runner).

**Request**

```json
{
  "taskType": "example-task",
  "parameters": {
    "param1": "value1"
  }
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "taskId": "task123",
    "status": "queued"
  }
}
```

### GET /:taskId

Get task status.

**Response**

```json
{
  "success": true,
  "data": {
    "id": "task123",
    "type": "example-task",
    "status": "completed",
    "result": {
      "output": "Task completed successfully"
    },
    "createdAt": "2025-11-01T10:00:00.000Z",
    "completedAt": "2025-11-01T10:01:00.000Z"
  }
}
```

### GET /:taskId/stream

Stream task progress (SSE).

**Response** (Server-Sent Events)

```
event: progress
data: {"percent":25,"message":"Processing..."}

event: progress
data: {"percent":50,"message":"Halfway done..."}

event: complete
data: {"result":{"output":"Done"}}
```

---

## Response Schemas

### Insight Schema

```typescript
interface ModuleInsight {
  id: string;
  tenantId: string;
  moduleSlug: string;
  summary: string;
  severity: 'info' | 'warning' | 'critical';
  actionItems: ActionItem[];
  metadata: Record<string, any>;
  createdAt: string;
}

interface ActionItem {
  title: string;
  priority: 'low' | 'medium' | 'high';
  estimatedImpact?: string;
}
```

### Conversation Schema

```typescript
interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  personaType: 'ceo' | 'cfo' | 'cmo' | 'cto';
  title: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    messages: number;
  };
}
```

### Message Schema

```typescript
interface Message {
  id: string;
  conversationId: string;
  tenantId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: MessageMetadata | null;
  createdAt: string;
}

interface MessageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}
```

### Connector Schema

```typescript
interface Connector {
  id: string;
  provider: 'google';
  status: 'active' | 'inactive' | 'error' | 'pending';
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, any>;
}
```

---

## Pagination

All list endpoints support pagination:

**Query Parameters**

```
?limit=20&offset=0
```

**Response**

```json
{
  "data": [...],
  "pagination": {
    "total": 100,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
}
```

---

## Filtering

Some endpoints support filtering:

**Module Insights**

```
GET /modules/insights?moduleSlug=growth-pulse
```

**Conversations**

```
GET /c-suite/ceo/conversations?personaType=ceo
```

---

## Testing with curl

### Authenticate

First, get a Clerk token (from browser console or Clerk API).

### Chat Example

```bash
# Stream chat (use -N for no buffering)
curl -N -X POST http://localhost:3001/c-suite/ceo/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"What should I focus on?"}'
```

### List Insights

```bash
curl http://localhost:3001/modules/insights \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Trigger Growth Pulse

```bash
curl -X POST http://localhost:3001/modules/growth-pulse/run \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Generate Board Meeting

```bash
curl -X POST http://localhost:3001/board-meeting \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Webhooks (Future)

Webhooks for async notifications will be added in Phase 3.

---

## WebSocket (Future)

Real-time updates via WebSocket will be added in Phase 3.

---

## Appendix

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async operation) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 429 | Too Many Requests |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

### Content Types

| Type | Usage |
|------|-------|
| `application/json` | Default for requests/responses |
| `text/event-stream` | Server-Sent Events (SSE) |

### CORS

CORS is configured for development:

```
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
```

Production CORS is restricted to specific domains.

---

**Last Updated**: November 1, 2025
**API Version**: Phase 2
**Base URL**: http://localhost:3001
