# Security Architecture

This document outlines the security architecture and measures implemented in the Car Rental Operations Platform.

## Authentication Model

This application uses **session-based authentication** managed at the application layer, not Supabase Auth. The security model follows these principles:

- **Backend-Only Database Access**: All database operations go through the Express.js backend using the service role
- **Session Management**: User sessions are stored in PostgreSQL with secure cookies
- **No Direct Client Access**: Frontend never directly accesses the database
- **Application-Layer Authorization**: Role-based access control is enforced in Express middleware

## Database Security

### Row Level Security (RLS)

All tables have RLS enabled to prevent unauthorized direct database access:

- **Status**: ✅ Enabled on 28 of 52 tables (original schema tables). 24 tables added in Phase 3–4 use application-layer workspace isolation via `workspaceId` scoping.
- **Policy Model**: Service role bypass policies allow the application backend full access
- **Direct Access**: Blocked for `anon` and `authenticated` roles
- **Protection**: Sensitive data (passwords) cannot be accessed directly via API

### Foreign Key Indexes

All foreign key relationships are properly indexed for optimal query performance:

- **Total Indexes**: 192 indexes covering all foreign keys and frequently queried columns
- **Performance**: Optimized JOIN operations across all table relationships
- **Coverage**: 100% of foreign key columns have covering indexes

### Schema Privileges

Database privileges are strictly controlled:

```sql
-- Anonymous role has NO access
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

-- Authenticated role has NO access (not used in this app)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
```

## Application Security

### Content Security Policy

Strict CSP headers are enforced:

- ❌ No `unsafe-inline` in scriptSrc
- ❌ No `unsafe-eval` in scriptSrc
- ✅ Only self-hosted scripts allowed
- ✅ Fonts limited to Google Fonts
- ✅ Frame embedding blocked
- ✅ HSTS with preload enabled

### Security Headers

Additional security headers protect against common attacks:

- `X-Frame-Options: DENY` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Blocks MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy` - Restricts browser features (camera, microphone, etc.)
- `HSTS` - Forces HTTPS with 1-year max-age and preload

### Rate Limiting

Multiple rate limiters protect against abuse:

| Endpoint | Window | Max Requests | Purpose |
|----------|--------|--------------|---------|
| Auth | 15 min | 20 | Prevent brute force |
| API | 1 min | 100 | General API protection |
| AI Chat | 1 min | 10 | Prevent AI abuse |
| Search | 1 min | 30 | Limit search queries |
| Webhooks | 1 min | 30 | Limit webhook ingestion |

Rate limiting uses user ID for authenticated requests and IP address for anonymous requests.

### Input Validation

All API endpoints use Zod schema validation:

- Request body validation
- Query parameter validation
- Path parameter validation
- Automatic sanitization of dangerous content

### SQL Injection Prevention

- ✅ Parameterized queries with Drizzle ORM
- ✅ Input sanitization for LIKE patterns
- ✅ Special character escaping: `%`, `_`, `\`
- ❌ No raw SQL concatenation

### Audit Logging

All critical operations are logged:

- User ID and IP address tracked
- Action type (CREATE, UPDATE, DELETE, VIEW, LOGIN, LOGOUT)
- Entity type and ID
- Timestamp and request metadata
- Stored in `audit_log` table for compliance

## Observability

### Structured Logging

All logs follow JSON format in production:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "INFO",
  "message": "Request completed",
  "userId": 123,
  "path": "/api/vehicles",
  "method": "GET",
  "statusCode": 200,
  "duration": 45
}
```

### Metrics Collection

Application metrics track the golden signals:

- **Latency**: Average response time per endpoint
- **Traffic**: Request volume and patterns
- **Errors**: Error rate and status codes
- **Saturation**: Memory and CPU usage

Metrics are exposed at `/api/metrics` (admin only).

### Real-Time Monitoring

WebSocket server provides real-time system insights:

- Active connections: Total and authenticated clients
- Channel subscriptions: User presence by feature
- Health checks: System uptime and resource usage

## Real-Time Communication

### WebSocket Security

WebSocket connections implement:

- Authentication required for privileged channels
- Per-user message filtering
- Station-based data isolation
- Automatic reconnection with exponential backoff
- Heartbeat/ping-pong for connection health

## Compliance

### GDPR Considerations

The platform includes features to support GDPR compliance:

- **Audit Trail**: Complete history of data access and modifications
- **Data Retention**: Soft delete patterns for vehicles and users
- **Access Logging**: IP addresses and user actions tracked
- **Right to Access**: Audit logs provide full activity history

### Data Protection

- Passwords hashed with scrypt (Node.js crypto, 64-byte key, timing-safe compare)
- Session tokens stored securely in PostgreSQL
- Sensitive data protected by RLS
- No PII in logs (except audit logs)

## Security Best Practices

### For Developers

1. **Never hardcode secrets** - Use environment variables
2. **Always validate input** - Use Zod schemas for all endpoints
3. **Use parameterized queries** - Never concatenate SQL
4. **Log security events** - Use audit logging for sensitive operations
5. **Test authentication** - Verify role-based access in tests
6. **Review dependencies** - Run `npm audit` regularly

### For Operators

1. **Monitor audit logs** - Review `/api/metrics` and `audit_log` table
2. **Rotate secrets regularly** - Update API keys and database passwords
3. **Keep dependencies updated** - Apply security patches promptly
4. **Review security reports** - Check Supabase advisor recommendations
5. **Enable alerts** - Set up monitoring for abnormal patterns
6. **Backup regularly** - Maintain point-in-time recovery capability

## Security Checklist

- [x] RLS enabled on all tables
- [x] Foreign keys properly indexed
- [x] CSP headers without unsafe directives
- [x] Rate limiting on all endpoints
- [x] Input validation with Zod
- [x] SQL injection prevention
- [x] Audit logging for critical operations
- [x] Structured logging for observability
- [x] WebSocket authentication
- [x] Session-based authentication
- [x] Password hashing with scrypt
- [x] Security headers (HSTS, X-Frame-Options, etc.)

## Incident Response

In case of a security incident:

1. **Isolate**: Disable affected features or users
2. **Investigate**: Review audit logs and metrics
3. **Notify**: Alert administrators and affected users
4. **Remediate**: Fix vulnerability and rotate credentials
5. **Document**: Update this documentation with lessons learned

## Contact

For security concerns, contact the security team immediately.
