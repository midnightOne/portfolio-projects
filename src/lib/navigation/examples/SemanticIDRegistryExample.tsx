/**
 * SemanticIDRegistry Usage Examples
 * 
 * This file demonstrates how to use the Semantic ID Registry system
 * for stable, maintainable navigation targeting.
 */

import React, { useEffect, useState } from 'react';
import { getSemanticIDRegistry, initializeSemanticIDRegistry } from '../SemanticIDRegistry';
import { UIManager } from '../UIManager';

/**
 * Example component showing how to use semantic IDs in HTML
 */
export const SemanticIDExampleComponent: React.FC = () => {
  const [registryStatus, setRegistryStatus] = useState<string>('Not initialized');
  const [availableSemanticIds, setAvailableSemanticIds] = useState<string[]>([]);

  useEffect(() => {
    // Initialize the semantic ID registry
    const registry = initializeSemanticIDRegistry();
    setRegistryStatus('Initialized');

    // Get available semantic IDs
    setAvailableSemanticIds(registry.getAllSemanticIDs());

    // Register custom semantic IDs programmatically
    registry.registerSemanticID('hero-cta', {
      selector: '[data-semantic-id="hero-cta"], .hero-cta-button, #hero-cta',
      aliases: ['hero-button', 'main-cta', 'get-started'],
      fallbackId: 'hero-cta',
      context: 'homepage'
    });

    registry.registerSemanticID('project-showcase', {
      selector: '[data-semantic-id="project-showcase"], .project-grid, #projects-grid',
      aliases: ['portfolio-grid', 'work-samples', 'project-list'],
      fallbackId: 'projects',
      context: 'homepage'
    });

    // Update available IDs after registration
    setAvailableSemanticIds(registry.getAllSemanticIDs());

    // Example of using UIManager with semantic navigation
    const uiManager = UIManager.getInstance();
    uiManager.initialize();

    // Example navigation using semantic IDs
    const handleSemanticNavigation = async () => {
      try {
        // Navigate using semantic ID with fallback
        await uiManager.executeIntent({
          target: {
            type: 'semantic',
            semanticId: 'hero-cta',
            fallbackId: 'hero'
          },
          behavior: {
            scrollBehavior: 'smooth',
            openIfNeeded: true
          }
        });
      } catch (error) {
        console.error('Semantic navigation failed:', error);
      }
    };

    // Store navigation function for demo
    (window as any).demoSemanticNavigation = handleSemanticNavigation;

  }, []);

  return (
    <div className="semantic-id-example">
      <h2>Semantic ID Registry Example</h2>
      
      <div className="registry-status">
        <h3>Registry Status</h3>
        <p>Status: {registryStatus}</p>
        <p>Available Semantic IDs: {availableSemanticIds.length}</p>
      </div>

      <div className="semantic-elements">
        <h3>Example Elements with Semantic IDs</h3>
        
        {/* Hero section with semantic ID */}
        <section 
          data-semantic-id="hero-cta"
          data-semantic-aliases="hero-button,main-cta,get-started"
          data-semantic-context="homepage"
          className="hero-section"
          id="hero-cta"
        >
          <h1>Welcome to My Portfolio</h1>
          <button className="hero-cta-button">Get Started</button>
        </section>

        {/* About section with semantic ID */}
        <section 
          data-semantic-id="about"
          data-semantic-aliases="bio,background,profile"
          className="about-section"
          id="about-section"
        >
          <h2>About Me</h2>
          <p>This section has a semantic ID of "about" with aliases.</p>
        </section>

        {/* Projects section with semantic ID */}
        <section 
          data-semantic-id="project-showcase"
          data-semantic-aliases="portfolio-grid,work-samples,project-list"
          data-semantic-context="homepage"
          className="projects-section"
          id="projects-grid"
        >
          <h2>My Projects</h2>
          <div className="project-grid">
            <div className="project-card">Project 1</div>
            <div className="project-card">Project 2</div>
            <div className="project-card">Project 3</div>
          </div>
        </section>

        {/* Contact section with semantic ID */}
        <section 
          data-semantic-id="contact"
          data-semantic-aliases="contact-form,get-in-touch,reach-out"
          className="contact-section"
          id="contact-form"
        >
          <h2>Contact Me</h2>
          <form>
            <input type="email" placeholder="Your email" />
            <textarea placeholder="Your message"></textarea>
            <button type="submit">Send Message</button>
          </form>
        </section>
      </div>

      <div className="semantic-navigation-demo">
        <h3>Semantic Navigation Demo</h3>
        <p>Open browser console and run: <code>demoSemanticNavigation()</code></p>
        <p>Or use UIManager directly:</p>
        <ul>
          <li><code>UIManager.getInstance().resolveSemanticID('hero-cta')</code></li>
          <li><code>UIManager.getInstance().validateSemanticID('about')</code></li>
          <li><code>UIManager.getInstance().executeIntent({`{target: {type: 'semantic', semanticId: 'contact'}}`})</code></li>
        </ul>
      </div>

      <div className="available-semantic-ids">
        <h3>Available Semantic IDs</h3>
        <ul>
          {availableSemanticIds.map(id => (
            <li key={id}>
              <code>{id}</code>
              <button 
                onClick={async () => {
                  const registry = getSemanticIDRegistry();
                  const element = registry.resolveSemanticID(id);
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.classList.add('highlight');
                    setTimeout(() => element.classList.remove('highlight'), 2000);
                  }
                }}
              >
                Navigate
              </button>
            </li>
          ))}
        </ul>
      </div>

      <style jsx>{`
        .semantic-id-example {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .registry-status, .semantic-elements, .semantic-navigation-demo, .available-semantic-ids {
          margin: 30px 0;
          padding: 20px;
          border: 1px solid #e1e5e9;
          border-radius: 8px;
          background: #f8f9fa;
        }

        .hero-section, .about-section, .projects-section, .contact-section {
          margin: 20px 0;
          padding: 20px;
          border: 2px solid #007bff;
          border-radius: 8px;
          background: white;
        }

        .project-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .project-card {
          padding: 15px;
          border: 1px solid #dee2e6;
          border-radius: 4px;
          background: #f8f9fa;
          text-align: center;
        }

        .hero-cta-button, button {
          background: #007bff;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
        }

        .hero-cta-button:hover, button:hover {
          background: #0056b3;
        }

        .highlight {
          outline: 3px solid #ffc107 !important;
          outline-offset: 2px !important;
          background: #fff3cd !important;
          transition: all 0.3s ease;
        }

        code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 0.9em;
        }

        ul {
          list-style-type: disc;
          padding-left: 20px;
        }

        li {
          margin: 8px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        form {
          display: flex;
          flex-direction: column;
          gap: 10px;
          max-width: 400px;
        }

        input, textarea {
          padding: 10px;
          border: 1px solid #ced4da;
          border-radius: 4px;
        }

        textarea {
          min-height: 100px;
          resize: vertical;
        }
      `}</style>
    </div>
  );
};

