# Semantic System Manual Testing Guide

This guide provides step-by-step instructions for manually testing all components of the semantic content management system through the admin interface.

## Prerequisites

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Access admin panel**:
   - Navigate to `http://localhost:3000/admin`
   - Login with admin credentials (username: `admin`, password: `admin2025`)

3. **Ensure you have projects with content**:
   - At least one published project with article content
   - If needed, create/edit a project and add some content

## 🚀 Quick Start for New Projects

**If you're testing with a new project that shows "Content entity not found":**

1. **Use the Ingestion API** (via Postman, curl, or browser dev tools):
   ```bash
   POST http://localhost:3000/api/admin/semantic/ingest
   Content-Type: application/json
   
   {"projectId": "your-project-slug"}
   ```

2. **Expected Response**:
   ```json
   {
     "success": true,
     "message": "Initial content ingestion completed successfully",
     "result": {
       "tiersCreated": [0, 1, 2, 3],
       "totalChunks": 15,
       "embeddingsGenerated": 15,
       "costEstimate": 0.0234
     }
   }
   ```

3. **Then proceed with normal testing** - the project will now have semantic content

## 🎯 Testing Checklist

### 1. Semantic Dashboard Overview

**Location**: `/admin` → "Semantic Dashboard" tab

**What to test**:
- [ ] Dashboard loads without errors
- [ ] Vector index health metrics display
- [ ] Budget status shows current allocation
- [ ] Project status list shows all projects
- [ ] Cost analytics display spending breakdown
- [ ] Health indicators show system status

**Expected results**:
- Green health indicators for properly indexed projects
- Budget utilization percentage
- Project-by-project semantic health status
- Total chunks and embedding counts

**Screenshots to take**:
- Overall dashboard view
- Health metrics section
- Budget status section

---

### 2. Content Ingestion & Generation

**Location**: `/admin` → "Semantic Dashboard" → Select a project

**Test A: Initial Content Ingestion (New Projects)**
- [ ] For a new project without semantic content, use: `POST /api/admin/semantic/ingest`
- [ ] Body: `{"projectId": "your-project-slug"}`
- [ ] Observe T0-T3 tier generation using SmartContentGenerator
- [ ] Check that importance scores are assigned
- [ ] Confirm embeddings are generated
- [ ] Verify hierarchical relationships are created

**Test B: Content Regeneration (Existing Projects)**
- [ ] For existing projects, use: `POST /api/admin/semantic/regenerate`
- [ ] Body: `{"scope": "project", "projectId": "your-project-slug"}`
- [ ] Observe selective regeneration
- [ ] Check cost savings from unchanged sections
- [ ] Verify only modified content is regenerated

**Test B: Smart Content Generation**
- [ ] Edit a project's article content
- [ ] Save the project
- [ ] Trigger regeneration
- [ ] Verify only changed sections are regenerated
- [ ] Check cost savings are reported

**Expected results**:
- T0: Metadata (1 chunk)
- T1: Project summary (1 chunk)
- T2: Section summaries (multiple chunks)
- T3: Content chunks (multiple chunks)
- Importance scores between 0-1
- Hierarchical relationships preserved

---

### 3. Summary Generation Testing

**Location**: `/admin` → "Semantic Dashboard" → "Summary Generation"

**Test A: T1 Summary Generation**
- [ ] Select a project
- [ ] Choose "Generate T1 Summary"
- [ ] Review generated summary quality
- [ ] Check confidence score
- [ ] Verify hallucination risk assessment

**Test B: T2 Summary Generation**
- [ ] Select a project section
- [ ] Choose "Generate T2 Summary"
- [ ] Compare with original content
- [ ] Check factual accuracy preservation
- [ ] Verify technical terms are preserved

**Test C: Quality Controls**
- [ ] Generate summaries with different configurations
- [ ] Test "High Quality (GPT-4o)" config
- [ ] Test "Cost Optimized" config
- [ ] Compare quality metrics between configs

**Expected results**:
- T1 summaries: 50-100 words, high-level overview
- T2 summaries: 100-200 words, section-specific details
- Confidence scores > 0.7 for good content
- Low hallucination risk for factual content
- Preserved technical terms and project names

---

### 4. Semantic Search Testing

**Location**: `/admin` → "Tool Testing Interface"

**Test A: Basic Semantic Search**
- [ ] Enter query: "javascript react"
- [ ] Execute `content_search` tool
- [ ] Review search results
- [ ] Check importance-based ranking
- [ ] Verify result diversity

**Test B: Project-Scoped Search**
- [ ] Set scope to specific project
- [ ] Search for project-specific terms
- [ ] Verify results are project-filtered
- [ ] Check navigation targets are correct

**Test C: Tier-Filtered Search**
- [ ] Set `maxTier` to 1 (summaries only)
- [ ] Set `maxTier` to 3 (all content)
- [ ] Compare result quality and relevance
- [ ] Verify tier filtering works correctly

**Expected results**:
- Results ranked by combined similarity + importance
- Project-scoped searches return only relevant project content
- Tier filtering limits results appropriately
- Navigation targets point to correct content sections

---

### 5. Chunk Editor & Management

**Location**: `/admin` → "Semantic Dashboard" → "Chunk Editor"

**Test A: Chunk Editing**
- [ ] Select a semantic chunk
- [ ] Edit the content
- [ ] Update importance score
- [ ] Save changes
- [ ] Verify changes persist

**Test B: AI-Assisted Editing**
- [ ] Select a chunk
- [ ] Use "AI Edit" feature
- [ ] Review AI suggestions
- [ ] Accept/reject changes
- [ ] Check quality improvements

