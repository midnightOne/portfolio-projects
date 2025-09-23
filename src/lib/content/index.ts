/**
 * Content Ingestion System Exports
 * 
 * This module exports all components of the hybrid content ingestion system
 * including the main service, UIManager integration, and related types.
 */

// Main content ingestion service
export { default as ContentIngestionService } from './ContentIngestionService';
export type {
  TierContent,
  ContentIngestionResult,
  UserDefinedTierMarkers,
  IngestionProgress,
  ContentIngestionEvents
} from './ContentIngestionService';

// UIManager integration
export {
  UIManagerContentIntegration,
  initializeUIManagerIntegration,
  getUIManagerIntegration,
  setUIManagerForIntegration
} from './UIManagerIntegration';

// Re-export existing content ingestion for backward compatibility
export { ContentIngestionPipeline } from '../services/content-ingestion';
export type { ContentIngestionResult as LegacyContentIngestionResult } from '../services/content-ingestion';