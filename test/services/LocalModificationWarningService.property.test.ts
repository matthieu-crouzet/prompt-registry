/**
 * LocalModificationWarningService Property Tests
 * 
 * Property-based tests for the local modification warning service.
 * 
 * Requirements: 14.4-14.10
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fc from 'fast-check';
import { LocalModificationWarningService } from '../../src/services/LocalModificationWarningService';
import { LockfileManager } from '../../src/services/LockfileManager';
import { ModifiedFileInfo } from '../../src/types/lockfile';
import { LockfileGenerators } from '../helpers/lockfileTestHelpers';

describe('LocalModificationWarningService - Property Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLockfileManager: sinon.SinonStubbedInstance<LockfileManager>;
    let service: LocalModificationWarningService;
    let showWarningMessageStub: sinon.SinonStub;
    let openExternalStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockLockfileManager = sandbox.createStubInstance(LockfileManager);
        service = new LocalModificationWarningService(mockLockfileManager);
        
        // Mock VS Code APIs
        showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
        
        // Create openExternal stub if it doesn't exist
        if (!vscode.env.openExternal) {
            (vscode.env as any).openExternal = () => Promise.resolve(true);
        }
        openExternalStub = sandbox.stub(vscode.env, 'openExternal').resolves(true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    /**
     * Generator for modified file info
     */
    const modifiedFileInfoArb = (): fc.Arbitrary<ModifiedFileInfo> => {
        return fc.record({
            path: LockfileGenerators.filePath(),
            originalChecksum: LockfileGenerators.checksum(),
            currentChecksum: fc.oneof(
                LockfileGenerators.checksum(),
                fc.constant('') // For missing files
            ),
            modificationType: fc.constantFrom('modified', 'missing', 'new')
        });
    };

    /**
     * Generator for user dialog responses
     */
    const dialogResponseArb = (): fc.Arbitrary<string | undefined> => {
        return fc.oneof(
            fc.constant('Contribute Changes'),
            fc.constant('Override'),
            fc.constant('Cancel'),
            fc.constant(undefined) // User dismissed
        );
    };

    /**
     * Property 13: Local Modification Warning Dialog
     * 
     * For any set of modified files, when showWarningDialog is called:
     * - The dialog should be displayed with exactly 3 action buttons
     * - The message should list all modified file paths
     * - User selection should map to correct ModificationWarningResult
     * - "Contribute Changes" should open the repository URL if provided
     * 
     * Validates: Requirements 14.4-14.10
     * 
     * Feature: repository-level-installation, Property 13: Local Modification Warning Dialog
     */
    it('Property 13: Dialog displays correct options and handles all user responses', async () => {
        await fc.assert(
            fc.asyncProperty(
                LockfileGenerators.bundleId(),
                fc.array(modifiedFileInfoArb(), { minLength: 1, maxLength: 5 }),
                fc.option(LockfileGenerators.url(), { nil: undefined }),
                dialogResponseArb(),
                async (bundleId, modifiedFiles, bundleRepoUrl, userResponse) => {
                    // Reset stubs for each iteration
                    showWarningMessageStub.reset();
                    openExternalStub.reset();
                    showWarningMessageStub.resolves(userResponse);
                    openExternalStub.resolves(true);

                    // Act
                    const result = await service.showWarningDialog(bundleId, modifiedFiles, bundleRepoUrl);

                    // Assert: Dialog should be displayed
                    expect(showWarningMessageStub.callCount, 'Dialog should be displayed exactly once').toBe(1);

                    // Assert: Dialog should have exactly 3 buttons
                    const callArgs = showWarningMessageStub.firstCall.args;
                    const buttons = callArgs.slice(1); // Skip message, get buttons
                    expect(buttons.length, 'Dialog should have exactly 3 action buttons').toBe(3);
                    expect(buttons.includes('Contribute Changes'), 'Dialog should have "Contribute Changes" button').toBeTruthy();
                    expect(buttons.includes('Override'), 'Dialog should have "Override" button').toBeTruthy();
                    expect(buttons.includes('Cancel'), 'Dialog should have "Cancel" button').toBeTruthy();

                    // Assert: Message should list all modified files
                    const message = callArgs[0] as string;
                    for (const file of modifiedFiles) {
                        expect(message.includes(file.path), `Message should include file path: ${file.path}`).toBeTruthy();
                    }

                    // Assert: User response maps to correct result
                    if (userResponse === 'Contribute Changes') {
                        expect(result, 'Should return "contribute" for Contribute Changes').toBe('contribute');
                        
                        // Assert: URL should be opened if provided
                        if (bundleRepoUrl) {
                            expect(openExternalStub.calledOnce, 'Should open repository URL when Contribute Changes clicked and URL provided').toBeTruthy();
                            const uri = openExternalStub.firstCall.args[0] as vscode.Uri;
                            expect(uri.toString(), 'Should open correct repository URL').toBe(bundleRepoUrl);
                        } else {
                            expect(!openExternalStub.called, 'Should not open URL when none provided').toBeTruthy();
                        }
                    } else if (userResponse === 'Override') {
                        expect(result, 'Should return "override" for Override').toBe('override');
                        expect(!openExternalStub.called, 'Should not open URL for Override').toBeTruthy();
                    } else {
                        // Cancel or dismissed
                        expect(result, 'Should return "cancel" for Cancel or dismiss').toBe('cancel');
                        expect(!openExternalStub.called, 'Should not open URL for Cancel').toBeTruthy();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: checkAndWarn returns null when no modifications
     * 
     * For any bundle ID, when no modifications are detected,
     * checkAndWarn should return null without showing a dialog.
     */
    it('Property: checkAndWarn returns null when no modifications detected', async () => {
        await fc.assert(
            fc.asyncProperty(
                LockfileGenerators.bundleId(),
                async (bundleId) => {
                    // Reset stubs
                    showWarningMessageStub.reset();
                    mockLockfileManager.detectModifiedFiles.reset();
                    mockLockfileManager.detectModifiedFiles.resolves([]);

                    // Act
                    const result = await service.checkAndWarn(bundleId);

                    // Assert
                    expect(result, 'Should return null when no modifications').toBe(null);
                    expect(!showWarningMessageStub.called, 'Should not show dialog when no modifications').toBeTruthy();
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: checkAndWarn shows dialog when modifications exist
     * 
     * For any bundle ID with modifications, checkAndWarn should
     * show the dialog and return the user's choice.
     */
    it('Property: checkAndWarn shows dialog and returns result when modifications exist', async () => {
        await fc.assert(
            fc.asyncProperty(
                LockfileGenerators.bundleId(),
                fc.array(modifiedFileInfoArb(), { minLength: 1, maxLength: 5 }),
                dialogResponseArb(),
                async (bundleId, modifiedFiles, userResponse) => {
                    // Reset stubs
                    showWarningMessageStub.reset();
                    openExternalStub.reset();
                    mockLockfileManager.detectModifiedFiles.reset();
                    
                    mockLockfileManager.detectModifiedFiles.resolves(modifiedFiles);
                    showWarningMessageStub.resolves(userResponse);
                    openExternalStub.resolves(true);

                    // Act
                    const result = await service.checkAndWarn(bundleId);

                    // Assert
                    expect(result !== null, 'Should return a result when modifications exist').toBeTruthy();
                    expect(showWarningMessageStub.calledOnce, 'Should show dialog when modifications exist').toBeTruthy();
                    
                    // Verify result matches user response
                    if (userResponse === 'Contribute Changes') {
                        expect(result).toBe('contribute');
                    } else if (userResponse === 'Override') {
                        expect(result).toBe('override');
                    } else {
                        expect(result).toBe('cancel');
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Dialog message completeness
     * 
     * For any set of modified files, the dialog message should
     * include all file paths, regardless of modification type.
     */
    it('Property: Dialog message includes all modified file paths', async () => {
        await fc.assert(
            fc.asyncProperty(
                LockfileGenerators.bundleId(),
                fc.array(modifiedFileInfoArb(), { minLength: 1, maxLength: 10 }),
                async (bundleId, modifiedFiles) => {
                    // Reset stubs
                    showWarningMessageStub.reset();
                    showWarningMessageStub.resolves('Cancel');

                    // Act
                    await service.showWarningDialog(bundleId, modifiedFiles);

                    // Assert
                    const message = showWarningMessageStub.firstCall.args[0] as string;
                    
                    // Every file path should appear in the message
                    for (const file of modifiedFiles) {
                        expect(message.includes(file.path), `Message should include file path: ${file.path}`).toBeTruthy();
                    }
                }
            ),
            { numRuns: 100 }
        );
    });

    /**
     * Property: Consistent button order
     * 
     * For any dialog invocation, the buttons should always appear
     * in the same order: Contribute Changes, Override, Cancel.
     */
    it('Property: Dialog buttons appear in consistent order', async () => {
        await fc.assert(
            fc.asyncProperty(
                LockfileGenerators.bundleId(),
                fc.array(modifiedFileInfoArb(), { minLength: 1, maxLength: 5 }),
                async (bundleId, modifiedFiles) => {
                    // Reset stubs
                    showWarningMessageStub.reset();
                    showWarningMessageStub.resolves('Cancel');

                    // Act
                    await service.showWarningDialog(bundleId, modifiedFiles);

                    // Assert
                    const callArgs = showWarningMessageStub.firstCall.args;
                    const buttons = callArgs.slice(1);
                    
                    expect(buttons[0], 'First button should be Contribute Changes').toBe('Contribute Changes');
                    expect(buttons[1], 'Second button should be Override').toBe('Override');
                    expect(buttons[2], 'Third button should be Cancel').toBe('Cancel');
                }
            ),
            { numRuns: 100 }
        );
    });
});
