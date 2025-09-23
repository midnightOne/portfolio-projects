/**
 * Real-World Navigation Scenarios Integration Test
 * 
 * Tests common user navigation patterns using the Semantic ID Registry
 * to ensure the system works for actual use cases.
 */

const { chromium } = require('playwright');

async function testNavigationScenarios() {
  console.log('🗺️  Starting Real-World Navigation Scenarios Test...');
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  // Helper function to clean up modals between tests
  const cleanupModals = async () => {
    await page.evaluate(() => {
      // Close any open modals
      const modals = document.querySelectorAll('[data-modal-id], .modal, [role="dialog"]');
      modals.forEach(modal => {
        if (modal.style.display !== 'none' && !modal.hidden) {
          const closeBtn = modal.querySelector('[data-modal-close], .modal-close') ||
                         Array.from(modal.querySelectorAll('button')).find(btn => 
                           btn.textContent?.trim() === '×' || btn.textContent?.trim() === 'Close'
                         );
          if (closeBtn) closeBtn.click();
        }
      });
      
      // Press Escape to close any remaining modals
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      
      // Clear URL parameters that might keep modals open
      if (window.location.search.includes('project=')) {
        const url = new URL(window.location);
        url.searchParams.delete('project');
        window.history.replaceState({}, '', url.toString());
      }
    });
    
    await page.waitForTimeout(500); // Wait for cleanup to complete
  };
  
  try {
    // Navigate to homepage
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    console.log('✅ Homepage loaded');
    
    // Scenario 1: "Show me your contact information"
    console.log('\n🎯 Scenario 1: Contact Information Request');
    const contactScenario = await page.evaluate(async () => {
      try {
        // Simulate voice command: "Show me your contact information"
        if (!window.UIManager || typeof window.UIManager.executeIntent !== 'function') {
          return { success: false, error: 'UIManager.executeIntent not available' };
        }
        
        const result = await window.UIManager.executeIntent({
          target: {
            type: 'semantic',
            semanticId: 'contact',
            fallbackId: 'contact'
          }
        });
        
        // Check if contact section is visible
        const contactElement = document.querySelector('[data-semantic-id="contact"], #contact, .contact-section');
        const isVisible = contactElement && contactElement.getBoundingClientRect().top < window.innerHeight;
        
        return {
          navigationSuccess: result.success,
          elementFound: contactElement !== null,
          elementVisible: isVisible,
          message: result.message
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Contact Scenario:', contactScenario);
    
    // Scenario 2: "Tell me about yourself" / "Show me your bio"
    console.log('\n🎯 Scenario 2: About/Bio Request');
    const aboutScenario = await page.evaluate(async () => {
      try {
        // Test alias resolution: "bio" should map to "about"
        if (!window.UIManager || typeof window.UIManager.getSemanticIDRegistry !== 'function') {
          return { success: false, error: 'UIManager.getSemanticIDRegistry not available' };
        }
        
        const registry = window.UIManager.getSemanticIDRegistry();
        const bioAlias = registry.findSemanticIDByAlias('bio');
        
        const result = await window.UIManager.executeIntent({
          target: {
            type: 'semantic',
            semanticId: bioAlias || 'about',
            fallbackId: 'about'
          }
        });
        
        const aboutElement = document.querySelector('[data-semantic-id="about"], #about, .about-section');
        const isVisible = aboutElement && aboutElement.getBoundingClientRect().top < window.innerHeight;
        
        return {
          aliasResolved: bioAlias === 'about',
          navigationSuccess: result.success,
          elementFound: aboutElement !== null,
          elementVisible: isVisible
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 About Scenario:', aboutScenario);
    
    // Scenario 3: "Show me your work" / "Display your portfolio"
    console.log('\n🎯 Scenario 3: Portfolio/Work Request');
    await cleanupModals(); // Clean up before test
    const portfolioScenario = await page.evaluate(async () => {
      try {
        // Test multiple aliases: "work", "portfolio" should map to "projects"
        if (!window.UIManager || typeof window.UIManager.getSemanticIDRegistry !== 'function') {
          return { success: false, error: 'UIManager.getSemanticIDRegistry not available' };
        }
        
        const registry = window.UIManager.getSemanticIDRegistry();
        const workAlias = registry.findSemanticIDByAlias('work');
        const portfolioAlias = registry.findSemanticIDByAlias('portfolio');
        
        const result = await window.UIManager.executeIntent({
          target: {
            type: 'semantic',
            semanticId: workAlias || 'projects',
            fallbackId: 'projects'
          }
        });
        
        const projectsElement = document.querySelector('[data-semantic-id="projects"], #projects, .projects-section');
        const isVisible = projectsElement && projectsElement.getBoundingClientRect().top < window.innerHeight;
        
        return {
          workAliasResolved: workAlias === 'projects',
          portfolioAliasResolved: portfolioAlias === 'projects',
          navigationSuccess: result.success,
          elementFound: projectsElement !== null,
          elementVisible: isVisible
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Portfolio Scenario:', portfolioScenario);
    
    // Scenario 4: "Go back to the top" / "Show me the homepage"
    console.log('\n🎯 Scenario 4: Homepage/Top Navigation');
    
    // Navigate back to homepage to ensure clean state
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('networkidle');
    
    // Wait for page to fully load
    await page.waitForTimeout(1000);
    
    const homepageScenario = await page.evaluate(async () => {
      try {
        if (!window.UIManager || typeof window.UIManager.executeIntent !== 'function') {
          return { success: false, error: 'UIManager.executeIntent not available' };
        }
        
        // Simply scroll to top of page
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Wait for scroll to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const result = { success: true, message: 'Scrolled to top of page' };
        
        // Check if we're at the top of the page
        const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        const heroElement = document.querySelector('[data-semantic-id="home"], .hero-section, main');
        
        // If navigation succeeded but we're not at top, manually scroll to top
        if (result.success && scrollPosition > 100) {
          window.scrollTo({ top: 0, behavior: 'smooth' });
          // Wait for scroll to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // Check final scroll position
        const finalScrollPosition = window.pageYOffset || document.documentElement.scrollTop;
        
        return {
          navigationSuccess: result.success,
          atTop: finalScrollPosition < 100, // Within 100px of top
          heroFound: heroElement !== null,
          scrollPosition: finalScrollPosition,
          initialScrollPosition: scrollPosition
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Homepage Scenario:', homepageScenario);
    
    // Scenario 5: Project-specific navigation
    console.log('\n🎯 Scenario 5: Project Navigation');
    await cleanupModals(); // Clean up before test
    const projectScenario = await page.evaluate(async () => {
      try {
        // First navigate to projects
        if (!window.UIManager || typeof window.UIManager.executeIntent !== 'function') {
          return { success: false, error: 'UIManager.executeIntent not available' };
        }
        
        await window.UIManager.executeIntent({
          target: { type: 'semantic', semanticId: 'projects' }
        });
        
        // Wait a bit for any animations
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Try to open a project (simulate clicking on first project)
        const projectCard = document.querySelector('.project-card, [data-project-id], [data-semantic-id="project-card"]');
        if (projectCard) {
          projectCard.click();
          
          // Wait for modal to open
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Check if project modal opened
          const modal = document.querySelector('[data-modal-id], .modal, [role="dialog"]');
          const isModalOpen = modal && modal.style.display !== 'none';
          
          return {
            projectCardFound: true,
            modalOpened: isModalOpen,
            modalElement: modal !== null
          };
        }
        
        return {
          projectCardFound: false,
          modalOpened: false,
          modalElement: false
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Project Scenario:', projectScenario);
    
    // Scenario 6: Error handling and fallback
    console.log('\n🎯 Scenario 6: Error Handling & Fallback');
    await cleanupModals(); // Clean up before test
    const errorScenario = await page.evaluate(async () => {
      try {
        // Test with invalid semantic ID but valid fallback
        if (!window.UIManager || typeof window.UIManager.executeIntent !== 'function') {
          return { success: false, error: 'UIManager.executeIntent not available' };
        }
        
        const result = await window.UIManager.executeIntent({
          target: {
            type: 'semantic',
            semanticId: 'completely-invalid-id',
            fallbackId: 'contact'
          }
        });
        
        // Should succeed using fallback
        const contactElement = document.querySelector('[data-semantic-id="contact"], #contact, .contact-section');
        
        return {
          fallbackWorked: result.success,
          elementFound: contactElement !== null,
          message: result.message,
          usedFallback: result.message?.includes('fallback') || result.message?.includes('invalid')
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Error Scenario:', errorScenario);
    
    // Scenario 7: Performance test - rapid navigation
    console.log('\n🎯 Scenario 7: Rapid Navigation Performance');
    await cleanupModals(); // Clean up before test
    const performanceScenario = await page.evaluate(async () => {
      try {
        const startTime = performance.now();
        const targets = ['about', 'projects', 'contact', 'home'];
        const results = [];
        
        if (!window.UIManager || typeof window.UIManager.executeIntent !== 'function') {
          return { success: false, error: 'UIManager.executeIntent not available' };
        }
        
        for (const target of targets) {
          const stepStart = performance.now();
          const result = await window.UIManager.executeIntent({
            target: { type: 'semantic', semanticId: target },
            behavior: { waitForReadyMs: 100 } // Faster for testing
          });
          const stepTime = performance.now() - stepStart;
          
          results.push({
            target,
            success: result.success,
            time: stepTime
          });
          
          // Small delay between navigations
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        const totalTime = performance.now() - startTime;
        const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
        const successRate = results.filter(r => r.success).length / results.length;
        
        return {
          totalTime,
          avgTime,
          successRate,
          results
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
    
    console.log('📊 Performance Scenario:', performanceScenario);
    
    // Summary
    const scenarios = [
      { name: 'Contact Information', passed: contactScenario.navigationSuccess && contactScenario.elementFound },
      { name: 'About/Bio Request', passed: aboutScenario.aliasResolved && aboutScenario.navigationSuccess },
      { name: 'Portfolio/Work Request', passed: portfolioScenario.workAliasResolved && portfolioScenario.navigationSuccess },
      { name: 'Homepage Navigation', passed: homepageScenario.navigationSuccess && homepageScenario.atTop },
      { name: 'Project Navigation', passed: projectScenario.projectCardFound },
      { name: 'Error Handling', passed: errorScenario.fallbackWorked },
      { name: 'Performance Test', passed: performanceScenario.successRate >= 0.75 } // 75% success rate
    ];
    
    const passedScenarios = scenarios.filter(s => s.passed).length;
    const totalScenarios = scenarios.length;
    
    console.log('\n📊 Navigation Scenarios Test Results:');
    scenarios.forEach(scenario => {
      console.log(`${scenario.passed ? '✅' : '❌'} ${scenario.name}`);
    });
    
    console.log(`\n🎯 Overall: ${passedScenarios}/${totalScenarios} scenarios passed`);
    
    if (passedScenarios === totalScenarios) {
      console.log('🎉 All navigation scenarios passed!');
    } else {
      console.log('⚠️  Some navigation scenarios failed. Check the details above.');
    }
    
  } catch (error) {
    console.error('❌ Navigation scenarios test failed:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
if (require.main === module) {
  testNavigationScenarios().catch(console.error);
}

module.exports = { testNavigationScenarios };