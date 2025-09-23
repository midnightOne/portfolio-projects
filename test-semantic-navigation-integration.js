/**
 * End-to-End Semantic Navigation Integration Test
 * 
 * Tests the complete flow from voice command to UI navigation
 * using the new Semantic ID Registry system.
 */

const { chromium } = require('playwright');

async function testSemanticNavigationIntegration() {
  console.log('🧪 Starting Semantic Navigation Integration Test...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to homepage
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Page loaded successfully');
    
    // Test 1: Check if UIManager is available
    const uiManagerAvailable = await page.evaluate(() => {
      return typeof window.UIManager !== 'undefined';
    });
    
    console.log('🔍 UIManager available:', uiManagerAvailable);
    
    // Test 2: Check if Semantic Registry is initialized
    const registryInitialized = await page.evaluate(() => {
      if (!window.UIManager) return false;
      try {
        const registry = window.UIManager.getSemanticIDRegistry();
        return registry !== null;
      } catch (error) {
        console.error('Registry access error:', error);
        return false;
      }
    });
    
    console.log('🔍 Semantic Registry initialized:', registryInitialized);
    
    // Test 3: Test semantic ID resolution
    const semanticResolution = await page.evaluate(() => {
      if (!window.UIManager) return { success: false, error: 'UIManager not available' };
      
      try {
        const registry = window.UIManager.getSemanticIDRegistry();
        if (!registry) return { success: false, error: 'Registry not available' };
        
        // Test resolving default semantic IDs
        const results = {};
        const testIds = ['contact', 'about', 'projects', 'home'];
        
        for (const id of testIds) {
          try {
            const element = registry.resolveSemanticID(id);
            results[id] = element !== null;
          } catch (error) {
            results[id] = false;
          }
        }
        
        return { success: true, results };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🔍 Semantic ID Resolution:', semanticResolution);
    
    // Test 4: Test ui_navigate tool execution
    const navigationTest = await page.evaluate(async () => {
      if (!window.UIManager) return { success: false, error: 'UIManager not available' };
      
      try {
        // Test navigation to contact section using semantic ID
        const result = await window.UIManager.executeIntent({
          target: {
            type: 'semantic',
            semanticId: 'contact',
            fallbackId: 'contact'
          },
          behavior: {
            scrollBehavior: 'smooth',
            waitForReadyMs: 500
          }
        });
        
        return { success: result.success, message: result.message };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🔍 Navigation Test:', navigationTest);
    
    // Test 5: Test UI state description
    const uiDescription = await page.evaluate(async () => {
      if (!window.UIManager) return { success: false, error: 'UIManager not available' };
      
      try {
        const description = await window.UIManager.describe();
        return {
          success: true,
          epoch: description.epoch,
          route: description.route,
          sectionsCount: description.sections.length,
          semanticSections: description.sections.filter(s => s.semanticId).length
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('🔍 UI Description:', uiDescription);
    
    // Test 6: Test tool registry integration
    const toolRegistryTest = await page.evaluate(() => {
      // Check if ui_navigate and ui_describe tools are available
      const tools = window.UINavigationTools?.getInstance?.();
      if (!tools) return { success: false, error: 'UINavigationTools not available' };
      
      const hasNavigate = typeof tools['ui_navigate'] === 'function';
      const hasDescribe = typeof tools['ui_describe'] === 'function';
      
      return {
        success: true,
        hasNavigate,
        hasDescribe,
        toolsAvailable: Object.keys(tools).filter(key => typeof tools[key] === 'function').length
      };
    });
    
    console.log('🔍 Tool Registry Test:', toolRegistryTest);
    
    // Summary
    const allTests = [
      { name: 'UIManager Available', passed: uiManagerAvailable },
      { name: 'Registry Initialized', passed: registryInitialized },
      { name: 'Semantic Resolution', passed: semanticResolution.success },
      { name: 'Navigation Test', passed: navigationTest.success },
      { name: 'UI Description', passed: uiDescription.success },
      { name: 'Tool Registry', passed: toolRegistryTest.success }
    ];
    
    const passedTests = allTests.filter(t => t.passed).length;
    const totalTests = allTests.length;
    
    console.log('\n📊 Integration Test Results:');
    allTests.forEach(test => {
      console.log(`${test.passed ? '✅' : '❌'} ${test.name}`);
    });
    
    console.log(`\n🎯 Overall: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All integration tests passed!');
    } else {
      console.log('⚠️  Some integration tests failed. Check the details above.');
    }
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testSemanticNavigationIntegration().catch(console.error);
}

module.exports = { testSemanticNavigationIntegration };