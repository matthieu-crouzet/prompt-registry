/**
 * Property-Based Tests for Scope Selection UI
 * 
 * **Property 8: Scope Selection UI Completeness**
 * **Validates: Requirements 2.1-2.6, 1.8**
 * 
 * For any installation with workspace open, the dialog SHALL present exactly three options.
 * Without workspace, only "User Profile" SHALL be available (repository options disabled).
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fc from 'fast-check';
import { PropertyTestConfig } from '../helpers/propertyTestHelpers';
import { InstallationScope, RepositoryCommitMode } from '../../src/types/registry';
import { showScopeSelectionDialog, ScopeQuickPickItem } from '../../src/utils/scopeSelectionUI';

describe('ScopeSelectionUI - Property Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockCreateQuickPick: sinon.SinonStub;
    let mockQuickPick: {
        items: ScopeQuickPickItem[];
        selectedItems: ScopeQuickPickItem[];
        title: string;
        placeholder: string;
        ignoreFocusOut: boolean;
        onDidChangeSelection: sinon.SinonStub;
        onDidAccept: sinon.SinonStub;
        onDidHide: sinon.SinonStub;
        show: sinon.SinonStub;
        hide: sinon.SinonStub;
        dispose: sinon.SinonStub;
    };
    let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;
    
    // Store event handlers for triggering in tests
    let selectionChangeHandler: ((selection: ScopeQuickPickItem[]) => void) | null = null;
    let acceptHandler: (() => void) | null = null;
    let hideHandler: (() => void) | null = null;

    // ===== Test Utilities =====
    
    /**
     * Generator for workspace state (open or closed)
     */
    const workspaceStateArb = fc.boolean();

    /**
     * Set workspace state for testing
     */
    const setWorkspaceOpen = (isOpen: boolean): void => {
        if (isOpen) {
            (vscode.workspace as any).workspaceFolders = [
                { uri: { fsPath: '/mock/workspace' }, name: 'workspace', index: 0 }
            ];
        } else {
            (vscode.workspace as any).workspaceFolders = undefined;
        }
    };

    const createMockQuickPick = () => {
        mockQuickPick = {
            items: [],
            selectedItems: [],
            title: '',
            placeholder: '',
            ignoreFocusOut: false,
            onDidChangeSelection: sandbox.stub().callsFake((handler) => {
                selectionChangeHandler = handler;
                return { dispose: () => {} };
            }),
            onDidAccept: sandbox.stub().callsFake((handler) => {
                acceptHandler = handler;
                return { dispose: () => {} };
            }),
            onDidHide: sandbox.stub().callsFake((handler) => {
                hideHandler = handler;
                return { dispose: () => {} };
            }),
            show: sandbox.stub(),
            hide: sandbox.stub(),
            dispose: sandbox.stub()
        };
        return mockQuickPick;
    };

    const resetAllMocks = (): void => {
        mockCreateQuickPick.reset();
        createMockQuickPick();
        mockCreateQuickPick.returns(mockQuickPick as any);
        selectionChangeHandler = null;
        acceptHandler = null;
        hideHandler = null;
    };

    // ===== Test Lifecycle =====
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        createMockQuickPick();
        mockCreateQuickPick = sandbox.stub(vscode.window, 'createQuickPick').returns(mockQuickPick as any);
        // Save original workspace folders
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
    });

    afterEach(() => {
        sandbox.restore();
        // Restore original workspace folders
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    });

    // ===== Property Tests =====

    /**
     * Property 8: Scope Selection UI Completeness
     * **Feature: repository-level-installation, Property 8: Scope Selection UI Completeness**
     * **Validates: Requirements 2.1-2.6, 1.8**
     */
    describe('Property 8: Scope Selection UI Completeness', () => {
        /**
         * Property 8.1: Dialog always presents exactly three options
         * For any workspace state, the dialog SHALL present exactly three options.
         */
        it('should always present exactly three options regardless of workspace state', async () => {
            await fc.assert(
                fc.asyncProperty(
                    workspaceStateArb,
                    async (hasWorkspace) => {
                        resetAllMocks();
                        setWorkspaceOpen(hasWorkspace);
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        // Select User Profile (always valid) and accept
                        mockQuickPick.selectedItems = [mockQuickPick.items[2]];
                        acceptHandler?.();

                        await dialogPromise;

                        // Verify: QuickPick was created with exactly 3 items
                        expect(mockCreateQuickPick.callCount, 'Should create one QuickPick dialog').toBe(1);
                        expect(mockQuickPick.items.length, 'Should always have exactly 3 options').toBe(3);

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
            );
        });

        /**
         * Property 8.2: Options are in correct order
         * For any workspace state, options SHALL be in order: Repository-Commit, Repository-LocalOnly, User
         */
        it('should present options in correct order for any workspace state', async () => {
            await fc.assert(
                fc.asyncProperty(
                    workspaceStateArb,
                    async (hasWorkspace) => {
                        resetAllMocks();
                        setWorkspaceOpen(hasWorkspace);
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        mockQuickPick.selectedItems = [mockQuickPick.items[2]];
                        acceptHandler?.();

                        await dialogPromise;

                        const items = mockQuickPick.items;
                        
                        // Verify order
                        expect(items[0].label.includes('Repository') && items[0].label.includes('Commit'), 'First option should be Repository - Commit').toBeTruthy();
                        expect(items[1].label.includes('Repository') && items[1].label.includes('Local'), 'Second option should be Repository - Local Only').toBeTruthy();
                        expect(items[2].label.includes('User'), 'Third option should be User Profile').toBeTruthy();

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
            );
        });

        /**
         * Property 8.3: Repository options disabled when no workspace
         * When hasWorkspace is false, repository options SHALL show disabled indicator.
         */
        it('should disable repository options when no workspace is open', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(false), // No workspace
                    async () => {
                        resetAllMocks();
                        setWorkspaceOpen(false);
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        mockQuickPick.selectedItems = [mockQuickPick.items[2]];
                        acceptHandler?.();

                        await dialogPromise;

                        const items = mockQuickPick.items;
                        
                        // Repository options should have disabled indicator
                        expect(items[0]._disabled === true, 'Repository - Commit should be disabled').toBeTruthy();
                        expect(items[1]._disabled === true, 'Repository - Local Only should be disabled').toBeTruthy();
                        // User Profile should not be disabled
                        expect(items[2]._disabled !== true, 'User Profile should not be disabled').toBeTruthy();

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.QUICK }
            );
        });

        /**
         * Property 8.4: All options enabled when workspace is open
         * When hasWorkspace is true, all options SHALL be enabled.
         */
        it('should enable all options when workspace is open', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(true), // Workspace open
                    async () => {
                        resetAllMocks();
                        setWorkspaceOpen(true);
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        mockQuickPick.selectedItems = [mockQuickPick.items[0]];
                        acceptHandler?.();

                        await dialogPromise;

                        const items = mockQuickPick.items;
                        
                        // All options should be enabled
                        expect(items[0]._disabled !== true, 'Repository - Commit should be enabled').toBeTruthy();
                        expect(items[1]._disabled !== true, 'Repository - Local Only should be enabled').toBeTruthy();
                        expect(items[2]._disabled !== true, 'User Profile should be enabled').toBeTruthy();

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.QUICK }
            );
        });

        /**
         * Property 8.5: Selection returns correct scope and commit mode
         * For any valid selection, the result SHALL contain correct scope and commitMode.
         */
        it('should return correct scope and commit mode for any selection', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 0, max: 2 }),
                    async (selectionIndex) => {
                        resetAllMocks();
                        setWorkspaceOpen(true); // Workspace open (all options enabled)
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        mockQuickPick.selectedItems = [mockQuickPick.items[selectionIndex]];
                        acceptHandler?.();

                        const result = await dialogPromise;

                        // Verify result matches selection
                        expect(result, 'Should return a result').toBeTruthy();
                        
                        if (selectionIndex === 0) {
                            expect(result.scope, 'Index 0 should return repository scope').toBe('repository');
                            expect(result.commitMode, 'Index 0 should return commit mode').toBe('commit');
                        } else if (selectionIndex === 1) {
                            expect(result.scope, 'Index 1 should return repository scope').toBe('repository');
                            expect(result.commitMode, 'Index 1 should return local-only mode').toBe('local-only');
                        } else {
                            expect(result.scope, 'Index 2 should return user scope').toBe('user');
                            expect(result.commitMode, 'Index 2 should not have commit mode').toBe(undefined);
                        }

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
            );
        });

        /**
         * Property 8.6: Cancellation returns undefined
         * For any workspace state, cancelling the dialog SHALL return undefined.
         */
        it('should return undefined when dialog is cancelled', async () => {
            await fc.assert(
                fc.asyncProperty(
                    workspaceStateArb,
                    async (hasWorkspace) => {
                        resetAllMocks();
                        setWorkspaceOpen(hasWorkspace);
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        // Simulate user pressing Escape (hide event)
                        hideHandler?.();

                        const result = await dialogPromise;

                        expect(result, 'Should return undefined when cancelled').toBe(undefined);

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.QUICK }
            );
        });

        /**
         * Property 8.7: Disabled option selection keeps dialog open
         * When a disabled option is selected, the dialog SHALL remain open and selection cleared.
         */
        it('should keep dialog open and clear selection when disabled option is selected', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 0, max: 1 }), // Repository options (disabled when no workspace)
                    async (selectionIndex) => {
                        resetAllMocks();
                        setWorkspaceOpen(false); // No workspace
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        // Simulate selecting a disabled option
                        const disabledItem = mockQuickPick.items[selectionIndex];
                        selectionChangeHandler?.([disabledItem]);
                        
                        // Verify selection was cleared (dialog stays open)
                        expect(mockQuickPick.selectedItems, 'Selection should be cleared').toEqual([]);
                        
                        // Verify hide was NOT called
                        expect(mockQuickPick.hide.callCount, 'Dialog should not be hidden').toBe(0);
                        
                        // Now select a valid option to close the dialog
                        mockQuickPick.selectedItems = [mockQuickPick.items[2]];
                        acceptHandler?.();

                        await dialogPromise;

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.QUICK }
            );
        });

        /**
         * Property 8.8: User Profile always selectable
         * For any workspace state, User Profile option SHALL always be selectable.
         */
        it('should always allow User Profile selection regardless of workspace state', async () => {
            await fc.assert(
                fc.asyncProperty(
                    workspaceStateArb,
                    async (hasWorkspace) => {
                        resetAllMocks();
                        setWorkspaceOpen(hasWorkspace);
                        
                        const dialogPromise = showScopeSelectionDialog();
                        
                        mockQuickPick.selectedItems = [mockQuickPick.items[2]]; // User Profile
                        acceptHandler?.();

                        const result = await dialogPromise;

                        // Should return user scope
                        expect(result, 'Should return a result').toBeTruthy();
                        expect(result.scope, 'Should return user scope').toBe('user');
                        
                        // Dialog should be hidden (valid selection accepted)
                        expect(mockQuickPick.hide.callCount, 'Dialog should be hidden').toBe(1);

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
            );
        });
    });
});
