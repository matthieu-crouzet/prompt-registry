/**
 * LocalModificationWarningService Unit Tests
 * 
 * Tests for the service that detects local file modifications and warns users
 * before updating bundles that would override their changes.
 * 
 * Requirements: 14.1-14.10
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { LocalModificationWarningService, ModificationWarningResult } from '../../src/services/LocalModificationWarningService';
import { LockfileManager } from '../../src/services/LockfileManager';
import { ModifiedFileInfo } from '../../src/types/lockfile';

describe('LocalModificationWarningService', () => {
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

    describe('checkForModifications()', () => {
        it('should return empty array when no modifications detected', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockLockfileManager.detectModifiedFiles.resolves([]);

            // Act
            const result = await service.checkForModifications(bundleId);

            // Assert
            expect(result, 'Should return empty array when no modifications').toEqual([]);
            expect(mockLockfileManager.detectModifiedFiles.calledOnceWith(bundleId)).toBeTruthy();
        });

        it('should return modified files when modifications detected', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                },
                {
                    path: '.github/agents/test.agent.md',
                    originalChecksum: 'ghi789',
                    currentChecksum: 'jkl012',
                    modificationType: 'modified'
                }
            ];
            mockLockfileManager.detectModifiedFiles.resolves(modifiedFiles);

            // Act
            const result = await service.checkForModifications(bundleId);

            // Assert
            expect(result.length, 'Should return all modified files').toBe(2);
            expect(result).toEqual(modifiedFiles);
        });

        it('should include missing files in results', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/missing.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: '',
                    modificationType: 'missing'
                }
            ];
            mockLockfileManager.detectModifiedFiles.resolves(modifiedFiles);

            // Act
            const result = await service.checkForModifications(bundleId);

            // Assert
            expect(result.length).toBe(1);
            expect(result[0].modificationType).toBe('missing');
        });

        it('should delegate to LockfileManager.detectModifiedFiles', async () => {
            // Arrange
            const bundleId = 'my-bundle';
            mockLockfileManager.detectModifiedFiles.resolves([]);

            // Act
            await service.checkForModifications(bundleId);

            // Assert
            expect(mockLockfileManager.detectModifiedFiles.calledOnceWith(bundleId), 'Should call LockfileManager.detectModifiedFiles with bundle ID').toBeTruthy();
        });
    });

    describe('showWarningDialog()', () => {
        it('should display warning dialog with modified file list', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            const bundleRepoUrl = 'https://github.com/owner/repo';
            showWarningMessageStub.resolves('Cancel');

            // Act
            await service.showWarningDialog(bundleId, modifiedFiles, bundleRepoUrl);

            // Assert
            expect(showWarningMessageStub.calledOnce, 'Should show warning dialog').toBeTruthy();
            const message = showWarningMessageStub.firstCall.args[0] as string;
            expect(message.includes('modified'), 'Message should mention modifications').toBeTruthy();
            expect(message.includes('.github/prompts/test.prompt.md'), 'Message should list modified files').toBeTruthy();
        });

        it('should include three action buttons: Contribute Changes, Override, Cancel', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            showWarningMessageStub.resolves('Cancel');

            // Act
            await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            const callArgs = showWarningMessageStub.firstCall.args;
            const buttons = callArgs.slice(1); // Skip message, get buttons
            expect(buttons.length, 'Should have exactly 3 buttons').toBe(3);
            expect(buttons.includes('Contribute Changes'), 'Should have Contribute Changes button').toBeTruthy();
            expect(buttons.includes('Override'), 'Should have Override button').toBeTruthy();
            expect(buttons.includes('Cancel'), 'Should have Cancel button').toBeTruthy();
        });

        it('should return "contribute" when user clicks Contribute Changes', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            showWarningMessageStub.resolves('Contribute Changes');

            // Act
            const result = await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            expect(result, 'Should return "contribute" action').toBe('contribute');
        });

        it('should return "override" when user clicks Override', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            showWarningMessageStub.resolves('Override');

            // Act
            const result = await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            expect(result, 'Should return "override" action').toBe('override');
        });

        it('should return "cancel" when user clicks Cancel', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            showWarningMessageStub.resolves('Cancel');

            // Act
            const result = await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            expect(result, 'Should return "cancel" action').toBe('cancel');
        });

        it('should return "cancel" when user dismisses dialog', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            showWarningMessageStub.resolves(undefined); // User dismissed

            // Act
            const result = await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            expect(result, 'Should return "cancel" when dismissed').toBe('cancel');
        });

        it('should open repository URL when Contribute Changes is clicked and URL provided', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            const bundleRepoUrl = 'https://github.com/owner/repo';
            showWarningMessageStub.resolves('Contribute Changes');
            openExternalStub.resolves(true);

            // Act
            await service.showWarningDialog(bundleId, modifiedFiles, bundleRepoUrl);

            // Assert
            expect(openExternalStub.calledOnce, 'Should open external URL').toBeTruthy();
            const uri = openExternalStub.firstCall.args[0] as vscode.Uri;
            expect(uri.toString(), 'Should open correct repository URL').toBe(bundleRepoUrl);
        });

        it('should not open URL when Contribute Changes clicked but no URL provided', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            showWarningMessageStub.resolves('Contribute Changes');

            // Act
            await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            expect(!openExternalStub.called, 'Should not open URL when none provided').toBeTruthy();
        });

        it('should list all modified files in dialog message', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/file1.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                },
                {
                    path: '.github/agents/file2.agent.md',
                    originalChecksum: 'ghi789',
                    currentChecksum: 'jkl012',
                    modificationType: 'modified'
                },
                {
                    path: '.github/instructions/file3.instructions.md',
                    originalChecksum: 'mno345',
                    currentChecksum: '',
                    modificationType: 'missing'
                }
            ];
            showWarningMessageStub.resolves('Cancel');

            // Act
            await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            const message = showWarningMessageStub.firstCall.args[0] as string;
            expect(message.includes('file1.prompt.md'), 'Should list first file').toBeTruthy();
            expect(message.includes('file2.agent.md'), 'Should list second file').toBeTruthy();
            expect(message.includes('file3.instructions.md'), 'Should list third file').toBeTruthy();
        });

        it('should indicate file modification type in message', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/modified.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                },
                {
                    path: '.github/prompts/missing.prompt.md',
                    originalChecksum: 'ghi789',
                    currentChecksum: '',
                    modificationType: 'missing'
                }
            ];
            showWarningMessageStub.resolves('Cancel');

            // Act
            await service.showWarningDialog(bundleId, modifiedFiles);

            // Assert
            const message = showWarningMessageStub.firstCall.args[0] as string;
            expect(message.includes('modified') || message.includes('changed'), 'Should indicate modification type').toBeTruthy();
        });
    });

    describe('checkAndWarn()', () => {
        it('should return null when no modifications detected', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockLockfileManager.detectModifiedFiles.resolves([]);

            // Act
            const result = await service.checkAndWarn(bundleId);

            // Assert
            expect(result, 'Should return null when no modifications').toBe(null);
            expect(!showWarningMessageStub.called, 'Should not show dialog when no modifications').toBeTruthy();
        });

        it('should show dialog and return result when modifications detected', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            const bundleRepoUrl = 'https://github.com/owner/repo';
            mockLockfileManager.detectModifiedFiles.resolves(modifiedFiles);
            showWarningMessageStub.resolves('Override');

            // Act
            const result = await service.checkAndWarn(bundleId, bundleRepoUrl);

            // Assert
            expect(result, 'Should return dialog result').toBe('override');
            expect(showWarningMessageStub.calledOnce, 'Should show dialog').toBeTruthy();
        });

        it('should pass bundle repo URL to dialog', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const bundleRepoUrl = 'https://github.com/owner/repo';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            mockLockfileManager.detectModifiedFiles.resolves(modifiedFiles);
            showWarningMessageStub.resolves('Contribute Changes');
            openExternalStub.resolves(true);

            // Act
            await service.checkAndWarn(bundleId, bundleRepoUrl);

            // Assert
            expect(openExternalStub.calledOnce, 'Should open URL when Contribute Changes clicked').toBeTruthy();
            const uri = openExternalStub.firstCall.args[0] as vscode.Uri;
            expect(uri.toString()).toBe(bundleRepoUrl);
        });

        it('should combine check and warn in single call', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            mockLockfileManager.detectModifiedFiles.resolves(modifiedFiles);
            showWarningMessageStub.resolves('Cancel');

            // Act
            const result = await service.checkAndWarn(bundleId);

            // Assert
            expect(mockLockfileManager.detectModifiedFiles.calledOnce, 'Should check for modifications').toBeTruthy();
            expect(showWarningMessageStub.calledOnce, 'Should show warning').toBeTruthy();
            expect(result).toBe('cancel');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty bundle ID gracefully', async () => {
            // Arrange
            mockLockfileManager.detectModifiedFiles.resolves([]);

            // Act
            const result = await service.checkForModifications('');

            // Assert
            expect(result).toEqual([]);
        });

        it('should handle LockfileManager errors gracefully', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockLockfileManager.detectModifiedFiles.rejects(new Error('Lockfile error'));

            // Act & Assert
            await expect(() => service.checkForModifications(bundleId)).rejects.toThrow(/Lockfile error/, 'Should propagate LockfileManager errors');
        });

        it('should handle dialog errors gracefully', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            showWarningMessageStub.rejects(new Error('Dialog error'));

            // Act & Assert
            await expect(() => service.showWarningDialog(bundleId, modifiedFiles)).rejects.toThrow(/Dialog error/, 'Should propagate dialog errors');
        });

        it('should handle openExternal errors gracefully', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const modifiedFiles: ModifiedFileInfo[] = [
                {
                    path: '.github/prompts/test.prompt.md',
                    originalChecksum: 'abc123',
                    currentChecksum: 'def456',
                    modificationType: 'modified'
                }
            ];
            const bundleRepoUrl = 'https://github.com/owner/repo';
            showWarningMessageStub.resolves('Contribute Changes');
            openExternalStub.rejects(new Error('Failed to open URL'));

            // Act
            const result = await service.showWarningDialog(bundleId, modifiedFiles, bundleRepoUrl);

            // Assert - should still return contribute even if URL fails to open
            expect(result, 'Should return contribute action even if URL fails').toBe('contribute');
        });
    });
});