**Test C: Hierarchical Navigation**
- [ ] View chunk hierarchy
- [ ] Navigate parent-child relationships
- [ ] Verify derivation paths are correct
- [ ] Check section groupings

**Expected results**:
- Chunk content updates successfully
- Importance scores affect search ranking
- AI suggestions improve content quality
- Hierarchical relationships are maintained

---

### 6. Budget Management Testing

**Location**: `/admin` → "Budget Manager"

**Test A: Budget Allocation**
- [ ] Set monthly budget limit
- [ ] Allocate funds for different operations
- [ ] Save budget configuration
- [ ] Verify budget tracking is active

**Test B: Cost Monitoring**
- [ ] Perform expensive operations (embedding generation)
- [ ] Monitor real-time cost tracking
- [ ] Check budget utilization updates
- [ ] Verify warnings at 80% usage

**Test C: Cost Optimization**
- [ ] Compare batch vs. immediate embedding costs
- [ ] Test different AI models (gpt-4o-mini vs gpt-4o)
- [ ] Review cost per chunk metrics
- [ ] Analyze cost trends over time

**Expected results**:
- Budget limits are enforced
- Real-time cost tracking works
- Warnings appear before budget exhaustion
- Cost optimization recommendations are provided

---

### 7. Bulk Operations Testing

**Location**: `/admin` → "Bulk Operations"

**Test A: Bulk Regeneration**
- [ ] Select multiple projects
- [ ] Choose "Regenerate All"
- [ ] Monitor progress indicators
- [ ] Check completion status
- [ ] Verify all projects are updated

**Test B: Bulk Cleanup**
- [ ] Run "Cleanup Orphaned Chunks"
- [ ] Review cleanup report
- [ ] Verify database integrity
- [ ] Check performance improvements

**Test C: Batch Embedding Generation**
- [ ] Queue multiple projects for embedding
- [ ] Monitor batch job status
- [ ] Check 50% cost savings
- [ ] Verify completion notifications

**Expected results**:
- Bulk operations complete successfully
- Progress tracking works correctly
- Cost savings are realized with batch operations
- Database remains consistent after cleanup

---

### 8. Health Monitoring Testing

**Location**: `/admin` → "System Health"

**Test A: Health Dashboard**
- [ ] View overall system health
- [ ] Check database performance metrics
- [ ] Review embedding coverage
- [ ] Monitor search latency

**Test B: Issue Detection**
- [ ] Identify performance bottlenecks
- [ ] Review health recommendations
- [ ] Check cost utilization warnings
- [ ] Verify data integrity alerts

**Test C: Performance Metrics**
- [ ] Run performance tests
- [ ] Check search latency (p50, p95, p99)
- [ ] Monitor embedding generation times
- [ ] Review cache hit rates

**Expected results**:
- Health status shows "healthy" for well-maintained system
- Performance metrics are within acceptable ranges
- Issues are detected and recommendations provided
- Trends show system stability over time

---

### 9. Integration Testing

**Test A: Voice AI Integration**
- [ ] Use voice interface to search content
- [ ] Verify F-I-D context includes semantic data
- [ ] Check navigation to semantic chunks
- [ ] Test project-specific voice queries

**Test B: Project Editor Integration**
- [ ] Edit project content in main editor
- [ ] Trigger automatic regeneration
- [ ] Verify change detection works
- [ ] Check selective regeneration

**Test C: API Integration**
- [ ] Test `/api/semantic/chunks/[projectId]` endpoint
- [ ] Verify PassiveFIDManager integration
- [ ] Check client-side AI compatibility
- [ ] Test cross-component data flow

**Expected results**:
- Voice AI uses semantic search results
- Project editor triggers appropriate regeneration
- APIs return correct semantic data
- All integrations work seamlessly

---

## 🐛 Common Issues & Troubleshooting

### Issue: "Content entity not found for project"
**Solution**: For new projects, use the ingestion API first: `POST /api/admin/semantic/ingest` with `{"projectId": "project-slug"}`

### Issue: "No embeddings found"
**Solution**: Run content ingestion for the project first using the ingestion API

### Issue: "Budget exceeded"
**Solution**: Increase budget allocation or use cost-optimized settings

### Issue: "Search returns no results"
**Solution**: Ensure projects have been indexed and embeddings generated

### Issue: "Slow performance"
**Solution**: Check database indexes and consider cleanup operations

### Issue: "AI generation fails"
**Solution**: Verify OPENAI_API_KEY is set and has sufficient credits

### Issue: "getOperationHistory is not a function"
**Solution**: This has been fixed - the health monitor now uses `getSpendingHistory` instead

---

## 📊 Success Metrics

After testing, you should see:

- **Search Quality**: Relevant results with importance-based ranking
- **Generation Quality**: High-confidence summaries with low hallucination risk
- **Performance**: Search latency < 2 seconds, embedding generation < 30 seconds
- **Cost Efficiency**: Batch operations show 50% cost savings
- **System Health**: Overall status "healthy" with no critical issues

---

## 📝 Testing Checklist Summary

- [ ] Dashboard displays comprehensive metrics
- [ ] Content ingestion generates T0-T3 tiers correctly
- [ ] Summary generation produces high-quality, factual summaries
- [ ] Semantic search returns relevant, importance-ranked results
- [ ] Chunk editor allows content and importance management
- [ ] Budget management enforces limits and tracks costs
- [ ] Bulk operations handle multiple projects efficiently
- [ ] Health monitoring detects issues and provides recommendations
- [ ] All integrations work seamlessly across components

**Testing Complete**: ✅ All semantic system components verified and working correctly