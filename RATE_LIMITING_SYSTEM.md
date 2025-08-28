# Rate Limiting System Documentation

## Overview

The rate limiting system provides comprehensive protection for AI assistant endpoints with per-IP and per-session rate limiting, reflink-based access control, IP blacklisting, and detailed analytics.

## Features

### 1. Multi-Tier Rate Limiting
- **Basic**: 10 requests/day
- **Standard**: 50 requests/day (default)
- **Premium**: 200 requests/day
- **Unlimited**: No limits

### 2. Flexible Identifier Types
- **IP-based**: Rate limiting per IP address
- **Session-based**: Rate limiting per session ID
- **Reflink-based**: Enhanced limits with reflink codes

### 3. Security Features
- IP blacklisting with violation tracking
- Automatic blocking after multiple violations
- Content analysis for spam detection
- Admin reinstatement capabilities

### 4. Analytics & Monitoring
- Request tracking and analytics
- Security violation monitoring
- Usage statistics per reflink
- Admin dashboard integration

## API Endpoints

### Public Endpoints

#### Check Rate Limit Status
```
GET /api/ai/rate-limit/status?type=session&sessionId=user123&reflink=premium-code
```

Response:
```json
{
  "success": true,
  "data": {
    "status": {
      "allowed": true,
      "requestsRemaining": 45,
      "dailyLimit": 50,
      "resetTime": "2025-08-29T00:00:00.000Z",
      "tier": "STANDARD"
    },
    "identifier": "user123",
    "identifierType": "session"
  }
}
```

### Admin Endpoints

#### List Reflinks
```
GET /api/admin/ai/reflinks?active=true&limit=50&offset=0
```

#### Create Reflink
```
POST /api/admin/ai/reflinks
Content-Type: application/json

{
  "code": "premium-access",
  "name": "Premium Access Code",
  "description": "High-limit access for premium users",
  "rateLimitTier": "PREMIUM",
  "expiresAt": "2025-12-31T23:59:59.000Z"
}
```

#### Get Reflink Details
```
GET /api/admin/ai/reflinks/{id}
```

#### Update Reflink
```
PUT /api/admin/ai/reflinks/{id}
Content-Type: application/json

{
  "isActive": false,
  "rateLimitTier": "STANDARD"
}
```

#### List Blacklisted IPs
```
GET /api/admin/ai/blacklist?includeReinstated=false&limit=50
```

#### Blacklist IP
```
POST /api/admin/ai/blacklist
Content-Type: application/json

{
  "ipAddress": "192.168.1.100",
  "reason": "spam",
  "violationCount": 2
}
```

#### Reinstate IP
```
PUT /api/admin/ai/blacklist/{ipAddress}
Content-Type: application/json

{
  "action": "reinstate",
  "reason": "False positive, user verified"
}
```

#### Get Analytics
```
GET /api/admin/ai/rate-limit/analytics?days=7
```

## Usage Examples

### 1. Basic Rate Limiting Middleware

```typescript
import { withRateLimit, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limiting';

export const POST = withRateLimit(RATE_LIMIT_CONFIGS.AI_CHAT)(
  async (req: NextRequest) => {
    // Your API logic here
    return NextResponse.json({ message: 'Success' });
  }
);
```

### 2. Custom Rate Limiting

```typescript
import { createRateLimitedHandler } from '@/lib/middleware/rate-limiting';

const handler = async (req: NextRequest) => {
  // Your API logic
  return NextResponse.json({ data: 'response' });
};

export const POST = createRateLimitedHandler(handler, {
  identifierType: 'ip',
  customIdentifier: (req) => req.headers.get('x-user-id') || 'anonymous'
});
```

### 3. Manual Rate Limit Check

```typescript
import { rateLimiter } from '@/lib/services/ai/rate-limiter';

const result = await rateLimiter.checkRateLimit({
  identifier: 'user123',
  identifierType: 'session',
  endpoint: '/api/ai/chat',
  reflinkCode: 'premium-access',
  ipAddress: '192.168.1.1'
});

if (!result.success) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  );
}
```

### 4. Reflink Management

