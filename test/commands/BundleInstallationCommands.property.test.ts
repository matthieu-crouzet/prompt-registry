/**
 * Property-Based Tests for BundleInstallationCommands
 * 
 * Tests the installation flow with auto-update checkbox functionality.
 * Validates that the auto-update preference is properly presented and stored.
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fc from 'fast-check';
import { BundleInstallationCommands } from '../../src/commands/BundleInstallationCommands';
import { RegistryManager } from '../../src/services/RegistryManager';
import { RegistryStorage } from '../../src/storage/RegistryStorage';
import { Bundle, InstallationScope, RepositoryCommitMode } from '../../src/types/registry';
import { createScopeQuickPickItems } from '../../src/utils/scopeSelectionUI';
import { BundleGenerators, PropertyTestConfig } from '../helpers/propertyTestHelpers';
import { BundleBuilder } from '../helpers/bundleTestHelpers';

describe('BundleInstallationCommands - Property Tests', () => {
    // ===== Test Setup =====
    let sandbox: sinon.SinonSandbox;
    let mockRegistryManager: sinon.SinonStubbedInstance<RegistryManager>;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let commands: BundleInstallationCommands;
    let mockShowQuickPick: sinon.SinonStub;
    let mockCreateQuickPick: sinon.SinonStub;
    let mockWithProgress: sinon.SinonStub;
    let mockShowInformationMessage: sinon.SinonStub;
    let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;
    
    // Store event handlers for scope selection dialog
    let acceptHandler: (() => void) | null = null;
    let hideHandler: (() => void) | null = null;

    // ===== Test Utilities =====
    
    // Shared Generators
    const bundleIdArb = BundleGenerators.bundleId();
    const versionArb = BundleGenerators.version();
    
    /**
     * Get a scope QuickPick item from the production createScopeQuickPickItems function.
     * This ensures test data matches production behavior.
     */
    const getScopeQuickPickItem = (scope: InstallationScope, commitMode?: RepositoryCommitMode) => {
        const items = createScopeQuickPickItems(true); // hasWorkspace = true
        if (scope === 'user') {
            return items.find(item => item._scope === 'user')!;
        }
        return items.find(item => item._scope === scope && item._commitMode === commitMode)!;
    };

    const createAutoUpdateQuickPickItem = (enabled: boolean) => ({
        label: enabled ? '$(sync) Enable auto-update' : '$(circle-slash) Manual updates only',
        description: enabled ? 'Automatically install updates when available' : 'You will be notified but updates must be installed manually',
        detail: enabled ? 'Recommended for staying up-to-date with the latest features and fixes' : 'Choose this if you prefer to review changes before updating',
        value: enabled
    });

    /**
     * Creates a mock QuickPick that simulates user interaction.
     * 
     * The mock simulates the VS Code QuickPick lifecycle:
     * 1. Event handlers are registered via onDidAccept/onDidHide
     * 2. show() triggers the simulated user action
     * 3. For acceptance: selectedItems is set, acceptHandler fires, then hideHandler fires
     * 4. For cancellation: hideHandler fires immediately (simulating Escape key)
     * 
     * @param behavior - 'accept' to simulate selection, 'cancel' to simulate dismissal
     * @param scope - The scope to select (only used when behavior is 'accept')
     * @param commitMode - The commit mode (only used when scope is 'repository')
     */
    const createMockQuickPick = (
        behavior: 'accept' | 'cancel',
        scope?: InstallationScope,
        commitMode?: RepositoryCommitMode
    ) => {
        const mockQuickPick: any = {
            items: [] as any[],
            selectedItems: [] as any[],
            title: '',
            placeholder: '',
            ignoreFocusOut: false,
            onDidChangeSelection: sandbox.stub().callsFake(() => ({ dispose: () => {} })),
            onDidAccept: sandbox.stub().callsFake((handler: () => void) => {
                acceptHandler = handler;
                return { dispose: () => {} };
            }),
            onDidHide: sandbox.stub().callsFake((handler: () => void) => {
                hideHandler = handler;
                return { dispose: () => {} };
            }),
            show: sandbox.stub().callsFake(function(this: typeof mockQuickPick) {
                if (behavior === 'accept' && scope) {
                    // Simulate user selecting an item and pressing Enter
                    // Use production createScopeQuickPickItems to ensure consistency
                    this.selectedItems = [getScopeQuickPickItem(scope, commitMode)];
                    if (acceptHandler) {
                        acceptHandler();
                    }
                }
                // Always trigger hideHandler after show() to simulate dialog closing
                if (hideHandler) {
                    hideHandler();
                }
            }),
            hide: sandbox.stub(),
            dispose: sandbox.stub()
        };
        return mockQuickPick;
    };

    // Mock Setup Helpers
    const setupSuccessfulInstallation = (bundleId: string, bundle: Bundle, scope: InstallationScope, autoUpdate: boolean, commitMode?: RepositoryCommitMode): void => {
        mockRegistryManager.getBundleDetails.withArgs(bundleId).resolves(bundle);
        mockRegistryManager.installBundle.resolves();
        mockStorage.setUpdatePreference.resolves();
        mockRegistryManager.getStorage.returns(mockStorage as any);

        // Mock createQuickPick for scope selection dialog
        mockCreateQuickPick.returns(createMockQuickPick('accept', scope, commitMode) as any);

        // Mock showQuickPick for auto-update choice
        mockShowQuickPick.resolves(createAutoUpdateQuickPickItem(autoUpdate));

        // Mock progress dialog
        mockWithProgress.callsFake(async (_options: any, task: any) => {
            const mockProgress = { report: sinon.stub() };
            return await task(mockProgress);
        });

        mockShowInformationMessage.resolves();
    };

    const setupUserCancellation = (cancelAt: 'scope' | 'autoUpdate'): void => {
        if (cancelAt === 'scope') {
            // User cancels at scope selection
            mockCreateQuickPick.returns(createMockQuickPick('cancel') as any);
        } else {
            // User selects scope but cancels at auto-update
            mockCreateQuickPick.returns(createMockQuickPick('accept', 'user') as any);
            mockShowQuickPick.resolves(undefined);
        }
    };

    // Reset Helper
    const resetAllMocks = (): void => {
        mockRegistryManager.getBundleDetails.reset();
        mockRegistryManager.installBundle.reset();
        mockRegistryManager.getStorage.reset();
        mockStorage.setUpdatePreference.reset();
        mockShowQuickPick.reset();
        mockCreateQuickPick.reset();
        mockWithProgress.reset();
        mockShowInformationMessage.reset();
        acceptHandler = null;
        hideHandler = null;
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

    // ===== Test Lifecycle =====
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Create stubbed instances
        mockRegistryManager = sandbox.createStubInstance(RegistryManager);
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        
        // Stub VS Code APIs
        mockShowQuickPick = sandbox.stub(vscode.window, 'showQuickPick');
        mockCreateQuickPick = sandbox.stub(vscode.window, 'createQuickPick');
        mockWithProgress = sandbox.stub(vscode.window, 'withProgress');
        mockShowInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');
        
        // Save original workspace folders and set workspace as open
        originalWorkspaceFolders = vscode.workspace.workspaceFolders;
        setWorkspaceOpen(true);
        
        // Reset event handlers
        acceptHandler = null;
        hideHandler = null;
        
        // Create commands instance
        commands = new BundleInstallationCommands(mockRegistryManager as any);
    });

    afterEach(() => {
        sandbox.restore();
        // Restore original workspace folders
        (vscode.workspace as any).workspaceFolders = originalWorkspaceFolders;
    });

    // ===== Property Tests =====

    /**
     * Property 11: Auto-update checkbox during installation
     * **Feature: bundle-update-notifications, Property 11: Auto-update checkbox during installation**
     * Validates: Requirements 3.1
     * 
     * For any bundle installation, the system should present an auto-update
     * preference choice and store the user's selection.
     */
    describe('Property 11: Auto-update checkbox during installation', () => {
        it('should present auto-update choice for any bundle installation', async () => {
            await fc.assert(
                fc.asyncProperty(
                    bundleIdArb,
                    versionArb,
                    fc.constantFrom('user' as const, 'repository' as const),
                    fc.boolean(),
                    async (bundleId, version, scope, autoUpdateChoice) => {
                        resetAllMocks();

                        const bundle = BundleBuilder.fromSource(bundleId, 'GITHUB')
                            .withVersion(version)
                            .build();
                        const commitMode = scope === 'repository' ? 'commit' as const : undefined;
                        setupSuccessfulInstallation(bundleId, bundle, scope, autoUpdateChoice, commitMode);

                        // Execute: Install bundle
                        await commands.installBundle(bundleId);

                        // Verify: Scope selection dialog was shown via createQuickPick
                        expect(mockCreateQuickPick.callCount, 'Should show scope selection dialog').toBe(1);
                        
                        // Verify: Auto-update quick pick was shown via showQuickPick
                        expect(mockShowQuickPick.callCount, 'Should show auto-update quick pick').toBe(1);
                        
                        // Verify: Auto-update quick pick has correct options
                        const autoUpdateCall = mockShowQuickPick.firstCall;
                        expect(autoUpdateCall, 'Should have auto-update quick pick call').toBeTruthy();
                        
                        const autoUpdateOptions = autoUpdateCall.args[0];
                        expect(Array.isArray(autoUpdateOptions), 'Auto-update options should be an array').toBeTruthy();
                        expect(autoUpdateOptions.length, 'Should have exactly 2 auto-update options').toBe(2);
                        
                        // Verify: Options contain enable and disable choices
                        const enableOption = autoUpdateOptions.find((opt: any) => opt.value === true);
                        const disableOption = autoUpdateOptions.find((opt: any) => opt.value === false);
                        
                        expect(enableOption, 'Should have enable auto-update option').toBeTruthy();
                        expect(disableOption, 'Should have disable auto-update option').toBeTruthy();
                        
                        // Verify: Enable option has sync icon and appropriate description
                        expect(enableOption.label.includes('$(sync)'), 'Enable option should have sync icon').toBeTruthy();
                        expect(enableOption.label.includes('Enable auto-update'), 'Enable option should mention auto-update').toBeTruthy();
                        
                        // Verify: Disable option has appropriate icon and description
                        expect(disableOption.label.includes('$(circle-slash)'), 'Disable option should have circle-slash icon').toBeTruthy();
                        expect(disableOption.label.includes('Manual updates'), 'Disable option should mention manual updates').toBeTruthy();

                        // Verify: Auto-update preference was stored
                        expect(mockStorage.setUpdatePreference.callCount, 'Should store auto-update preference').toBe(1);
                        const [storedBundleId, storedPreference] = mockStorage.setUpdatePreference.firstCall.args;
                        expect(storedBundleId, 'Should store preference for correct bundle').toBe(bundleId);
                        expect(storedPreference, 'Should store user\'s choice').toBe(autoUpdateChoice);

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
            );
        });

        it('should handle user cancellation at auto-update choice gracefully', async () => {
            await fc.assert(
                fc.asyncProperty(
                    bundleIdArb,
                    versionArb,
                    async (bundleId, version) => {
                        resetAllMocks();

                        const bundle = BundleBuilder.fromSource(bundleId, 'GITHUB')
                            .withVersion(version)
                            .build();
                        mockRegistryManager.getBundleDetails.withArgs(bundleId).resolves(bundle);
                        setupUserCancellation('autoUpdate');

                        // Execute: Install bundle (user cancels at auto-update choice)
                        await commands.installBundle(bundleId);

                        // Verify: Installation was not attempted
                        expect(mockRegistryManager.installBundle.callCount, 'Should not attempt installation when user cancels').toBe(0);
                        
                        // Verify: Auto-update preference was not stored
                        expect(mockStorage.setUpdatePreference.callCount, 'Should not store preference when user cancels').toBe(0);

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.QUICK }
            );
        });

        it('should handle user cancellation at scope choice gracefully', async () => {
            await fc.assert(
                fc.asyncProperty(
                    bundleIdArb,
                    versionArb,
                    async (bundleId, version) => {
                        resetAllMocks();

                        const bundle = BundleBuilder.fromSource(bundleId, 'GITHUB')
                            .withVersion(version)
                            .build();
                        mockRegistryManager.getBundleDetails.withArgs(bundleId).resolves(bundle);
                        setupUserCancellation('scope');

                        // Execute: Install bundle (user cancels at scope choice)
                        await commands.installBundle(bundleId);

                        // Verify: Scope dialog was shown
                        expect(mockCreateQuickPick.callCount, 'Should show scope dialog').toBe(1);
                        
                        // Verify: Auto-update choice was never presented
                        expect(mockShowQuickPick.callCount, 'Should not show auto-update dialog when user cancels scope').toBe(0);
                        
                        // Verify: Installation was not attempted
                        expect(mockRegistryManager.installBundle.callCount, 'Should not attempt installation when user cancels').toBe(0);
                        
                        // Verify: Auto-update preference was not stored
                        expect(mockStorage.setUpdatePreference.callCount, 'Should not store preference when user cancels').toBe(0);

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.QUICK }
            );
        });

        it('should store auto-update preference only after successful installation', async () => {
            await fc.assert(
                fc.asyncProperty(
                    bundleIdArb,
                    versionArb,
                    fc.constantFrom('user' as const, 'repository' as const),
                    fc.boolean(),
                    fc.string({ minLength: 1, maxLength: 50 }),
                    async (bundleId, version, scope, autoUpdateChoice, errorMessage) => {
                        resetAllMocks();

                        const bundle = BundleBuilder.fromSource(bundleId, 'GITHUB')
                            .withVersion(version)
                            .build();
                        mockRegistryManager.getBundleDetails.withArgs(bundleId).resolves(bundle);
                        mockRegistryManager.getStorage.returns(mockStorage as any);

                        // Setup installation failure
                        mockRegistryManager.installBundle.rejects(new Error(errorMessage));

                        // Mock createQuickPick for scope selection dialog
                        const commitMode = scope === 'repository' ? 'commit' as const : undefined;
                        mockCreateQuickPick.returns(createMockQuickPick('accept', scope, commitMode) as any);

                        // Mock showQuickPick for auto-update choice
                        mockShowQuickPick.resolves(createAutoUpdateQuickPickItem(autoUpdateChoice));

                        // Mock progress dialog
                        mockWithProgress.callsFake(async (_options: any, task: any) => {
                            const mockProgress = { report: sinon.stub() };
                            return await task(mockProgress);
                        });

                        // Execute: Install bundle (installation fails)
                        try {
                            await commands.installBundle(bundleId);
                        } catch {
                            // Expected to throw due to installation failure
                        }

                        // Verify: Auto-update preference was NOT stored due to installation failure
                        expect(mockStorage.setUpdatePreference.callCount, 'Should not store preference when installation fails').toBe(0);

                        return true;
                    }
                ),
                { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.QUICK }
            );
        });
    });
});