/**
 * Project Editor Integration Tests
 * 
 * Tests the integration between project editor and semantic content management.
 */

import { ProjectEditorIntegration } from '../ProjectEditorIntegration';

// Mock dependencies
jest.mock('../ContentChangeDetector');
jest.mock('../SelectiveSectionRegenerator');
jest.mock('@prisma/client');

describe('ProjectEditorIntegration', () => {
    let integration: ProjectEditorIntegration;

    beforeEach(() => {
        integration = ProjectEditorIntegration.getInstance();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = ProjectEditorIntegration.getInstance();
            const instance2 = ProjectEditorIntegration.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('onProjectSave', () => {
        it('should handle project save without errors', async () => {
            const result = await integration.onProjectSave('test-project', 'test content');

            expect(result).toBeDefined();
            expect(result.changeDetected).toBeDefined();
            expect(result.changeScope).toBeDefined();
            expect(result.recommendedAction).toBeDefined();
            expect(result.affectedSections).toBeDefined();
            expect(result.estimatedCost).toBeDefined();
            expect(result.regenerationTriggered).toBeDefined();
        });
    });

    describe('getSemanticStatusIndicators', () => {
        it('should return status indicators for projects', async () => {
            const indicators = await integration.getSemanticStatusIndicators(['test-project']);

            expect(Array.isArray(indicators)).toBe(true);
            expect(indicators.length).toBe(1);

            const indicator = indicators[0];
            expect(indicator.projectId).toBe('test-project');
            expect(indicator.hasSemanticIndex).toBeDefined();
            expect(indicator.chunkCount).toBeDefined();
            expect(indicator.tierDistribution).toBeDefined();
            expect(indicator.healthStatus).toBeDefined();
            expect(indicator.needsRegeneration).toBeDefined();
        });
    });

    describe('getProjectSemanticStatus', () => {
        it('should return status for single project', async () => {
            const status = await integration.getProjectSemanticStatus('test-project');

            expect(status.projectId).toBe('test-project');
            expect(status.hasSemanticIndex).toBeDefined();
            expect(status.healthStatus).toBeDefined();
        });
    });
});