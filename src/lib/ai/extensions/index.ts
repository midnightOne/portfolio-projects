/**
 * AI Extensions - Function registry and system operations
 */

export { AIFunctionRegistry, aiRegistry } from './function-registry';
export * from './types';
export * from './functions';
export * from './bulk-operations';

// Initialize default functions
import { aiRegistry } from './function-registry';
import { BulkEditFunction, AnalyticsFunction, ContentFunction } from './functions';

// Register default system functions
const bulkEditFunction = new BulkEditFunction();
const analyticsFunction = new AnalyticsFunction();
const contentFunction = new ContentFunction();

aiRegistry.register(bulkEditFunction);
aiRegistry.register(analyticsFunction);
aiRegistry.register(contentFunction);

export { bulkEditFunction, analyticsFunction, contentFunction };