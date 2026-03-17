/**
 * ScopeConflictResolver Unit Tests
 * 
 * Tests for the service that prevents the same bundle from being installed
 * at both user and repository scopes simultaneously.
 * 
 * Requirements: 6.1-6.6
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ScopeConflictResolver, ScopeConflict, MigrationResult } from '../../src/services/ScopeConflictResolver';
import { RegistryStorage } from '../../src/storage/RegistryStorage';
import { InstallationScope, InstalledBundle } from '../../src/types/registry';
import { createMockInstalledBundle } from '../helpers/bundleTestHelpers';

describe('ScopeConflictResolver', () => {
    let sandbox: sinon.SinonSandbox;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let mockContext: vscode.ExtensionContext;
    let resolver: ScopeConflictResolver;

    // ===== Test Utilities =====
    const createMockContext = (): vscode.ExtensionContext => {
        const globalStateData = new Map<string, any>();
        return {
            globalState: {
                get: (key: string, defaultValue?: any) => globalStateData.get(key) ?? defaultValue,
                update: async (key: string, value: any) => { globalStateData.set(key, value); },
                keys: () => Array.from(globalStateData.keys()),
                setKeysForSync: sandbox.stub()
            } as any,
            globalStorageUri: vscode.Uri.file(path.join(os.tmpdir(), 'test-storage')),
            subscriptions: [],
            extensionUri: vscode.Uri.file('/mock/extension'),
            extensionPath: '/mock/extension',
            storagePath: '/mock/storage',
            globalStoragePath: path.join(os.tmpdir(), 'test-storage'),
            logPath: '/mock/log',
            extensionMode: 3 as any,
            workspaceState: {
                get: sandbox.stub(),
                update: sandbox.stub(),
                keys: sandbox.stub().returns([])
            } as any,
            secrets: {
                get: sandbox.stub(),
                store: sandbox.stub(),
                delete: sandbox.stub(),
                onDidChange: sandbox.stub()
            } as any,
            environmentVariableCollection: {} as any,
            extension: {} as any,
            asAbsolutePath: (relativePath: string) => path.join('/mock/extension', relativePath),
            storageUri: vscode.Uri.file('/mock/storage'),
            logUri: vscode.Uri.file('/mock/log'),
            languageModelAccessInformation: {} as any
        } as vscode.ExtensionContext;
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockContext = createMockContext();
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        resolver = new ScopeConflictResolver(mockStorage);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('checkConflict()', () => {
        it('should return null when bundle is not installed anywhere', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockStorage.getInstalledBundle.resolves(undefined);

            // Act
            const result = await resolver.checkConflict(bundleId, 'repository');

            // Assert
            expect(result, 'Should return null when no conflict exists').toBe(null);
        });

        it('should return null when bundle is only installed at target scope', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'repository' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'repository').resolves(installedBundle);

            // Act
            const result = await resolver.checkConflict(bundleId, 'repository');

            // Assert
            expect(result, 'Should return null when bundle is only at target scope').toBe(null);
        });

        it('should detect conflict when bundle is at user scope and target is repository', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'user' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(installedBundle);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'repository').resolves(undefined);

            // Act
            const result = await resolver.checkConflict(bundleId, 'repository');

            // Assert
            expect(result, 'Should detect conflict').toBeTruthy();
            expect(result!.bundleId).toBe(bundleId);
            expect(result!.existingScope).toBe('user');
            expect(result!.targetScope).toBe('repository');
            expect(result!.existingVersion).toBe('1.0.0');
        });

        it('should detect conflict when bundle is at repository scope and target is user', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '2.0.0', { scope: 'repository' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'repository').resolves(installedBundle);

            // Act
            const result = await resolver.checkConflict(bundleId, 'user');

            // Assert
            expect(result, 'Should detect conflict').toBeTruthy();
            expect(result!.bundleId).toBe(bundleId);
            expect(result!.existingScope).toBe('repository');
            expect(result!.targetScope).toBe('user');
            expect(result!.existingVersion).toBe('2.0.0');
        });

        it('should detect conflict when bundle is at workspace scope and target is repository', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '1.5.0', { scope: 'workspace' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(installedBundle);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'repository').resolves(undefined);

            // Act
            const result = await resolver.checkConflict(bundleId, 'repository');

            // Assert
            expect(result, 'Should detect conflict').toBeTruthy();
            expect(result!.existingScope).toBe('workspace');
            expect(result!.targetScope).toBe('repository');
        });

        it('should check all scopes except target scope', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockStorage.getInstalledBundle.resolves(undefined);

            // Act
            await resolver.checkConflict(bundleId, 'repository');

            // Assert - should check user and workspace, but not repository
            expect(mockStorage.getInstalledBundle.calledWith(bundleId, 'user'), 'Should check user scope').toBeTruthy();
            expect(mockStorage.getInstalledBundle.calledWith(bundleId, 'workspace'), 'Should check workspace scope').toBeTruthy();
        });
    });

    describe('migrateBundle()', () => {
        let mockUninstallCallback: sinon.SinonStub;
        let mockInstallCallback: sinon.SinonStub;

        beforeEach(() => {
            mockUninstallCallback = sandbox.stub();
            mockInstallCallback = sandbox.stub();
        });

        it('should successfully migrate bundle from user to repository scope', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const fromScope: InstallationScope = 'user';
            const toScope: InstallationScope = 'repository';
            const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: fromScope });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(installedBundle);
            mockUninstallCallback.resolves();
            mockInstallCallback.resolves();

            // Act
            const result = await resolver.migrateBundle(
                bundleId,
                fromScope,
                toScope,
                mockUninstallCallback,
                mockInstallCallback
            );

            // Assert
            expect(result.success, 'Migration should succeed').toBeTruthy();
            expect(result.bundleId).toBe(bundleId);
            expect(result.fromScope).toBe(fromScope);
            expect(result.toScope).toBe(toScope);
            expect(mockUninstallCallback.calledOnce, 'Uninstall should be called once').toBeTruthy();
            expect(mockInstallCallback.calledOnce, 'Install should be called once').toBeTruthy();
            expect(mockUninstallCallback.calledBefore(mockInstallCallback), 'Uninstall should be called before install').toBeTruthy();
        });

        it('should successfully migrate bundle from repository to user scope', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const fromScope: InstallationScope = 'repository';
            const toScope: InstallationScope = 'user';
            const installedBundle = createMockInstalledBundle(bundleId, '2.0.0', { scope: fromScope });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(installedBundle);
            mockUninstallCallback.resolves();
            mockInstallCallback.resolves();

            // Act
            const result = await resolver.migrateBundle(
                bundleId,
                fromScope,
                toScope,
                mockUninstallCallback,
                mockInstallCallback
            );

            // Assert
            expect(result.success, 'Migration should succeed').toBeTruthy();
            expect(result.fromScope).toBe(fromScope);
            expect(result.toScope).toBe(toScope);
        });

        it('should fail migration when bundle is not installed at source scope', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockStorage.getInstalledBundle.resolves(undefined);

            // Act
            const result = await resolver.migrateBundle(
                bundleId,
                'user',
                'repository',
                mockUninstallCallback,
                mockInstallCallback
            );

            // Assert
            expect(result.success, 'Migration should fail').toBe(false);
            expect(result.error, 'Should have error message').toBeTruthy();
            expect(result.error!.includes('not installed'), 'Error should mention bundle not installed').toBeTruthy();
            expect(!mockUninstallCallback.called, 'Uninstall should not be called').toBeTruthy();
            expect(!mockInstallCallback.called, 'Install should not be called').toBeTruthy();
        });

        it('should fail migration when uninstall fails', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'user' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(installedBundle);
            mockUninstallCallback.rejects(new Error('Uninstall failed'));

            // Act
            const result = await resolver.migrateBundle(
                bundleId,
                'user',
                'repository',
                mockUninstallCallback,
                mockInstallCallback
            );

            // Assert
            expect(result.success, 'Migration should fail').toBe(false);
            expect(result.error, 'Should have error message').toBeTruthy();
            expect(result.error!.includes('Uninstall failed'), 'Error should contain original error').toBeTruthy();
            expect(!mockInstallCallback.called, 'Install should not be called after uninstall failure').toBeTruthy();
        });

        it('should fail migration when install fails', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'user' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(installedBundle);
            mockUninstallCallback.resolves();
            mockInstallCallback.rejects(new Error('Install failed'));

            // Act
            const result = await resolver.migrateBundle(
                bundleId,
                'user',
                'repository',
                mockUninstallCallback,
                mockInstallCallback
            );

            // Assert
            expect(result.success, 'Migration should fail').toBe(false);
            expect(result.error, 'Should have error message').toBeTruthy();
            expect(result.error!.includes('Install failed'), 'Error should contain original error').toBeTruthy();
        });

        it('should pass installed bundle info to callbacks', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { 
                scope: 'user',
                sourceId: 'github-source'
            });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(installedBundle);
            mockUninstallCallback.resolves();
            mockInstallCallback.resolves();

            // Act
            await resolver.migrateBundle(
                bundleId,
                'user',
                'repository',
                mockUninstallCallback,
                mockInstallCallback
            );

            // Assert
            expect(mockUninstallCallback.calledWith(installedBundle), 'Uninstall should receive installed bundle').toBeTruthy();
            expect(mockInstallCallback.calledWith(installedBundle, 'repository'), 'Install should receive bundle and target scope').toBeTruthy();
        });

        describe('rollback behavior', () => {
            it('should attempt rollback when install fails after successful uninstall', async () => {
                // Arrange
                const bundleId = 'test-bundle';
                const fromScope: InstallationScope = 'user';
                const toScope: InstallationScope = 'repository';
                const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: fromScope });
                
                mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(installedBundle);
                mockUninstallCallback.resolves();
                // First call (install at target) fails, second call (rollback) succeeds
                mockInstallCallback.onFirstCall().rejects(new Error('Install failed'));
                mockInstallCallback.onSecondCall().resolves();

                // Act
                const result = await resolver.migrateBundle(
                    bundleId,
                    fromScope,
                    toScope,
                    mockUninstallCallback,
                    mockInstallCallback
                );

                // Assert
                expect(result.success, 'Migration should fail').toBe(false);
                expect(result.rollbackAttempted, 'Rollback should be attempted').toBe(true);
                expect(result.rollbackSucceeded, 'Rollback should succeed').toBe(true);
                expect(result.error!.includes('Rollback successful'), 'Error should indicate rollback success').toBeTruthy();
                expect(result.error!.includes('restored at user'), 'Error should mention original scope').toBeTruthy();
                expect(mockInstallCallback.callCount, 'Install should be called twice (target + rollback)').toBe(2);
            });

            it('should report rollback failure when both install and rollback fail', async () => {
                // Arrange
                const bundleId = 'test-bundle';
                const fromScope: InstallationScope = 'user';
                const toScope: InstallationScope = 'repository';
                const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: fromScope });
                
                mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(installedBundle);
                mockUninstallCallback.resolves();
                // Both install attempts fail
                mockInstallCallback.onFirstCall().rejects(new Error('Install failed'));
                mockInstallCallback.onSecondCall().rejects(new Error('Rollback install failed'));

                // Act
                const result = await resolver.migrateBundle(
                    bundleId,
                    fromScope,
                    toScope,
                    mockUninstallCallback,
                    mockInstallCallback
                );

                // Assert
                expect(result.success, 'Migration should fail').toBe(false);
                expect(result.rollbackAttempted, 'Rollback should be attempted').toBe(true);
                expect(result.rollbackSucceeded, 'Rollback should fail').toBe(false);
                expect(result.error!.includes('Rollback also failed'), 'Error should indicate rollback failure').toBeTruthy();
                expect(result.error!.includes('inconsistent state'), 'Error should warn about inconsistent state').toBeTruthy();
                expect(mockInstallCallback.callCount, 'Install should be called twice').toBe(2);
            });

            it('should call rollback with original scope', async () => {
                // Arrange
                const bundleId = 'test-bundle';
                const fromScope: InstallationScope = 'repository';
                const toScope: InstallationScope = 'user';
                const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: fromScope });
                
                mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(installedBundle);
                mockUninstallCallback.resolves();
                mockInstallCallback.onFirstCall().rejects(new Error('Install failed'));
                mockInstallCallback.onSecondCall().resolves();

                // Act
                await resolver.migrateBundle(
                    bundleId,
                    fromScope,
                    toScope,
                    mockUninstallCallback,
                    mockInstallCallback
                );

                // Assert - verify rollback was called with original scope
                const secondCall = mockInstallCallback.getCall(1);
                expect(secondCall, 'Second install call should exist').toBeTruthy();
                expect(secondCall.args[1], 'Rollback should use original scope').toBe(fromScope);
            });

            it('should preserve original bundle state on successful rollback', async () => {
                // Arrange
                const bundleId = 'test-bundle';
                const fromScope: InstallationScope = 'user';
                const toScope: InstallationScope = 'repository';
                const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { 
                    scope: fromScope,
                    sourceId: 'github-source'
                });
                
                mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(installedBundle);
                mockUninstallCallback.resolves();
                mockInstallCallback.onFirstCall().rejects(new Error('Install failed'));
                mockInstallCallback.onSecondCall().resolves();

                // Act
                await resolver.migrateBundle(
                    bundleId,
                    fromScope,
                    toScope,
                    mockUninstallCallback,
                    mockInstallCallback
                );

                // Assert - verify rollback was called with the same bundle info
                const rollbackCall = mockInstallCallback.getCall(1);
                expect(rollbackCall.args[0], 'Rollback should use original bundle info').toEqual(installedBundle);
            });

            it('should not attempt rollback when uninstall fails', async () => {
                // Arrange
                const bundleId = 'test-bundle';
                const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'user' });
                
                mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(installedBundle);
                mockUninstallCallback.rejects(new Error('Uninstall failed'));

                // Act
                const result = await resolver.migrateBundle(
                    bundleId,
                    'user',
                    'repository',
                    mockUninstallCallback,
                    mockInstallCallback
                );

                // Assert
                expect(result.success, 'Migration should fail').toBe(false);
                expect(result.rollbackAttempted, 'Rollback should not be attempted').toBe(undefined);
                expect(result.rollbackSucceeded, 'Rollback succeeded should not be set').toBe(undefined);
                expect(!mockInstallCallback.called, 'Install should not be called').toBeTruthy();
            });

            it('should not set rollback fields on successful migration', async () => {
                // Arrange
                const bundleId = 'test-bundle';
                const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'user' });
                
                mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(installedBundle);
                mockUninstallCallback.resolves();
                mockInstallCallback.resolves();

                // Act
                const result = await resolver.migrateBundle(
                    bundleId,
                    'user',
                    'repository',
                    mockUninstallCallback,
                    mockInstallCallback
                );

                // Assert
                expect(result.success, 'Migration should succeed').toBe(true);
                expect(result.rollbackAttempted, 'Rollback attempted should not be set').toBe(undefined);
                expect(result.rollbackSucceeded, 'Rollback succeeded should not be set').toBe(undefined);
            });
        });
    });

    describe('hasConflict()', () => {
        it('should return true when conflict exists', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const installedBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'user' });
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(installedBundle);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'repository').resolves(undefined);

            // Act
            const result = await resolver.hasConflict(bundleId, 'repository');

            // Assert
            expect(result, 'Should return true when conflict exists').toBe(true);
        });

        it('should return false when no conflict exists', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockStorage.getInstalledBundle.resolves(undefined);

            // Act
            const result = await resolver.hasConflict(bundleId, 'repository');

            // Assert
            expect(result, 'Should return false when no conflict').toBe(false);
        });
    });

    describe('getConflictingScopes()', () => {
        it('should return all scopes where bundle is installed', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const userBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'user' });
            const workspaceBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'workspace' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(userBundle);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(workspaceBundle);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'repository').resolves(undefined);

            // Act
            const result = await resolver.getConflictingScopes(bundleId);

            // Assert
            expect(result.sort(), 'Should return all installed scopes').toEqual(['user', 'workspace'].sort());
        });

        it('should return empty array when bundle is not installed anywhere', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            mockStorage.getInstalledBundle.resolves(undefined);

            // Act
            const result = await resolver.getConflictingScopes(bundleId);

            // Assert
            expect(result, 'Should return empty array').toEqual([]);
        });

        it('should return single scope when bundle is installed at one scope', async () => {
            // Arrange
            const bundleId = 'test-bundle';
            const repoBundle = createMockInstalledBundle(bundleId, '1.0.0', { scope: 'repository' });
            
            mockStorage.getInstalledBundle.withArgs(bundleId, 'user').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(undefined);
            mockStorage.getInstalledBundle.withArgs(bundleId, 'repository').resolves(repoBundle);

            // Act
            const result = await resolver.getConflictingScopes(bundleId);

            // Assert
            expect(result, 'Should return single scope').toEqual(['repository']);
        });
    });

    describe('Edge cases', () => {
        it('should handle empty bundle ID gracefully', async () => {
            // Arrange
            mockStorage.getInstalledBundle.resolves(undefined);

            // Act
            const result = await resolver.checkConflict('', 'repository');

            // Assert
            expect(result, 'Should return null for empty bundle ID').toBe(null);
        });

        it('should handle storage errors gracefully in checkConflict', async () => {
            // Arrange
            mockStorage.getInstalledBundle.rejects(new Error('Storage error'));

            // Act & Assert
            await expect(() => resolver.checkConflict('test-bundle', 'repository')).rejects.toThrow(/Storage error/, 'Should propagate storage errors');
        });
    });
});
