/**
 * Unit Tests for Scope Selection UI
 * 
 * Tests the scope selection dialog functionality for bundle installation.
 * Validates Requirements 2.1-2.6, 1.8
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { InstallationScope, RepositoryCommitMode } from '../../src/types/registry';
import { showScopeSelectionDialog, hasOpenWorkspace, createScopeQuickPickItems, ScopeQuickPickItem } from '../../src/utils/scopeSelectionUI';

describe('ScopeSelectionUI', () => {
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
    
    const createQuickPickItem = (
        scope: InstallationScope,
        commitMode?: RepositoryCommitMode,
        disabled: boolean = false
    ): ScopeQuickPickItem => {
        const labels: Record<string, string> = {
            'repository-commit': '$(repo) Repository - Commit to Git (Recommended)',
            'repository-local-only': '$(eye-closed) Repository - Local Only',
            'user': '$(account) User Profile'
        };
        
        const descriptions: Record<string, string> = {
            'repository-commit': 'Install in .github/, tracked in version control',
            'repository-local-only': 'Install in .github/, excluded via .git/info/exclude',
            'user': 'Install in user config, available everywhere'
        };

        const key = scope === 'repository' ? `repository-${commitMode}` : scope;
        const detail = disabled ? '(Requires an open workspace)' : undefined;
        
        return {
            label: labels[key],
            description: descriptions[key],
            detail,
            picked: scope === 'repository' && commitMode === 'commit' && !disabled,
            _scope: scope,
            _commitMode: commitMode,
            _disabled: disabled,
            _originalDetail: detail
        };
    };

    const setWorkspaceOpen = (isOpen: boolean): void => {
        if (isOpen) {
            (vscode.workspace as any).workspaceFolders = [
                { uri: { fsPath: '/mock/workspace' }, name: 'workspace', index: 0 }
            ];
        } else {
            (vscode.workspace as any).workspaceFolders = undefined;
        }
    };

    const resetAllMocks = (): void => {
        mockCreateQuickPick.reset();
        mockQuickPick.show.reset();
        mockQuickPick.hide.reset();
        mockQuickPick.dispose.reset();
        selectionChangeHandler = null;
        acceptHandler = null;
        hideHandler = null;
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

    // ===== Unit Tests =====

    describe('hasOpenWorkspace()', () => {
        it('should return true when workspace folders exist', () => {
            setWorkspaceOpen(true);
            expect(hasOpenWorkspace()).toBe(true);
        });

        it('should return false when workspace folders is undefined', () => {
            setWorkspaceOpen(false);
            expect(hasOpenWorkspace()).toBe(false);
        });

        it('should return false when workspace folders is empty array', () => {
            (vscode.workspace as any).workspaceFolders = [];
            expect(hasOpenWorkspace()).toBe(false);
        });
    });

    describe('createScopeQuickPickItems()', () => {
        it('should create three items', () => {
            const items = createScopeQuickPickItems(true);
            expect(items.length).toBe(3);
        });

        it('should mark repository options as disabled when no workspace', () => {
            const items = createScopeQuickPickItems(false);
            expect(items[0]._disabled, 'Repository - Commit should be disabled').toBe(true);
            expect(items[1]._disabled, 'Repository - Local Only should be disabled').toBe(true);
            expect(items[2]._disabled, 'User Profile should not be disabled').toBe(false);
        });

        it('should enable all options when workspace is open', () => {
            const items = createScopeQuickPickItems(true);
            expect(items[0]._disabled, 'Repository - Commit should be enabled').toBe(false);
            expect(items[1]._disabled, 'Repository - Local Only should be enabled').toBe(false);
            expect(items[2]._disabled, 'User Profile should be enabled').toBe(false);
        });

        it('should include _originalDetail for disabled items', () => {
            const items = createScopeQuickPickItems(false);
            expect(items[0]._originalDetail).toBe('(Requires an open workspace)');
            expect(items[1]._originalDetail).toBe('(Requires an open workspace)');
            expect(items[2]._originalDetail).toBe(undefined);
        });
    });

    describe('Dialog Options When Workspace Is Open', () => {
        beforeEach(() => {
            setWorkspaceOpen(true);
        });

        /**
         * Requirement 2.1: WHEN presenting installation options, THE Extension SHALL display 
         * a single QuickPick dialog with three options
         */
        it('should display exactly three options when workspace is open', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            // Simulate user selecting an option and accepting
            mockQuickPick.selectedItems = [mockQuickPick.items[0]];
            acceptHandler?.();
            
            await dialogPromise;

            expect(mockCreateQuickPick.callCount, 'Should create one QuickPick dialog').toBe(1);
            expect(mockQuickPick.items.length, 'Should have exactly 3 options').toBe(3);
        });

        /**
         * Requirement 2.2: WHEN displaying the QuickPick dialog, THE Extension SHALL show 
         * "Repository - Commit to Git (Recommended)" as the first option
         */
        it('should show "Repository - Commit to Git (Recommended)" as first option', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]]; // User Profile
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            expect(items[0].label.includes('Repository - Commit to Git'), 'First option should be Repository - Commit to Git').toBeTruthy();
            expect(items[0].label.includes('Recommended'), 'First option should indicate it is recommended').toBeTruthy();
            expect(items[0].description?.includes('tracked in version control'), 'First option should describe version control tracking').toBeTruthy();
        });

        /**
         * Requirement 2.3: WHEN displaying the QuickPick dialog, THE Extension SHALL show 
         * "Repository - Local Only" as the second option
         */
        it('should show "Repository - Local Only" as second option', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            expect(items[1].label.includes('Repository - Local Only'), 'Second option should be Repository - Local Only').toBeTruthy();
            expect(items[1].description?.includes('excluded via .git/info/exclude'), 'Second option should describe git exclude').toBeTruthy();
        });

        /**
         * Requirement 2.4: WHEN displaying the QuickPick dialog, THE Extension SHALL show 
         * "User Profile" as the third option
         */
        it('should show "User Profile" as third option', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            expect(items[2].label.includes('User Profile'), 'Third option should be User Profile').toBeTruthy();
            expect(items[2].description?.includes('available everywhere'), 'Third option should describe availability').toBeTruthy();
        });

        /**
         * Requirement 2.2: First option should have description "Install in .github/, tracked in version control"
         */
        it('should have correct description for Repository - Commit option', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            expect(items[0].description, 'First option should have correct description').toBe('Install in .github/, tracked in version control');
        });

        /**
         * Requirement 2.3: Second option should have description "Install in .github/, excluded via .git/info/exclude"
         */
        it('should have correct description for Repository - Local Only option', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            expect(items[1].description, 'Second option should have correct description').toBe('Install in .github/, excluded via .git/info/exclude');
        });

        /**
         * Requirement 2.4: Third option should have description "Install in user config, available everywhere"
         */
        it('should have correct description for User Profile option', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            expect(items[2].description, 'Third option should have correct description').toBe('Install in user config, available everywhere');
        });

        /**
         * All repository options should be enabled when workspace is open
         */
        it('should enable all repository options when workspace is open', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[0]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            
            // Repository options should not have disabled detail
            expect(!items[0].detail || !items[0].detail.includes('Requires'), 'Repository - Commit should not show disabled message').toBeTruthy();
            expect(!items[1].detail || !items[1].detail.includes('Requires'), 'Repository - Local Only should not show disabled message').toBeTruthy();
        });
    });

    describe('Dialog Options When No Workspace Is Open', () => {
        beforeEach(() => {
            setWorkspaceOpen(false);
        });

        /**
         * Requirement 1.8: WHEN no workspace is open, THE Extension SHALL disable repository 
         * scope option and default to user scope
         */
        it('should show disabled message for repository options when no workspace', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]]; // User Profile
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            
            // Repository options should have disabled detail
            expect(items[0].detail && items[0].detail.includes('Requires an open workspace'), 'Repository - Commit should show disabled message').toBeTruthy();
            expect(items[1].detail && items[1].detail.includes('Requires an open workspace'), 'Repository - Local Only should show disabled message').toBeTruthy();
        });

        /**
         * User Profile option should always be available
         */
        it('should keep User Profile option enabled when no workspace', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            
            // User Profile should not have disabled detail
            expect(!items[2].detail || !items[2].detail.includes('Requires'), 'User Profile should not show disabled message').toBeTruthy();
        });

        /**
         * Should still display all three options even when some are disabled
         */
        it('should still display three options when no workspace', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            const items = mockQuickPick.items;
            expect(items.length, 'Should still have 3 options').toBe(3);
        });
    });

    describe('Selection Handling', () => {
        beforeEach(() => {
            setWorkspaceOpen(true);
        });

        /**
         * Requirement 2.5: WHEN user selects an option, THE Extension SHALL proceed with 
         * installation using the selected scope and commit preference
         */
        it('should return repository scope with commit mode when first option selected', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[0]];
            acceptHandler?.();
            
            const result = await dialogPromise;

            expect(result, 'Should return a result').toBeTruthy();
            expect(result.scope, 'Should return repository scope').toBe('repository');
            expect(result.commitMode, 'Should return commit mode').toBe('commit');
        });

        it('should return repository scope with local-only mode when second option selected', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[1]];
            acceptHandler?.();
            
            const result = await dialogPromise;

            expect(result, 'Should return a result').toBeTruthy();
            expect(result.scope, 'Should return repository scope').toBe('repository');
            expect(result.commitMode, 'Should return local-only mode').toBe('local-only');
        });

        it('should return user scope without commit mode when third option selected', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            const result = await dialogPromise;

            expect(result, 'Should return a result').toBeTruthy();
            expect(result.scope, 'Should return user scope').toBe('user');
            expect(result.commitMode, 'Should not have commit mode for user scope').toBe(undefined);
        });

        /**
         * Requirement 2.6: WHEN user cancels the dialog, THE Extension SHALL abort the installation
         */
        it('should return undefined when user cancels dialog', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            // Simulate user pressing Escape
            hideHandler?.();
            
            const result = await dialogPromise;

            expect(result, 'Should return undefined when cancelled').toBe(undefined);
        });
    });

    describe('Disabled Option Handling (Improved UX)', () => {
        beforeEach(() => {
            setWorkspaceOpen(false);
        });

        /**
         * Requirement 1.8: Dialog should remain open when disabled option is selected
         */
        it('should keep dialog open when disabled option is selected via onDidChangeSelection', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            // Simulate selecting a disabled option
            const disabledItem = mockQuickPick.items[0]; // Repository - Commit (disabled)
            selectionChangeHandler?.([disabledItem]);
            
            // Verify selection was cleared (dialog stays open)
            expect(mockQuickPick.selectedItems, 'Selection should be cleared').toEqual([]);
            
            // Verify hide was NOT called
            expect(mockQuickPick.hide.callCount, 'Dialog should not be hidden').toBe(0);
            
            // Now select a valid option to close the dialog
            mockQuickPick.selectedItems = [mockQuickPick.items[2]]; // User Profile
            acceptHandler?.();
            
            await dialogPromise;
        });

        /**
         * Requirement 1.8: Dialog should show inline warning when disabled option is selected
         */
        it('should show inline warning when disabled option is selected', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            // Simulate selecting a disabled option
            const disabledItem = mockQuickPick.items[0]; // Repository - Commit (disabled)
            selectionChangeHandler?.([disabledItem]);
            
            // Verify the item's detail was updated to show warning
            const updatedItem = mockQuickPick.items.find(item => item._scope === 'repository' && item._commitMode === 'commit');
            expect(updatedItem?.detail?.includes('⚠️') || updatedItem?.detail?.includes('Requires an open workspace'), 'Should show warning in detail').toBeTruthy();
            
            // Close dialog properly
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;
        });

        /**
         * Requirement 1.8: Dialog should not accept disabled option on Enter/Accept
         */
        it('should not accept disabled option when user presses Enter', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            // Simulate selecting a disabled option and pressing Enter
            mockQuickPick.selectedItems = [mockQuickPick.items[0]]; // Repository - Commit (disabled)
            acceptHandler?.();
            
            // Verify hide was NOT called (dialog stays open)
            expect(mockQuickPick.hide.callCount, 'Dialog should not be hidden for disabled option').toBe(0);
            
            // Verify selection was cleared
            expect(mockQuickPick.selectedItems, 'Selection should be cleared').toEqual([]);
            
            // Now select a valid option to close the dialog
            mockQuickPick.selectedItems = [mockQuickPick.items[2]]; // User Profile
            acceptHandler?.();
            
            const result = await dialogPromise;
            expect(result, 'Should return result after valid selection').toBeTruthy();
            expect(result.scope, 'Should return user scope').toBe('user');
        });

        /**
         * Requirement 1.8: User Profile should always be selectable
         */
        it('should allow User Profile selection when no workspace is open', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]]; // User Profile
            acceptHandler?.();
            
            const result = await dialogPromise;

            expect(result, 'Should return a result').toBeTruthy();
            expect(result.scope, 'Should return user scope').toBe('user');
            expect(mockQuickPick.hide.callCount, 'Dialog should be hidden after valid selection').toBe(1);
        });

        /**
         * Test that warning is shown for both disabled repository options
         */
        it('should show warning for Repository - Local Only when disabled', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            // Simulate selecting the second disabled option
            const disabledItem = mockQuickPick.items[1]; // Repository - Local Only (disabled)
            selectionChangeHandler?.([disabledItem]);
            
            // Verify selection was cleared
            expect(mockQuickPick.selectedItems, 'Selection should be cleared').toEqual([]);
            
            // Close dialog properly
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;
        });
    });

    describe('QuickPick Configuration', () => {
        beforeEach(() => {
            setWorkspaceOpen(true);
        });

        it('should set appropriate title for the dialog', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            expect(mockQuickPick.title, 'Should have a title').toBeTruthy();
            expect(mockQuickPick.title.toLowerCase().includes('scope') || 
                mockQuickPick.title.toLowerCase().includes('installation'), 'Title should mention scope or installation').toBeTruthy();
        });

        it('should include bundle name in title when provided', async () => {
            const dialogPromise = showScopeSelectionDialog('my-bundle');
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            expect(mockQuickPick.title.includes('my-bundle'), 'Title should include bundle name').toBeTruthy();
        });

        it('should set ignoreFocusOut to true', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            expect(mockQuickPick.ignoreFocusOut, 'Should ignore focus out').toBe(true);
        });

        it('should have a placeholder text', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;

            expect(mockQuickPick.placeholder, 'Should have placeholder text').toBeTruthy();
        });

        it('should call show() to display the dialog', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            expect(mockQuickPick.show.callCount, 'Should call show()').toBe(1);
            
            mockQuickPick.selectedItems = [mockQuickPick.items[2]];
            acceptHandler?.();
            
            await dialogPromise;
        });

        it('should dispose QuickPick when dialog is hidden', async () => {
            const dialogPromise = showScopeSelectionDialog();
            
            hideHandler?.();
            
            await dialogPromise;

            expect(mockQuickPick.dispose.callCount, 'Should dispose QuickPick').toBe(1);
        });
    });
});
