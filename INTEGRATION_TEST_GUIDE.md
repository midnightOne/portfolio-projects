# Integration Test Guide

## 🧪 **Quick Manual Tests (Run These First)**

### 1. **Browser Console Tests**
Open your browser to `http://localhost:3000` and run these in the console:

```javascript
// Test 1: Check if UIManager is available
console.log('UIManager available:', typeof window.UIManager !== 'undefined');

// Test 2: Check semantic registry
const registry = window.UIManager?.getSemanticIDRegistry?.();
console.log('Registry available:', registry !== null);

// Test 3: Test semantic ID resolution
const contactElement = registry?.resolveSemanticID('contact');
console.log('Contact element found:', contactElement !== null);

// Test 4: Test navigation
window.UIManager?.executeIntent({
  target: { type: 'semantic', semanticId: 'contact', fallbackId: 'contact' }
}).then(result => console.log('Navigation result:', result));

// Test 5: Test UI description
window.UIManager?.describe().then(desc => {
  console.log('UI Description:', {
    epoch: desc.epoch,
    route: desc.route,
    sections: desc.sections.length,
    semanticSections: desc.sections.filter(s => s.semanticId).length
  });
});
```

### 2. **API Endpoint Tests**
Test the tool execution endpoints:

```bash
# Test ui_describe tool
curl -X POST http://localhost:3000/api/ai/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "ui_describe",
    "parameters": {},
    "executionContext": "client"
  }'

# Test ui_intent tool
curl -X POST http://localhost:3000/api/ai/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "ui_intent",
    "parameters": {
      "target": {
        "type": "semantic",
        "semanticId": "about",
        "fallbackId": "about"
      }
    },
    "executionContext": "client"
  }'
```

## 🚀 **Automated Integration Tests**

### Prerequisites
1. Make sure your development server is running: `npm run dev`
2. Install Playwright if not already installed: `npm install -D playwright`

### Run Individual Tests

```bash
# Test 1: Basic semantic navigation integration
node test-semantic-navigation-integration.js

# Test 2: Voice + semantic integration
node test-voice-semantic-integration.js

# Test 3: Real-world navigation scenarios
node test-navigation-scenarios.js
```

### Run All Tests
```bash
# Run comprehensive integration test suite
node run-all-integration-tests.js
```

## 📊 **What Each Test Validates**

### **Semantic Navigation Integration Test**
- ✅ UIManager initialization
- ✅ Semantic registry availability
- ✅ Semantic ID resolution
- ✅ Navigation execution
- ✅ UI state description
- ✅ Tool registry integration

### **Voice + Semantic Integration Test**
- ✅ Tool availability via API
- ✅ `ui_describe` tool execution
- ✅ `ui_intent` tool execution
- ✅ Semantic fallback behavior
- ✅ Voice configuration access
- ✅ Tool name consistency (no old `ui.navigate` names)

### **Real-World Navigation Scenarios Test**
- ✅ "Show me your contact information"
- ✅ "Tell me about yourself" (alias resolution)
- ✅ "Show me your work/portfolio" (multiple aliases)
- ✅ "Go back to the top"
- ✅ Project-specific navigation
- ✅ Error handling and fallback
- ✅ Performance under rapid navigation

## 🔍 **Debugging Failed Tests**

### Common Issues and Solutions

**1. UIManager not available**
```javascript
// Check if UIManager is properly initialized
console.log('UIManager:', window.UIManager);
console.log('Instance:', window.UIManager?.getInstance?.());
```

**2. Semantic registry not found**
```javascript
// Check registry initialization
const registry = window.UIManager?.getSemanticIDRegistry?.();
console.log('Registry:', registry);
console.log('Semantic IDs:', registry?.getAllSemanticIDs?.());
```

**3. Tool execution fails**
```javascript
// Check tool availability
const tools = window.UINavigationTools?.getInstance?.();
console.log('Available tools:', Object.keys(tools || {}));
console.log('ui_intent:', typeof tools?.['ui_intent']);
```

**4. Navigation doesn't work**
```javascript
// Check element existence
const element = document.querySelector('[data-semantic-id="contact"]');
console.log('Contact element:', element);
console.log('Element rect:', element?.getBoundingClientRect());
```

### Debug Mode
Enable debug mode for more detailed logging:

```javascript
// Enable debug logging
window.UIManager?.configureTiming({ animationMode: 'instant' });
localStorage.setItem('debug-navigation', 'true');
```

## 📈 **Expected Results**

### **Successful Test Run Should Show:**
- ✅ All 6 semantic navigation integration tests pass
- ✅ All 6 voice integration tests pass  
- ✅ All 7 real-world navigation scenarios pass
- ✅ Overall success rate: 100%
- ✅ Total execution time: < 60 seconds

### **Performance Benchmarks:**
- Navigation execution: < 2 seconds per action
- Tool API response: < 500ms
- Semantic ID resolution: < 10ms
- UI state description: < 100ms

## 🎯 **Production Readiness Checklist**

After all tests pass, verify:

- [ ] Build completes without errors (`npm run build`)
- [ ] All unit tests pass (`npm test`)
- [ ] Integration tests pass (this guide)
- [ ] Voice agents can navigate using semantic IDs
- [ ] Fallback behavior works for missing semantic IDs
- [ ] Performance is acceptable under load
- [ ] Error handling is graceful
- [ ] Tool names follow validation rules (no dots)

## 🚀 **Next Steps After Testing**

1. **Add More Semantic IDs**: Add `data-semantic-id` attributes to your HTML elements
2. **Configure Voice Agents**: Update voice configurations to use semantic navigation
3. **Monitor Performance**: Use the debug panel to monitor navigation performance
4. **Extend Registry**: Add custom semantic IDs programmatically as needed
5. **Document Usage**: Share semantic ID conventions with your team

## 📚 **Additional Resources**

- [SemanticIDRegistry.README.md](./src/lib/navigation/SemanticIDRegistry.README.md) - Complete API documentation
- [SemanticIDRegistryExample.tsx](./src/lib/navigation/examples/SemanticIDRegistryExample.tsx) - Usage examples
- [UIManager.ts](./src/lib/navigation/UIManager.ts) - Core navigation system
- [client-tools.ts](./src/lib/ai/tools/client-tools.ts) - Tool definitions