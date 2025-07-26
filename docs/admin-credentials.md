# Admin Credentials (Development Only)

## Performance Dashboard Access

For development and testing purposes, the admin performance dashboard can be accessed with:

- **URL**: `http://localhost:3000/admin/performance`
- **Username**: `admin` (from .env)
- **Password**: `admin2025` (from .env)

## Available Admin Features

### Performance Dashboard (`/admin/performance`)
- Real-time performance metrics
- Database query analysis
- Memory usage monitoring
- Cache management controls
- Performance recommendations
- System health indicators

### Admin API Endpoints
- `/api/admin/performance` - Detailed performance analytics
- `/api/admin/cache` - Cache management and statistics

## Security Notes

⚠️ **Important**: These credentials are for development purposes only and should never be used in production environments.

## Testing the Performance Dashboard

1. Navigate to `http://localhost:3000/admin/performance`
2. Login with the credentials above
3. View real-time performance metrics
4. Test cache clearing functionality
5. Monitor database performance

The dashboard provides comprehensive insights into:
- Request response times
- Database query performance
- Memory usage patterns
- Performance optimization recommendations