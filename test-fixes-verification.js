/**
 * Quick Fixes Verification Test
 * 
 * Tests the specific fixes made to address the failed integration tests.
 */

const { chromium } = require('playwright');

async function testFixesVerification() {
  console.log('🔧 Testing Integration Test Fixes...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // Navigate to homepage
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Page loaded');
    
    // Fix 1: Test UINavigationTools availability
    console.log('\n🔍 Fix 1: UINavigationTools Availability');
    const toolsTest = await page.evaluate(() => {
      return {
        UINavigationToolsClass: typeof window.UINavigationTools !== 'undefined',
        getInstance: typeof window.UINavigationTools?.getInstance === 'function',
        instance: window.UINavigationTools?.getInstance?.() !== null,
        hasUiIntent: typeof window.UINavigationTools?.getInstance?.()?.['ui_intent'] === 'function',
        hasUiDescribe: typeof window.UINavigationTools?.getInstance?.()?.['ui_describe'] === 'function'
      };
    });
    
    console.log('📊 Tools Test:', toolsTest);
    
    // Fix 2: Test client-side tool execution
    console.log('\n🔍 Fix 2: Client-Side Tool Execution');
    const clientToolsTest = await page.evaluate(async () => {
      try {
        const tools = window.UINavigationTools?.getInstance?.();
        if (!tools) return { success: false, error: 'Tools not available' };
        
        // Test ui_describe
        const describeResult = await tools['ui_describe']({});
        
        // Test ui_intent
        const navigateResult = await tools['ui_intent']({
          target: { type: 'semantic', semanticId: 'about', fallbackId: 'about' }
        });
        
        return {
          success: true,
          describeWorked: describeResult.success,
          navigateWorked: navigateResult.success,
          describeData: !!describeResult.data,
          navigateMessage: navigateResult.message
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Client Tools Test:', clientToolsTest);
    
    // Fix 3: Test home semantic ID resolution
    console.log('\n🔍 Fix 3: Home Semantic ID Resolution');
    const homeTest = await page.evaluate(() => {
      try {
        if (!window.UIManager || typeof window.UIManager.getSemanticIDRegistry !== 'function') {
          return { success: false, error: 'UIManager.getSemanticIDRegistry not available' };
        }
        
        const registry = window.UIManager.getSemanticIDRegistry();
        if (!registry) return { success: false, error: 'Registry not available' };
        
        const homeElement = registry.resolveSemanticID('home');
        const homeSelector = registry.getSemanticIDEntry?.('home')?.selector;
        
        return {
          success: homeElement !== null,
          elementFound: homeElement !== null,
          selector: homeSelector,
          elementTag: homeElement?.tagName?.toLowerCase()
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Home Test:', homeTest);
    
    // Fix 4: Test project card detection
    console.log('\n🔍 Fix 4: Project Card Detection');
    
    // First navigate to projects page
    await page.goto('http://localhost:3000/projects');
    await page.waitForLoadState('networkidle');
    
    const projectCardTest = await page.evaluate(() => {
      const projectCards = document.querySelectorAll('.project-card, [data-project-id], [data-semantic-id="project-card"]');
      const firstCard = projectCards[0];
      
      return {
        cardsFound: projectCards.length,
        hasProjectCards: projectCards.length > 0,
        firstCardHasDataProjectId: firstCard?.hasAttribute('data-project-id'),
        firstCardHasSemanticId: firstCard?.hasAttribute('data-semantic-id'),
        firstCardClasses: firstCard?.className
      };
    });
    
    console.log('📊 Project Card Test:', projectCardTest);
    
    // Fix 5: Test NavigationProvider initialization
    console.log('\n🔍 Fix 5: NavigationProvider Initialization');
    const initTest = await page.evaluate(() => {
      try {
        return {
          UIManagerAvailable: typeof window.UIManager !== 'undefined',
          UIManagerHasExecuteIntent: typeof window.UIManager?.executeIntent === 'function',
          UIManagerHasGetRegistry: typeof window.UIManager?.getSemanticIDRegistry === 'function',
          UINavigationToolsAvailable: typeof window.UINavigationTools !== 'undefined',
          registryInitialized: window.UIManager?.getSemanticIDRegistry?.() !== null,
          semanticIdsCount: window.UIManager?.getSemanticIDRegistry?.()?.getAllSemanticIDs?.()?.length || 0
        };
      } catch (error) {
        return {
          UIManagerAvailable: false,
          error: error.message
        };
      }
    });
    
    console.log('📊 Initialization Test:', initTest);
    
    // Summary
    const fixes = [
      { name: 'UINavigationTools Availability', passed: toolsTest.UINavigationToolsClass && toolsTest.hasUiNavigate && toolsTest.hasUiDescribe },
      { name: 'Client-Side Tool Execution', passed: clientToolsTest.success && clientToolsTest.describeWorked && clientToolsTest.navigateWorked },
      { name: 'Home Semantic ID Resolution', passed: homeTest.success && homeTest.elementFound },
      { name: 'Project Card Detection', passed: projectCardTest.hasProjectCards },
      { name: 'NavigationProvider Initialization', passed: initTest.UIManagerAvailable && initTest.UIManagerHasExecuteIntent && initTest.registryInitialized }
    ];
    
    const passedFixes = fixes.filter(f => f.passed).length;
    const totalFixes = fixes.length;
    
    console.log('\n📊 Fixes Verification Results:');
    fixes.forEach(fix => {
      console.log(`${fix.passed ? '✅' : '❌'} ${fix.name}`);
    });
    
    console.log(`\n🎯 Overall: ${passedFixes}/${totalFixes} fixes verified`);
    
    if (passedFixes === totalFixes) {
      console.log('🎉 All fixes verified! Integration tests should now pass.');
    } else {
      console.log('⚠️  Some fixes still need work. Check the details above.');
    }
    
    return { passedFixes, totalFixes, fixes };
    
  } catch (error) {
    console.error('❌ Fix verification failed:', error);
    return { passedFixes: 0, totalFixes: 5, error: error.message };
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testFixesVerification()
    .then(results => {
      process.exit(results.passedFixes === results.totalFixes ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Fix verification failed:', error);
      process.exit(1);
    });
}

module.exports = { testFixesVerification };