/**
 * Usage Guide for Semantic ID Registry
 */
export const SemanticIDUsageGuide = {
  /**
   * 1. HTML Markup with Semantic IDs
   */
  htmlMarkup: `
    <!-- Basic semantic ID -->
    <section data-semantic-id="contact" id="contact-form">
      <h2>Contact Me</h2>
      <!-- content -->
    </section>

    <!-- Semantic ID with aliases -->
    <section 
      data-semantic-id="hero-cta"
      data-semantic-aliases="hero-button,main-cta,get-started"
      data-semantic-context="homepage"
      id="hero-section"
    >
      <h1>Welcome</h1>
      <button class="hero-cta-button">Get Started</button>
    </section>

    <!-- Semantic ID with context -->
    <div 
      data-semantic-id="project-overview"
      data-semantic-context="project"
      id="overview-section"
    >
      <h3>Project Overview</h3>
      <!-- content -->
    </div>
  `,

  /**
   * 2. Programmatic Registration
   */
  programmaticRegistration: `
    import { getSemanticIDRegistry } from '@/lib/navigation/SemanticIDRegistry';

    const registry = getSemanticIDRegistry();

    // Register a semantic ID
    registry.registerSemanticID('custom-feature', {
      selector: '[data-semantic-id="custom-feature"], #custom-feature, .custom-feature',
      aliases: ['feature', 'special-section', 'highlight'],
      fallbackId: 'custom-feature',
      context: 'homepage'
    });

    // Unregister if needed
    registry.unregisterSemanticID('custom-feature');
  `,

  /**
   * 3. Navigation with UIManager
   */
  navigationUsage: `
    import { UIManager } from '@/lib/navigation/UIManager';

    const uiManager = UIManager.getInstance();

    // Navigate using semantic ID with fallback
    await uiManager.executeIntent({
      target: {
        type: 'semantic',
        semanticId: 'contact',
        fallbackId: 'contact-form'
      },
      behavior: {
        scrollBehavior: 'smooth',
        openIfNeeded: true
      }
    });

    // Resolve semantic ID to element
    const element = uiManager.resolveSemanticID('hero-cta');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }

    // Validate semantic ID
    const isValid = await uiManager.validateSemanticID('about');
    console.log('About section exists:', isValid);
  `,

  /**
   * 4. Voice Agent Integration
   */
  voiceAgentIntegration: `
    // Voice agents can use semantic navigation
    const toolCall = {
      name: 'ui_navigate',
      parameters: {
        target: {
          type: 'semantic',
          semanticId: 'contact',
          fallbackId: 'contact-form'
        },
        behavior: {
          scrollBehavior: 'smooth'
        }
      }
    };

    // Or search for content semantically
    const searchResults = await registry.searchContent('portfolio');
    // Returns: [{ semanticId: 'projects', title: 'Projects', relevance: 80, ... }]
  `,

  /**
   * 5. Best Practices
   */
  bestPractices: [
    'Use descriptive semantic IDs that reflect the content purpose, not visual appearance',
    'Always provide fallback IDs for graceful degradation',
    'Use aliases to support natural language variations',
    'Add context attributes for sections that appear in multiple contexts',
    'Validate semantic IDs in tests to ensure they remain stable',
    'Use the registry validation to detect conflicts and missing elements',
    'Initialize the registry early in your application lifecycle',
    'Consider semantic IDs as part of your component API'
  ]
};

export default SemanticIDExampleComponent;