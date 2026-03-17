/**
 * Extension Activation Integration Tests
 * 
 * Tests for extension activation flow including lockfile detection
 * and repository activation prompt.
 * 
 * Requirements: 5.1, 13.1
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { createE2ETestContext, E2ETestContext } from '../helpers/e2eTestHelpers';
import { LockfileManager } from '../../src/services/LockfileManager';
import { RepositoryActivationService } from '../../src/services/RepositoryActivationService';
import { HubManager } from '../../src/services/HubManager';

describe('Extension Activation Integration', () => {
    let sandbox: sinon.SinonSandbox;
    let testContext: E2ETestContext;
    let mockWorkspaceFolders: vscode.WorkspaceFolder[] | undefined;
    let lockfilePath: string;
    let mockHubManager: sinon.SinonStubbedInstance<HubManager>;

    const writeLockfile = (lockfile: any): void => {
        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
    };

    beforeEach(async function() {
        sandbox = sinon.createSandbox();
        
        // Create E2E test context with isolated temp directory
        testContext = await createE2ETestContext();
        lockfilePath = path.join(testContext.tempStoragePath, 'prompt-registry.lock.json');

        // Setup workspace folders pointing to temp directory
        mockWorkspaceFolders = [{
            uri: vscode.Uri.file(testContext.tempStoragePath),
            name: 'test-workspace',
            index: 0
        }];
        sandbox.stub(vscode.workspace, 'workspaceFolders').get(() => mockWorkspaceFolders);

        // Create mock HubManager
        mockHubManager = sandbox.createStubInstance(HubManager);

        // Reset singletons for each test
        LockfileManager.resetInstance();
        RepositoryActivationService.resetInstance();
    });

    afterEach(async function() {
        sandbox.restore();
        LockfileManager.resetInstance();
        RepositoryActivationService.resetInstance();
        await testContext.cleanup();
    });

    describe('Lockfile Detection on Activation', () => {
        /**
         * Requirement 5.1: WHEN a workspace is opened, THE Extension SHALL check for
         * `prompt-registry.lock.json` at the repository root
         */
        it('should detect lockfile when workspace is opened', async () => {
            // Arrange
            const mockLockfile = {
                $schema: 'https://example.com/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    'test-bundle': {
                        version: '1.0.0',
                        sourceId: 'test-source',
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit' as const,
                        files: []
                    }
                },
                sources: {
                    'test-source': {
                        type: 'github',
                        url: 'https://github.com/test/repo'
                    }
                }
            };

            // Write lockfile to temp directory
            writeLockfile(mockLockfile);

            // Act
            const lockfileManager = LockfileManager.getInstance(testContext.tempStoragePath);
            const lockfile = await lockfileManager.read();

            // Assert
            expect(lockfile, 'Lockfile should be detected').toBeTruthy();
            expect(lockfile?.version).toBe('1.0.0');
            expect(lockfile?.bundles['test-bundle'], 'Bundle should be in lockfile').toBeTruthy();
        });

        /**
         * Requirement 5.1: WHEN a workspace is opened, THE Extension SHALL check for
         * `prompt-registry.lock.json` at the repository root
         */
        it('should handle missing lockfile gracefully', async () => {
            // Arrange - no lockfile written

            // Act
            const lockfileManager = LockfileManager.getInstance(testContext.tempStoragePath);
            const lockfile = await lockfileManager.read();

            // Assert
            expect(lockfile, 'Should return null when lockfile does not exist').toBe(null);
        });

        /**
         * Requirement 5.1: WHEN a workspace is opened, THE Extension SHALL check for
         * `prompt-registry.lock.json` at the repository root
         */
        it('should not check for lockfile when no workspace is open', async () => {
            // Arrange
            mockWorkspaceFolders = undefined;

            // Act
            const lockfileManager = LockfileManager.getInstance(testContext.tempStoragePath);
            const lockfile = await lockfileManager.read();

            // Assert
            expect(lockfile, 'Should return null when no workspace is open').toBe(null);
        });
    });

    describe('Activation Prompt Flow', () => {
        /**
         * Requirement 1.6: THE System SHALL NOT prompt users to "enable" or "install" 
         * repository bundles since the files are already present in the repository.
         * 
         * Instead, the system only checks for missing sources/hubs.
         */
        it('should NOT show activation prompt when lockfile is detected (Requirement 1.6)', async () => {
            // Arrange
            const mockLockfile = {
                $schema: 'https://example.com/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    'test-bundle': {
                        version: '1.0.0',
                        sourceId: 'test-source',
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit' as const,
                        files: []
                    }
                },
                sources: {
                    'test-source': {
                        type: 'github',
                        url: 'https://github.com/test/repo'
                    }
                }
            };

            // Write lockfile to temp directory
            writeLockfile(mockLockfile);

            // Mock notification
            const mockShowInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');
            mockShowInformationMessage.resolves('Not now' as any);

            // Mock storage to return the source as configured (no missing sources)
            testContext.storage.getSources = sandbox.stub().resolves([{
                id: 'test-source',
                type: 'github',
                url: 'https://github.com/test/repo',
                name: 'Test Source',
                enabled: true,
                priority: 0
            }]);
            mockHubManager.listHubs.resolves([]);

            // Act
            const lockfileManager = LockfileManager.getInstance(testContext.tempStoragePath);
            
            const activationService = RepositoryActivationService.getInstance(
                testContext.tempStoragePath,
                lockfileManager,
                mockHubManager,
                testContext.storage
            );
            await activationService.checkAndPromptActivation();

            // Assert - no activation prompt should be shown (Requirement 1.6)
            // Files are already in repository, no need to ask user to "enable"
            if (mockShowInformationMessage.called) {
                const callArgs = mockShowInformationMessage.firstCall.args;
                // If any prompt is shown, it should NOT be an activation prompt
                expect(!callArgs[0].toLowerCase().includes('enable'), 'Should NOT show activation prompt - files already in repository').toBeTruthy();
                expect(!callArgs[0].toLowerCase().includes('bundle'), 'Should NOT mention bundle count in activation prompt').toBeTruthy();
            }
        });

        /**
         * Requirement 13.1: WHEN a workspace with a lockfile is opened for the first time,
         * THE Extension SHALL display a notification
         * 
         * Requirement 13.4: WHEN the user declines, THE Extension SHALL remember the choice
         * and not prompt again for this repository
         */
        it('should not show prompt if previously declined', async () => {
            // Arrange
            const workspacePath = testContext.tempStoragePath;
            // Implementation uses array-based tracking: repositoryActivation.declined = [path1, path2, ...]
            await testContext.mockContext.globalState.update('repositoryActivation.declined', [workspacePath]);

            const mockLockfile = {
                $schema: 'https://example.com/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {},
                sources: {}
            };

            // Write lockfile to temp directory
            writeLockfile(mockLockfile);

            // Mock notification
            const mockShowInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');

            // Act
            const lockfileManager = LockfileManager.getInstance(testContext.tempStoragePath);
            const activationService = RepositoryActivationService.getInstance(
                testContext.tempStoragePath,
                lockfileManager,
                mockHubManager,
                testContext.storage
            );
            await activationService.checkAndPromptActivation();

            // Assert
            expect(mockShowInformationMessage.notCalled, 'Should not show prompt if previously declined').toBeTruthy();
        });

        /**
         * Requirement 13.1: WHEN a workspace with a lockfile is opened for the first time,
         * THE Extension SHALL display a notification
         */
        it('should not show prompt when no lockfile exists', async () => {
            // Arrange - no lockfile written

            // Mock notification
            const mockShowInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');

            // Act
            const lockfileManager = LockfileManager.getInstance(testContext.tempStoragePath);
            const activationService = RepositoryActivationService.getInstance(
                testContext.tempStoragePath,
                lockfileManager,
                mockHubManager,
                testContext.storage
            );
            await activationService.checkAndPromptActivation();

            // Assert
            expect(mockShowInformationMessage.notCalled, 'Should not show prompt when no lockfile exists').toBeTruthy();
        });

        /**
         * Requirement 1.6: THE System SHALL NOT prompt users to "enable" or "install" 
         * repository bundles since the files are already present in the repository.
         * 
         * The "Don't ask again" functionality now applies to missing source/hub prompts,
         * not activation prompts (which no longer exist per Requirement 1.6).
         */
        it('should skip source detection for declined repositories', async () => {
            // Arrange
            const workspacePath = testContext.tempStoragePath;
            // Implementation uses array-based tracking: repositoryActivation.declined = [path1, path2, ...]
            await testContext.mockContext.globalState.update('repositoryActivation.declined', [workspacePath]);

            const mockLockfile = {
                $schema: 'https://example.com/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {},
                sources: {
                    'test-source': {
                        type: 'github',
                        url: 'https://github.com/test/repo'
                    }
                }
            };

            // Write lockfile to temp directory
            writeLockfile(mockLockfile);

            // Mock notification
            const mockShowInformationMessage = sandbox.stub(vscode.window, 'showInformationMessage');
            
            // Mock storage to return no sources (would trigger missing source prompt if not declined)
            testContext.storage.getSources = sandbox.stub().resolves([]);
            mockHubManager.listHubs.resolves([]);

            // Act
            const lockfileManager = LockfileManager.getInstance(testContext.tempStoragePath);
            const activationService = RepositoryActivationService.getInstance(
                testContext.tempStoragePath,
                lockfileManager,
                mockHubManager,
                testContext.storage
            );
            await activationService.checkAndPromptActivation();

            // Assert - no prompt should be shown for declined repositories
            expect(mockShowInformationMessage.notCalled, 'Should not show any prompt for declined repositories').toBeTruthy();
        });
    });
});