```typescript
import { reflinkManager } from '@/lib/services/ai/reflink-manager';

// Create reflink
const reflink = await reflinkManager.createReflink({
  code: 'special-access',
  name: 'Special Access',
  rateLimitTier: 'PREMIUM',
  expiresAt: '2025-12-31T23:59:59.000Z'
}, 'admin@example.com');

// Validate reflink
const validation = await reflinkManager.validateReflink('special-access');
if (!validation.valid) {
  console.log('Invalid reflink:', validation.reason);
}
```

### 5. Security Monitoring

```typescript
import { blacklistManager } from '@/lib/services/ai/blacklist-manager';

// Record violation
const result = await blacklistManager.recordViolation(
  '192.168.1.100',
  'suspicious_activity',
  { userAgent: 'BadBot/1.0', endpoint: '/api/ai/chat' }
);

if (result.blacklisted) {
  console.log('IP automatically blacklisted after', result.violationCount, 'violations');
}

// Check if IP is blacklisted
const status = await blacklistManager.isBlacklisted('192.168.1.100');
if (status.blacklisted) {
  console.log('IP is blacklisted:', status.reason);
}
```

## Configuration

### Rate Limit Tiers

```typescript
export const RATE_LIMIT_TIERS = {
  BASIC: { dailyLimit: 10, name: 'Basic' },
  STANDARD: { dailyLimit: 50, name: 'Standard' },
  PREMIUM: { dailyLimit: 200, name: 'Premium' },
  UNLIMITED: { dailyLimit: -1, name: 'Unlimited' }
} as const;
```

### Security Settings

```typescript
const securityConfig = {
  maxViolationsBeforeBlock: 2,
  autoReinstateAfterDays: 30,
  suspiciousActivityThreshold: 100,
  contentAnalysisEnabled: true
};
```

### Rate Limit Settings

```typescript
const rateLimitConfig = {
  windowSizeMs: 24 * 60 * 60 * 1000, // 24 hours
  defaultDailyLimit: 50,
  cleanupIntervalMs: 60 * 60 * 1000, // 1 hour
  logRetentionDays: 30
};
```

## Database Schema

The system uses the following database tables:

- `ai_rate_limits`: Tracks current usage per identifier
- `ai_reflinks`: Manages reflink codes and their configurations
- `ai_ip_blacklist`: Stores blacklisted IP addresses
- `ai_rate_limit_logs`: Logs all requests for analytics

## Monitoring & Maintenance

### Cleanup Tasks

The system includes automatic cleanup for:
- Expired rate limit records
- Old log entries
- Expired reflinks

### Analytics

Track key metrics:
- Total requests and blocked requests
- Unique users and usage patterns
- Security violations and trends
- Reflink performance

### Admin Dashboard

Access comprehensive management through:
- Reflink creation and management
- IP blacklist monitoring
- Usage analytics and reporting
- Security violation tracking

## Security Considerations

1. **IP Privacy**: IP addresses are not exposed in public responses
2. **Rate Limit Headers**: Standard headers are included in responses
3. **Graceful Degradation**: System continues working if rate limiting fails
4. **Audit Trail**: All actions are logged for security review
5. **Admin Authentication**: All admin endpoints require proper authentication

## Testing

Run the integration tests:
```bash
npm test -- src/__tests__/rate-limiting-integration.test.ts
```

Test API endpoints manually:
```bash
# Check rate limit status
curl "http://localhost:3000/api/ai/rate-limit/status?type=session&sessionId=test"

# Admin endpoints require authentication
curl -H "Authorization: Bearer <token>" \
     "http://localhost:3000/api/admin/ai/reflinks"
```

## Troubleshooting

### Common Issues

1. **Rate limit not working**: Check database connection and table creation
2. **Reflinks not found**: Verify reflink is active and not expired
3. **IP blacklist not blocking**: Check IP extraction logic in middleware
4. **Analytics empty**: Ensure requests are being logged properly

### Debug Mode

Enable debug logging:
```typescript
const rateLimiter = new RateLimiter({
  // ... config
});

// Check logs for rate limiting decisions
console.log('Rate limit result:', result);
```