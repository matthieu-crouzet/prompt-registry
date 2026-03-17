/**
 * Unit tests for SetupStateManager
 * Tests specific examples and edge cases
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { SetupStateManager, SetupState } from '../../src/services/SetupStateManager';
import { HubManager } from '../../src/services/HubManager';

describe('SetupStateManager - Unit Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let mockHubManager: sinon.SinonStubbedInstance<HubManager>;
    let globalStateData: Map<string, any>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        globalStateData = new Map();

        mockContext = {
            globalState: {
                get: (key: string, defaultValue?: any) => globalStateData.get(key) ?? defaultValue,
                update: async (key: string, value: any) => {
                    globalStateData.set(key, value);
                },
                keys: () => Array.from(globalStateData.keys()),
                setKeysForSync: sandbox.stub()
            } as any,
            globalStorageUri: vscode.Uri.file('/mock/storage'),
            extensionPath: '/mock/extension',
            extensionUri: vscode.Uri.file('/mock/extension'),
            subscriptions: [],
            extensionMode: 1 as any // ExtensionMode.Production
        } as any as vscode.ExtensionContext;

        mockHubManager = sandbox.createStubInstance(HubManager);
        mockHubManager.listHubs.resolves([]);
        mockHubManager.getActiveHub.resolves(null);

        // Reset singleton
        SetupStateManager.resetInstance();
    });

    afterEach(() => {
        sandbox.restore();
        SetupStateManager.resetInstance();
    });

    describe('getInstance()', () => {
        it('should return singleton instance', () => {
            const instance1 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const instance2 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            
            expect(instance1, 'Should return same instance').toBe(instance2);
        });

        it('should create new instance after reset', () => {
            const instance1 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            SetupStateManager.resetInstance();
            const instance2 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            
            expect(instance1, 'Should return new instance after reset').not.toBe(instance2);
        });

        it('should throw error when context is missing on first call', () => {
            SetupStateManager.resetInstance();
            expect(() => SetupStateManager.getInstance(undefined, mockHubManager as any)).toThrow(/SetupStateManager requires context and hubManager on first call/);
        });

        it('should throw error when hubManager is missing on first call', () => {
            SetupStateManager.resetInstance();
            expect(() => SetupStateManager.getInstance(mockContext, undefined)).toThrow(/SetupStateManager requires context and hubManager on first call/);
        });

        it('should return existing instance without parameters after first call', () => {
            const instance1 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const instance2 = SetupStateManager.getInstance(); // No parameters
            
            expect(instance1, 'Should return same instance without parameters').toBe(instance2);
        });
    });

    describe('getState()', () => {
        it('should return NOT_STARTED by default', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const state = await manager.getState();
            
            expect(state).toBe(SetupState.NOT_STARTED);
        });

        it('should return stored state', async () => {
            globalStateData.set('promptregistry.setupState', SetupState.COMPLETE);
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const state = await manager.getState();
            
            expect(state).toBe(SetupState.COMPLETE);
        });

        it('should return NOT_STARTED for invalid state value', async () => {
            globalStateData.set('promptregistry.setupState', 'invalid_state');
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const state = await manager.getState();
            
            expect(state).toBe(SetupState.NOT_STARTED);
        });
    });

    describe('isComplete()', () => {
        it('should return true when state is COMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markComplete();
            
            const isComplete = await manager.isComplete();
            expect(isComplete).toBe(true);
        });

        it('should return false when state is not COMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markStarted();
            
            const isComplete = await manager.isComplete();
            expect(isComplete).toBe(false);
        });
    });

    describe('isIncomplete()', () => {
        it('should return true when state is INCOMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markIncomplete();
            
            const isIncomplete = await manager.isIncomplete();
            expect(isIncomplete).toBe(true);
        });

        it('should return false when state is not INCOMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markComplete();
            
            const isIncomplete = await manager.isIncomplete();
            expect(isIncomplete).toBe(false);
        });
    });

    describe('markStarted()', () => {
        it('should transition to IN_PROGRESS', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markStarted();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.IN_PROGRESS);
        });

        it('should persist state', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markStarted();
            
            const storedState = globalStateData.get('promptregistry.setupState');
            expect(storedState).toBe(SetupState.IN_PROGRESS);
        });
    });

    describe('markComplete()', () => {
        it('should transition to COMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markComplete();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.COMPLETE);
        });

    });

    describe('markIncomplete()', () => {
        it('should transition to INCOMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markIncomplete();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.INCOMPLETE);
        });
    });

    describe('reset()', () => {
        it('should transition to NOT_STARTED', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markComplete();
            await manager.reset();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.NOT_STARTED);
        });

        it('should reset resume prompt shown flag (in-memory)', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markIncomplete();
            await manager.markResumePromptShown();
            
            // Verify flag is set (prompt should not show)
            let shouldShow = await manager.shouldShowResumePrompt();
            expect(shouldShow, 'Should be false after marking shown').toBe(false);
            
            // Reset
            await manager.reset();
            
            // Flag should be reset (prompt should show again after marking incomplete)
            await manager.markIncomplete();
            shouldShow = await manager.shouldShowResumePrompt();
            expect(shouldShow, 'Should be true after reset').toBe(true);
        });
    });

    describe('detectIncompleteSetup()', () => {
        it('should return true when state is INCOMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markIncomplete();
            
            const isIncomplete = await manager.detectIncompleteSetup();
            expect(isIncomplete).toBe(true);
        });

        it('should return false when state is COMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markComplete();
            
            const isIncomplete = await manager.detectIncompleteSetup();
            expect(isIncomplete).toBe(false);
        });

        it('should detect incomplete from old flags (firstRun=false, no hub)', async () => {
            globalStateData.set('promptregistry.firstRun', false);
            globalStateData.set('promptregistry.hubInitialized', false);
            mockHubManager.listHubs.resolves([]);
            mockHubManager.getActiveHub.resolves(null);
            
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const isIncomplete = await manager.detectIncompleteSetup();
            
            expect(isIncomplete).toBe(true);
            // Should migrate to new state system
            const state = await manager.getState();
            expect(state).toBe(SetupState.INCOMPLETE);
        });

        it('should not detect incomplete when hub exists (backward compat)', async () => {
            globalStateData.set('promptregistry.firstRun', false);
            globalStateData.set('promptregistry.hubInitialized', false);
            mockHubManager.listHubs.resolves([{ id: 'hub1', name: 'Hub 1' }] as any);
            
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const isIncomplete = await manager.detectIncompleteSetup();
            
            expect(isIncomplete).toBe(false);
        });
    });

    describe('shouldShowResumePrompt()', () => {
        it('should return true when incomplete and prompt not shown', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markIncomplete();
            
            const shouldShow = await manager.shouldShowResumePrompt();
            expect(shouldShow).toBe(true);
        });

        it('should return false when incomplete but prompt already shown', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markIncomplete();
            await manager.markResumePromptShown();
            
            const shouldShow = await manager.shouldShowResumePrompt();
            expect(shouldShow).toBe(false);
        });

        it('should return false when setup is complete', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markComplete();
            
            const shouldShow = await manager.shouldShowResumePrompt();
            expect(shouldShow).toBe(false);
        });
    });

    describe('markResumePromptShown()', () => {
        it('should set resume prompt shown flag in-memory only', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markResumePromptShown();
            
            // Should NOT be persisted to globalState
            const promptShown = globalStateData.get('promptregistry.resumePromptShown');
            expect(promptShown, 'Should not persist to globalState').toBe(undefined);
            
            // But should affect shouldShowResumePrompt
            await manager.markIncomplete();
            const shouldShow = await manager.shouldShowResumePrompt();
            expect(shouldShow, 'Should remember within same instance').toBe(false);
        });

        it('should reset flag when instance is reset (session-scoped)', async () => {
            const manager1 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager1.markIncomplete();
            await manager1.markResumePromptShown();
            
            // Verify flag is set
            let shouldShow = await manager1.shouldShowResumePrompt();
            expect(shouldShow, 'Should be false after marking shown').toBe(false);
            
            // Reset instance (simulate new session)
            SetupStateManager.resetInstance();
            const manager2 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            
            // Flag should be reset
            shouldShow = await manager2.shouldShowResumePrompt();
            expect(shouldShow, 'Should be true in new instance (flag reset)').toBe(true);
        });
    });

    describe('state persistence', () => {
        it('should persist state across manager instances', async () => {
            const manager1 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager1.markIncomplete();
            
            SetupStateManager.resetInstance();
            const manager2 = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            const state = await manager2.getState();
            
            expect(state).toBe(SetupState.INCOMPLETE);
        });
    });

    describe('reset() from different states', () => {
        it('should reset from INCOMPLETE state', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markIncomplete();
            
            await manager.reset();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.NOT_STARTED);
        });

        it('should reset from IN_PROGRESS state', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markStarted();
            
            await manager.reset();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.NOT_STARTED);
        });

        it('should reset from COMPLETE state', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            await manager.markComplete();
            
            await manager.reset();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.NOT_STARTED);
        });
    });



    describe('state flow scenarios', () => {
        it('should handle fresh install flow: NOT_STARTED → IN_PROGRESS → COMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            
            // Initial state
            let state = await manager.getState();
            expect(state).toBe(SetupState.NOT_STARTED);
            
            // Start setup
            await manager.markStarted();
            state = await manager.getState();
            expect(state).toBe(SetupState.IN_PROGRESS);
            
            // Complete setup
            await manager.markComplete();
            state = await manager.getState();
            expect(state).toBe(SetupState.COMPLETE);
        });

        it('should handle cancellation flow: NOT_STARTED → IN_PROGRESS → INCOMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            
            await manager.markStarted();
            await manager.markIncomplete();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.INCOMPLETE);
            expect(await manager.isIncomplete()).toBe(true);
        });

        it('should handle resume flow: INCOMPLETE → IN_PROGRESS → COMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            
            // Start incomplete
            await manager.markIncomplete();
            
            // Resume
            await manager.markStarted();
            let state = await manager.getState();
            expect(state).toBe(SetupState.IN_PROGRESS);
            
            // Complete
            await manager.markComplete();
            state = await manager.getState();
            expect(state).toBe(SetupState.COMPLETE);
        });

        it('should handle skip and reset flow: INCOMPLETE → NOT_STARTED → COMPLETE', async () => {
            const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
            
            // Start incomplete and skip
            await manager.markIncomplete();
            await manager.markResumePromptShown();
            
            // Reset
            await manager.reset();
            let state = await manager.getState();
            expect(state).toBe(SetupState.NOT_STARTED);
            
            // Complete after reset
            await manager.markStarted();
            await manager.markComplete();
            state = await manager.getState();
            expect(state).toBe(SetupState.COMPLETE);
        });
    });

    describe('test environment detection', () => {
        it('should allow marking complete in test environment (VSCODE_TEST)', async () => {
            const originalEnv = process.env.VSCODE_TEST;
            try {
                process.env.VSCODE_TEST = '1';
                
                const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
                await manager.markComplete();
                
                const state = await manager.getState();
                expect(state).toBe(SetupState.COMPLETE);
            } finally {
                if (originalEnv === undefined) {
                    delete process.env.VSCODE_TEST;
                } else {
                    process.env.VSCODE_TEST = originalEnv;
                }
            }
        });

        it('should allow marking complete in ExtensionMode.Test', async () => {
            const testContext = {
                ...mockContext,
                extensionMode: 3 as any // ExtensionMode.Test
            } as vscode.ExtensionContext;
            
            SetupStateManager.resetInstance();
            const manager = SetupStateManager.getInstance(testContext, mockHubManager as any);
            await manager.markComplete();
            
            const state = await manager.getState();
            expect(state).toBe(SetupState.COMPLETE);
        });
    });
});
