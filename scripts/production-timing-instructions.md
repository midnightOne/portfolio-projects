# Production Timing Monitoring Instructions

## How to Monitor Tool Call Performance in Production

### 1. Start the Development Server
```bash
npm run dev
```

### 2. Open Browser and Navigate to Voice Interface
- Go to `http://localhost:3000`
- Open the voice interface (floating AI button)
- Open browser Developer Tools (F12)
- Go to Console tab

### 3. Available Debug Commands

Once the page loads, you'll see timing debug utilities are available. Use these commands in the browser console:

#### Get Performance Summary
```javascript
timingDebug.summary()
```
Shows total calls, average time, and slow calls.

#### Monitor Next Tool Call in Detail
```javascript
timingDebug.monitorNext()
```
This will show detailed timing for the next tool call you make.

#### Get Recent Slow Calls (>2 seconds)
```javascript
timingDebug.getSlowCalls()
```

#### Get Recent Tool Calls
```javascript
timingDebug.getRecentCalls()
```

#### Clear Timing Data
```javascript
timingDebug.clear()
```

### 4. Test the Slow Query

1. **Enable monitoring**: Run `timingDebug.monitorNext()` in console
2. **Make the voice query**: Say or type: "What are the common elements between task management app and e-commerce platform?"
3. **Check the console**: You'll see detailed timing breakdown like:

```
[ProductionTiming] content_search Complete Breakdown (abc-123-def)
🚀 Browser Prep: 15ms
🌐 Network Round-trip: 1200ms  
⚙️  Server Execution: 1159ms
🔄 Browser Post-process: 8ms
⏱️  Total Time: 2382ms
```

### 5. Understanding the Timing Breakdown

- **Browser Prep**: Time spent preparing the request (serialization, etc.)
- **Network Round-trip**: Time for request to travel to server and back
- **Server Execution**: Time spent on server processing (from API metadata)
- **Browser Post-process**: Time spent processing the response
- **Total Time**: Complete end-to-end time

### 6. Identifying Performance Issues

The system will automatically highlight slow components:

- **⚠️ SLOW PERFORMANCE DETECTED**: Total time > 3 seconds
- **🌐 Network is slow**: Network round-trip > 2 seconds  
- **⚙️ Server is slow**: Server execution > 2 seconds
- **🚀 Browser prep is slow**: Browser preparation > 500ms

### 7. Production Analytics

In production, slow calls (>1 second) are automatically sent to `/api/analytics/timing` for monitoring.

### 8. Correlation with Server Logs

Each tool call has a unique `toolCallId` that appears in both:
- Browser console logs: `[ProductionTiming] content_search Complete Breakdown (abc-123-def)`
- Server console logs: `[APIRoute] /api/ai/tools/execute content_search performance breakdown`

Use the `toolCallId` to correlate browser and server timing.

### Example Complete Flow Timing

```
Browser Console:
[ProductionTiming] content_search Complete Breakdown (abc-123-def)
🚀 Browser Prep: 15ms
🌐 Network Round-trip: 1200ms
⚙️  Server Execution: 1159ms  
🔄 Browser Post-process: 8ms
⏱️  Total Time: 2382ms

Server Console:
[APIRoute] /api/ai/tools/execute content_search performance breakdown: {
  requestParsing: '2ms',
  toolValidation: '1ms', 
  accessControl: '5ms',
  backendServiceExecution: '1151ms',
  totalApiRoute: '1159ms'
}

[BackendTool] Content search performance breakdown: {
  contentSearch: '1115ms',
  uiRanking: '0ms',
  totalBackend: '1115ms'
}

[ContentSearch] Performance breakdown for query "...": {
  embedding: '369ms (API)',
  hybridSearch: '790ms',
  total: '1159ms'
}
```

This gives you complete visibility into where time is being spent in the production environment!