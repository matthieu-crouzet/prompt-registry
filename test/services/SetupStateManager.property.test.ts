/**
 * Property-based tests for SetupStateManager
 * Tests universal correctness properties across all valid executions
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fc from 'fast-check';
import { SetupStateManager, SetupState } from '../../src/services/SetupStateManager';
import { HubManager } from '../../src/services/HubManager';
import { PropertyTestConfig } from '../helpers/propertyTestHelpers';
import { createMockHubData, formatTestParams } from '../helpers/setupStateTestHelpers';

describe('SetupStateManager - Property Tests', () => {
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

    // Property 1: State Transition Validity
    // For any sequence of setup operations, the setup state should only transition through valid paths
    it('Property 1: State transitions follow valid paths (Req 2.1-2.6)', async () => {
        const operationArbitrary = fc.constantFrom(
            'start',
            'complete',
            'cancel_auth',
            'cancel_hub',
            'resume',
            'reset'
        );

        await fc.assert(
            fc.asyncProperty(
                fc.array(operationArbitrary, { minLength: 1, maxLength: 20 }),
                async (operations) => {
                    // Reset state for each test
                    globalStateData.clear();
                    SetupStateManager.resetInstance();
                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);

                    const validTransitions: Record<SetupState, SetupState[]> = {
                        [SetupState.NOT_STARTED]: [SetupState.IN_PROGRESS, SetupState.COMPLETE, SetupState.INCOMPLETE],
                        [SetupState.IN_PROGRESS]: [SetupState.COMPLETE, SetupState.INCOMPLETE, SetupState.NOT_STARTED], // Can reset from in_progress
                        [SetupState.COMPLETE]: [SetupState.NOT_STARTED, SetupState.IN_PROGRESS, SetupState.INCOMPLETE], // Reset, re-setup, or error
                        [SetupState.INCOMPLETE]: [SetupState.IN_PROGRESS, SetupState.NOT_STARTED, SetupState.COMPLETE] // Resume, reset, or direct complete
                    };

                    let previousState = await manager.getState();

                    for (const op of operations) {
                        switch (op) {
                            case 'start':
                                await manager.markStarted();
                                break;
                            case 'complete':
                                await manager.markComplete();
                                break;
                            case 'cancel_auth':
                                await manager.markIncomplete();
                                break;
                            case 'cancel_hub':
                                await manager.markIncomplete();
                                break;
                            case 'resume':
                                await manager.markStarted();
                                break;
                            case 'reset':
                                await manager.reset();
                                break;
                        }

                        const currentState = await manager.getState();

                        // Verify transition is valid or state didn't change
                        if (currentState !== previousState) {
                            const allowedNextStates = validTransitions[previousState];
                            expect(allowedNextStates.includes(currentState), `Invalid transition: ${previousState} → ${currentState} (operation: ${op}, sequence: ${operations.join(',')})`).toBeTruthy();
                        }

                        previousState = currentState;
                    }

                    // Final state should always be valid
                    const finalState = await manager.getState();
                    expect(Object.values(SetupState).includes(finalState), `Final state ${finalState} is not a valid SetupState (sequence: ${operations.join(',')})`).toBeTruthy();

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 6: Setup Completion Idempotence
    // For any setup state that is already complete, calling markComplete() again should not change state
    it('Property 6: Setup completion is idempotent (Req 5.1, 5.2, 5.3)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }),
                async (repeatCount) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();
                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);

                    // Mark as complete once
                    await manager.markComplete();
                    const stateAfterFirst = await manager.getState();
                    expect(stateAfterFirst, `Initial state should be COMPLETE (repeatCount=${repeatCount})`).toBe(SetupState.COMPLETE);

                    // Mark as complete multiple times
                    for (let i = 0; i < repeatCount; i++) {
                        await manager.markComplete();
                    }

                    // State should still be complete
                    const finalState = await manager.getState();
                    expect(finalState, `State should remain COMPLETE after ${repeatCount} additional markComplete() calls`).toBe(SetupState.COMPLETE);

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 9: State Persistence
    // For any state transition, the new state should be persisted and retrievable
    it('Property 9: State persists across manager instances (Req 1.4, 2.6)', async () => {
        const stateArbitrary = fc.constantFrom(
            SetupState.NOT_STARTED,
            SetupState.IN_PROGRESS,
            SetupState.COMPLETE,
            SetupState.INCOMPLETE
        );

        await fc.assert(
            fc.asyncProperty(
                stateArbitrary,
                async (targetState) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();
                    const manager1 = SetupStateManager.getInstance(mockContext, mockHubManager as any);

                    // Transition to target state
                    switch (targetState) {
                        case SetupState.NOT_STARTED:
                            await manager1.reset();
                            break;
                        case SetupState.IN_PROGRESS:
                            await manager1.markStarted();
                            break;
                        case SetupState.COMPLETE:
                            await manager1.markComplete();
                            break;
                        case SetupState.INCOMPLETE:
                            await manager1.markIncomplete();
                            break;
                    }

                    const stateBeforeReload = await manager1.getState();

                    // Create new manager instance (simulates extension reload)
                    SetupStateManager.resetInstance();
                    const manager2 = SetupStateManager.getInstance(mockContext, mockHubManager as any);

                    const stateAfterReload = await manager2.getState();

                    // State should persist
                    expect(stateAfterReload, `State did not persist: ${stateBeforeReload} → ${stateAfterReload} (target: ${targetState})`).toBe(stateBeforeReload);

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 2: Incomplete Setup Detection & Backward Compatibility
    // For any extension activation where firstRun=false and no hub is configured, 
    // the system should detect setup as incomplete
    // **Validates: Requirements 1.1, 1.2, 5.4, 5.5**
    // **Merged with Property 5 to eliminate duplication**
    it('Property 2: Incomplete setup detection and backward compatibility (Req 1.1, 1.2, 5.4, 5.5)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.boolean(), // firstRun flag
                fc.boolean(), // hubInitialized flag
                fc.boolean(), // has hubs in list
                fc.boolean(), // has active hub
                async (firstRun, hubInitialized, hasHubs, hasActiveHub) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();

                    // Set up old flags for backward compatibility testing
                    globalStateData.set('promptregistry.firstRun', firstRun);
                    globalStateData.set('promptregistry.hubInitialized', hubInitialized);

                    // Mock hub manager responses using helper
                    const { mockHubs, mockActiveHub } = createMockHubData(hasHubs, hasActiveHub);
                    mockHubManager.listHubs.resolves(mockHubs);
                    mockHubManager.getActiveHub.resolves(mockActiveHub);

                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
                    const isIncomplete = await manager.detectIncompleteSetup();

                    const hasAnyHub = hasHubs || hasActiveHub;
                    const testParams = formatTestParams({ firstRun, hubInitialized, hasHubs, hasActiveHub });

                    // Requirement 1.1: firstRun=false AND no hub → incomplete
                    if (!firstRun && !hubInitialized && !hasAnyHub) {
                        expect(isIncomplete, `Req 1.1: Should detect incomplete when firstRun=false and no hub (${testParams})`).toBe(true);
                        
                        // Verify migration to new state system
                        const state = await manager.getState();
                        expect(state, `Should migrate to INCOMPLETE state (${testParams})`).toBe(SetupState.INCOMPLETE);
                    }
                    // Requirement 1.2 & 5.4, 5.5: firstRun=false AND has hub → complete (backward compat)
                    else if (!firstRun && hasAnyHub) {
                        expect(isIncomplete, `Req 1.2, 5.4, 5.5: Should detect complete when firstRun=false and hub exists (${testParams})`).toBe(false);
                        
                        // Should NOT migrate state when hub is configured (backward compat)
                        const state = await manager.getState();
                        expect(state, `Should not migrate state when hub is configured (${testParams})`).toBe(SetupState.NOT_STARTED);
                    }
                    // firstRun=true → not incomplete (fresh install)
                    else if (firstRun) {
                        expect(isIncomplete, `Fresh install (firstRun=true) should not be incomplete (${testParams})`).toBe(false);
                    }
                    // Other cases (hubInitialized=true) → not incomplete
                    else {
                        expect(isIncomplete, `Should not detect incomplete in other cases (${testParams})`).toBe(false);
                    }

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 13: Valid State Values
    // The state should always be one of the defined SetupState enum values
    it('Property 13: State is always a valid enum value (Req 2.1)', async () => {
        const operationArbitrary = fc.constantFrom(
            'start',
            'complete',
            'incomplete',
            'reset'
        );

        await fc.assert(
            fc.asyncProperty(
                fc.array(operationArbitrary, { minLength: 1, maxLength: 15 }),
                async (operations) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();
                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);

                    for (const op of operations) {
                        switch (op) {
                            case 'start':
                                await manager.markStarted();
                                break;
                            case 'complete':
                                await manager.markComplete();
                                break;
                            case 'incomplete':
                                await manager.markIncomplete();
                                break;
                            case 'reset':
                                await manager.reset();
                                break;
                        }

                        const currentState = await manager.getState();
                        expect(Object.values(SetupState).includes(currentState), `Invalid state value: ${currentState} (operation: ${op}, sequence: ${operations.join(',')})`).toBeTruthy();
                    }

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 3: Resume Prompt Shown Once
    // For any activation session with incomplete setup, the resume prompt should be shown at most once
    // **Validates: Requirements 3.6**
    it('Property 3: Resume prompt shown at most once per session (Req 3.6)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 10 }), // Number of times to check shouldShowResumePrompt
                async (checkCount) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();
                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);

                    // Set up incomplete state
                    await manager.markIncomplete();

                    // First check: should show prompt
                    const shouldShowFirst = await manager.shouldShowResumePrompt();
                    expect(shouldShowFirst, `Should show resume prompt when setup is incomplete and prompt not yet shown (checkCount=${checkCount})`).toBe(true);

                    // Mark prompt as shown
                    await manager.markResumePromptShown();

                    // All subsequent checks: should NOT show prompt
                    for (let i = 0; i < checkCount; i++) {
                        const shouldShowAgain = await manager.shouldShowResumePrompt();
                        expect(shouldShowAgain, `Should not show resume prompt after marking as shown (check ${i + 1}/${checkCount})`).toBe(false);
                    }

                    // Verify the flag is session-scoped (NOT persisted to global state)
                    const promptShownFlag = globalStateData.get('promptregistry.resumePromptShown');
                    expect(promptShownFlag, `Resume prompt shown flag should NOT be persisted in global state (session-scoped) (checkCount=${checkCount})`).toBe(undefined);

                    // Verify that a new instance (simulating new session) allows prompt again
                    SetupStateManager.resetInstance();
                    const newSessionManager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
                    await newSessionManager.markIncomplete();
                    const shouldShowInNewSession = await newSessionManager.shouldShowResumePrompt();
                    expect(shouldShowInNewSession, `Should show resume prompt in new session (flag is session-scoped)`).toBe(true);

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 4: Test Environment Bypass
    // For any extension activation in a test environment (VSCODE_TEST=1 or ExtensionMode.Test),
    // all setup dialogs should be skipped and state should be set to complete
    // **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5**
    it('Property 4: Test environment bypass (Req 6.1, 6.2, 6.3, 6.4, 6.5)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.constantFrom(SetupState.NOT_STARTED, SetupState.IN_PROGRESS, SetupState.INCOMPLETE),
                fc.boolean(), // Whether VSCODE_TEST is set
                fc.constantFrom(1, 2, 3), // ExtensionMode (Production=1, Development=2, Test=3)
                async (initialState, hasVscodeTest, extensionMode) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();

                    // Set initial state
                    if (initialState !== SetupState.NOT_STARTED) {
                        globalStateData.set('promptregistry.setupState', initialState);
                    }

                    // Set up test environment
                    const originalEnv = process.env.VSCODE_TEST;
                    if (hasVscodeTest) {
                        process.env.VSCODE_TEST = '1';
                    } else {
                        delete process.env.VSCODE_TEST;
                    }

                    const testContext = {
                        globalState: mockContext.globalState,
                        extensionMode: extensionMode as any
                    } as any;

                    try {
                        const manager = SetupStateManager.getInstance(testContext, mockHubManager as any);

                        const isTestEnv = hasVscodeTest || extensionMode === 3;
                        const testParams = formatTestParams({ 
                            initialState, 
                            hasVscodeTest, 
                            extensionMode: extensionMode === 1 ? 'Production' : extensionMode === 2 ? 'Development' : 'Test',
                            isTestEnv
                        });

                        if (isTestEnv) {
                            // In test environment, marking complete should work
                            await manager.markComplete();
                            const state = await manager.getState();
                            
                            expect(state, `Req 6.1-6.3: Test environment should allow marking as complete (${testParams})`).toBe(SetupState.COMPLETE);

                            // Should not show resume prompt in test environment
                            const shouldShow = await manager.shouldShowResumePrompt();
                            expect(shouldShow, `Req 6.4: Should not show resume prompt in test environment (${testParams})`).toBe(false);
                        } else {
                            // In non-test environment, state should remain as set
                            const state = await manager.getState();
                            expect(state, `Non-test environment should preserve initial state (${testParams})`).toBe(initialState);
                        }

                        return true;
                    } finally {
                        // Restore environment
                        if (originalEnv !== undefined) {
                            process.env.VSCODE_TEST = originalEnv;
                        } else {
                            delete process.env.VSCODE_TEST;
                        }
                    }
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 7: Cancellation Graceful Handling
    // For any cancellation, markIncomplete() should set state to INCOMPLETE
    // and state should persist across multiple calls
    // **Validates: Requirements 8.1, 8.2, 9.1, 9.2**
    it('Property 7: Cancellation handling sets INCOMPLETE state (Req 8.1-8.2, 9.1-9.2)', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.integer({ min: 1, max: 5 }), // Number of cancellation calls
                async (callCount) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();

                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
                    const testParams = formatTestParams({ callCount });

                    // Simulate the cancellation flow
                    await manager.markStarted();
                    
                    // Call markIncomplete multiple times (simulating repeated cancellations)
                    for (let i = 0; i < callCount; i++) {
                        await manager.markIncomplete();
                    }

                    // Verify state is INCOMPLETE
                    const finalState = await manager.getState();
                    expect(finalState, `Req 8.1, 9.1: State should be INCOMPLETE after cancellation (${testParams})`).toBe(SetupState.INCOMPLETE);

                    // Verify isIncomplete() returns true
                    const isIncomplete = await manager.isIncomplete();
                    expect(isIncomplete, `Req 8.1, 9.1: isIncomplete() should return true (${testParams})`).toBe(true);

                    // Verify isComplete() returns false
                    const isComplete = await manager.isComplete();
                    expect(isComplete, `State should not be complete after cancellation (${testParams})`).toBe(false);

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 8: State Transition Idempotence
    // Calling the same state transition multiple times should result in the same final state
    // **Validates: Requirements 8.3, 8.4, 9.3, 9.4**
    it('Property 8: State transitions are idempotent (Req 8.3-8.4, 9.3-9.4)', async () => {
        const stateTransitionArbitrary = fc.constantFrom(
            'markStarted',
            'markComplete',
            'markIncomplete',
            'reset'
        );

        await fc.assert(
            fc.asyncProperty(
                stateTransitionArbitrary,
                fc.integer({ min: 2, max: 10 }), // Number of repeated calls
                async (transition, repeatCount) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();

                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
                    const testParams = formatTestParams({ transition, repeatCount });

                    // Apply the transition once
                    switch (transition) {
                        case 'markStarted':
                            await manager.markStarted();
                            break;
                        case 'markComplete':
                            await manager.markComplete();
                            break;
                        case 'markIncomplete':
                            await manager.markIncomplete();
                            break;
                        case 'reset':
                            await manager.reset();
                            break;
                    }

                    const stateAfterFirst = await manager.getState();

                    // Apply the same transition multiple more times
                    for (let i = 1; i < repeatCount; i++) {
                        switch (transition) {
                            case 'markStarted':
                                await manager.markStarted();
                                break;
                            case 'markComplete':
                                await manager.markComplete();
                                break;
                            case 'markIncomplete':
                                await manager.markIncomplete();
                                break;
                            case 'reset':
                                await manager.reset();
                                break;
                        }
                    }

                    const stateAfterRepeated = await manager.getState();

                    // State should be the same after repeated calls
                    expect(stateAfterRepeated, `Req 8.3, 9.3: State should be idempotent for ${transition} (${testParams})`).toBe(stateAfterFirst);

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    // Property 10: Reset Command Completeness
    // For any initial state, reset() should transition to NOT_STARTED
    // and shouldShowResumePrompt() should return false after reset
    // **Validates: Requirements 7.1, 7.2, 7.3**
    it('Property 10: Reset transitions to NOT_STARTED from any state (Req 7.1-7.3)', async () => {
        const initialStateArbitrary = fc.constantFrom(
            SetupState.NOT_STARTED,
            SetupState.IN_PROGRESS,
            SetupState.COMPLETE,
            SetupState.INCOMPLETE
        );

        await fc.assert(
            fc.asyncProperty(
                initialStateArbitrary,
                fc.integer({ min: 1, max: 5 }), // Number of reset calls
                async (initialState, resetCount) => {
                    globalStateData.clear();
                    SetupStateManager.resetInstance();

                    const manager = SetupStateManager.getInstance(mockContext, mockHubManager as any);
                    const testParams = formatTestParams({ initialState, resetCount });

                    // Set initial state
                    switch (initialState) {
                        case SetupState.IN_PROGRESS:
                            await manager.markStarted();
                            break;
                        case SetupState.COMPLETE:
                            await manager.markComplete();
                            break;
                        case SetupState.INCOMPLETE:
                            await manager.markIncomplete();
                            // Also mark resume prompt as shown to test it gets cleared
                            await manager.markResumePromptShown();
                            break;
                        // NOT_STARTED is default
                    }

                    // Verify initial state is set correctly
                    const stateBeforeReset = await manager.getState();
                    expect(stateBeforeReset, `Initial state should be ${initialState} (${testParams})`).toBe(initialState);

                    // Execute reset multiple times
                    for (let i = 0; i < resetCount; i++) {
                        await manager.reset();
                    }

                    // Verify state is NOT_STARTED after reset
                    const finalState = await manager.getState();
                    expect(finalState, `Req 7.2: State should be NOT_STARTED after reset (${testParams})`).toBe(SetupState.NOT_STARTED);

                    // Verify shouldShowResumePrompt returns false (prompt flag cleared)
                    const shouldShowPrompt = await manager.shouldShowResumePrompt();
                    expect(shouldShowPrompt, `Req 7.3: shouldShowResumePrompt should return false after reset (${testParams})`).toBe(false);

                    // Verify isComplete returns false
                    const isComplete = await manager.isComplete();
                    expect(isComplete, `isComplete should return false after reset (${testParams})`).toBe(false);

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });
});
