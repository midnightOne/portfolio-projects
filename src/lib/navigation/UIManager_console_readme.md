🖥️ Console API (Development Only)
Quick Access Functions:
// State inspection
describeUI()           // Get complete UI description with nice logging
getUIState()           // Get current UI state
getModalStack()        // Get open modals
getCurrentProject()    // Get active project

// Navigation helpers  
navigateTo({type: "section", id: "about"})
openProject("portfolio-website", "technical-details")
goToSection("contact")

// Full API access
window.UIManager       // Complete UIManager instance


📊 Console Output Examples
Quick DescribeUI:
// In console:
await describeUI()
// Returns description object + logs formatted output

Navigation Testing:
// Navigate to sections
goToSection("projects")
goToSection("contact")

// Open project modals
openProject("e-commerce-platform")
openProject("portfolio-website", "gallery")

// Complex navigation
navigateTo({
  type: "project", 
  id: "task-management-app", 
  sectionId: "technical-details"
})


State Inspection:
// Check current state
getUIState()
getModalStack()
getCurrentProject()

// Check what's available
const desc = await describeUI()
console.log(desc.sections)      // Available sections
console.log(desc.transitions)   // Available actions

🎯 Benefits
For Development:
Instant Access: No need to open debug panel or click buttons
Script Testing: Can write test scripts in console
State Debugging: Quick inspection of complex UI state
Navigation Testing: Test declarative navigation directly
For AI Integration:
Same Data: Console gets exact same data as AI tools
Easy Verification: Verify what AI sees vs actual state
Debug Mismatches: Compare AI expectations with reality
For Production Debugging:
Development Only: Only available in dev mode for security
No Performance Impact: Only loads when UIManager initializes
Clean Console: Organized output with emojis and grouping
🚀 Usage Examples
Test the navigation system:
// Open project modal, then test switching
await openProject("portfolio-website")
await openProject("e-commerce-platform", "technical-details")

Debug AI context:
// What does AI see?
const aiContext = await describeUI()
console.log("AI sees these sections:", aiContext.sections)
console.log("AI can perform these actions:", aiContext.transitions)

Monitor state changes:
// Before action
const before = getUIState()
// Perform action...
const after = getUIState()
// Compare states