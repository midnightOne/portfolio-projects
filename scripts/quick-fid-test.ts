#!/usr/bin/env tsx

import { contextFrameManager } from '../src/lib/ai/ContextFrameManager';

async function quickTest() {
  try {
    console.log('Testing F-I-D Context Manager...');
    
    const context = await contextFrameManager.getCompleteContext({ route: 'home' });
    
    console.log('✅ F-I-D Context loaded successfully:', {
      frameTokens: context.frame.tokenCount,
      indexTokens: context.index.tokenCount,
      detailsTokens: context.details.tokenCount,
      totalTokens: context.totalTokens,
      projectSummaries: context.index.projectSummaries.length,
      budgetExceeded: context.budgetExceeded
    });
    
    console.log('✅ Project summaries:', context.index.projectSummaries.map(p => ({
      slug: p.slug,
      title: p.title,
      importance: p.importance
    })));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

quickTest();