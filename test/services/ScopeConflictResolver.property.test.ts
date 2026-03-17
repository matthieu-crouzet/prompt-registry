/**
 * ScopeConflictResolver Property Tests
 * 
 * Property-based tests for the scope exclusivity invariant.
 * 
 * **Property 5: Scope Exclusivity Invariant**
 * For any bundle ID, the bundle SHALL exist at most at one scope (user OR repository, never both).
 * 
 * **Validates: Requirements 6.1, 6.4, 6.6**
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fc from 'fast-check';
import { ScopeConflictResolver } from '../../src/services/ScopeConflictResolver';
import { RegistryStorage } from '../../src/storage/RegistryStorage';
import { InstallationScope, InstalledBundle } from '../../src/types/registry';
import { createMockInstalledBundle } from '../helpers/bundleTestHelpers';
import { PropertyTestConfig, BundleGenerators } from '../helpers/propertyTestHelpers';

describe('ScopeConflictResolver Property Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let resolver: ScopeConflictResolver;

    // ===== Test Utilities =====
    const ALL_SCOPES: InstallationScope[] = ['user', 'workspace', 'repository'];

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
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        resolver = new ScopeConflictResolver(mockStorage);
    });

    afterEach(() => {
        sandbox.restore();
    });

    /**
     * Property 5: Scope Exclusivity Invariant
     * 
     * For any bundle ID, the bundle SHALL exist at most at one scope (user OR repository, never both).
     * 
     * This property test verifies that:
     * 1. When a bundle is installed at one scope, attempting to install at another scope is detected as a conflict
     * 2. The conflict detection is consistent regardless of which scope is checked first
     * 3. Migration properly moves the bundle from one scope to another (not duplicating)
     * 
     * **Validates: Requirements 6.1, 6.4, 6.6**
     * 
     * Feature: repository-level-installation, Property 5: Scope Exclusivity Invariant
     */
    describe('Property 5: Scope Exclusivity Invariant', function() {
        it('should detect conflict when bundle exists at any other scope', async () => {
            await fc.assert(
                fc.asyncProperty(
                    BundleGenerators.bundleId(),
                    BundleGenerators.version(),
                    fc.constantFrom<InstallationScope>('user', 'workspace', 'repository'),
                    fc.constantFrom<InstallationScope>('user', 'workspace', 'repository'),
                    async (bundleId, version, existingScope, targetScope) => {
                        // Skip if same scope (no conflict expected)
                        if (existingScope === targetScope) {
                            return true;
                        }

                        // Reset mocks for each iteration
                        mockStorage.getInstalledBundle.reset();

                        // Setup: bundle exists at existingScope
                        const installedBundle = createMockInstalledBundle(bundleId, version, { scope: existingScope });
                        
                        for (const scope of ALL_SCOPES) {
                            if (scope === existingScope) {
                                mockStorage.getInstalledBundle.withArgs(bundleId, scope).resolves(installedBundle);
                            } else {
                                mockStorage.getInstalledBundle.withArgs(bundleId, scope).resolves(undefined);
                            }
                        }

                        // Act: check for conflict when trying to install at targetScope
                        const conflict = await resolver.checkConflict(bundleId, targetScope);

                        // Assert: conflict should be detected
                        expect(conflict !== null, `Conflict should be detected when bundle at ${existingScope} and target is ${targetScope}`).toBeTruthy();
                        expect(conflict!.existingScope, 'Conflict should report correct existing scope').toBe(existingScope);
                        expect(conflict!.targetScope, 'Conflict should report correct target scope').toBe(targetScope);
                        expect(conflict!.bundleId, 'Conflict should report correct bundle ID').toBe(bundleId);

                        return true;
                    }
                ),
                { 
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS, 
                    numRuns: PropertyTestConfig.RUNS.STANDARD 
                }
            );
        });

        it('should not detect conflict when bundle only exists at target scope', async () => {
            await fc.assert(
                fc.asyncProperty(
                    BundleGenerators.bundleId(),
                    BundleGenerators.version(),
                    fc.constantFrom<InstallationScope>('user', 'workspace', 'repository'),
                    async (bundleId, version, targetScope) => {
                        // Reset mocks for each iteration
                        mockStorage.getInstalledBundle.reset();

                        // Setup: bundle only exists at targetScope
                        const installedBundle = createMockInstalledBundle(bundleId, version, { scope: targetScope });
                        
                        for (const scope of ALL_SCOPES) {
                            if (scope === targetScope) {
                                mockStorage.getInstalledBundle.withArgs(bundleId, scope).resolves(installedBundle);
                            } else {
                                mockStorage.getInstalledBundle.withArgs(bundleId, scope).resolves(undefined);
                            }
                        }

                        // Act: check for conflict when trying to install at same scope
                        const conflict = await resolver.checkConflict(bundleId, targetScope);

                        // Assert: no conflict should be detected (reinstalling at same scope is allowed)
                        expect(conflict, `No conflict should be detected when bundle only at target scope ${targetScope}`).toBe(null);

                        return true;
                    }
                ),
                { 
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS, 
                    numRuns: PropertyTestConfig.RUNS.STANDARD 
                }
            );
        });

        it('should not detect conflict when bundle is not installed anywhere', async () => {
            await fc.assert(
                fc.asyncProperty(
                    BundleGenerators.bundleId(),
                    fc.constantFrom<InstallationScope>('user', 'workspace', 'repository'),
                    async (bundleId, targetScope) => {
                        // Reset mocks for each iteration
                        mockStorage.getInstalledBundle.reset();

                        // Setup: bundle not installed anywhere
                        mockStorage.getInstalledBundle.resolves(undefined);

                        // Act: check for conflict
                        const conflict = await resolver.checkConflict(bundleId, targetScope);

                        // Assert: no conflict
                        expect(conflict, 'No conflict should be detected when bundle not installed').toBe(null);

                        return true;
                    }
                ),
                { 
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS, 
                    numRuns: PropertyTestConfig.RUNS.QUICK 
                }
            );
        });

        it('should maintain exclusivity after successful migration', async () => {
            await fc.assert(
                fc.asyncProperty(
                    BundleGenerators.bundleId(),
                    BundleGenerators.version(),
                    fc.constantFrom<InstallationScope>('user', 'repository'),
                    fc.constantFrom<InstallationScope>('user', 'repository'),
                    async (bundleId, version, fromScope, toScope) => {
                        // Skip if same scope
                        if (fromScope === toScope) {
                            return true;
                        }

                        // Reset mocks for each iteration
                        mockStorage.getInstalledBundle.reset();

                        // Setup: bundle exists at fromScope
                        const installedBundle = createMockInstalledBundle(bundleId, version, { scope: fromScope });
                        mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(installedBundle);
                        mockStorage.getInstalledBundle.withArgs(bundleId, toScope).resolves(undefined);
                        mockStorage.getInstalledBundle.withArgs(bundleId, 'workspace').resolves(undefined);

                        // Track migration state
                        let uninstallCalled = false;
                        let installCalled = false;

                        const mockUninstall = async () => {
                            uninstallCalled = true;
                            // After uninstall, bundle no longer at fromScope
                            mockStorage.getInstalledBundle.withArgs(bundleId, fromScope).resolves(undefined);
                        };

                        const mockInstall = async () => {
                            installCalled = true;
                            // After install, bundle at toScope
                            const newBundle = createMockInstalledBundle(bundleId, version, { scope: toScope });
                            mockStorage.getInstalledBundle.withArgs(bundleId, toScope).resolves(newBundle);
                        };

                        // Act: migrate bundle
                        const result = await resolver.migrateBundle(
                            bundleId,
                            fromScope,
                            toScope,
                            mockUninstall,
                            mockInstall
                        );

                        // Assert: migration succeeded
                        expect(result.success, 'Migration should succeed').toBeTruthy();
                        expect(uninstallCalled, 'Uninstall should be called').toBeTruthy();
                        expect(installCalled, 'Install should be called').toBeTruthy();

                        // Verify exclusivity: bundle should only be at toScope now
                        const conflictingScopes = await resolver.getConflictingScopes(bundleId);
                        expect(conflictingScopes.length, 'Bundle should exist at exactly one scope after migration').toBe(1);
                        expect(conflictingScopes[0], 'Bundle should be at target scope after migration').toBe(toScope);

                        return true;
                    }
                ),
                { 
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS, 
                    numRuns: PropertyTestConfig.RUNS.STANDARD 
                }
            );
        });

        it('should report all conflicting scopes correctly', async () => {
            await fc.assert(
                fc.asyncProperty(
                    BundleGenerators.bundleId(),
                    BundleGenerators.version(),
                    fc.subarray(ALL_SCOPES, { minLength: 0, maxLength: 3 }),
                    async (bundleId, version, installedScopes) => {
                        // Reset mocks for each iteration
                        mockStorage.getInstalledBundle.reset();

                        // Setup: bundle installed at specified scopes
                        for (const scope of ALL_SCOPES) {
                            if (installedScopes.includes(scope)) {
                                const bundle = createMockInstalledBundle(bundleId, version, { scope });
                                mockStorage.getInstalledBundle.withArgs(bundleId, scope).resolves(bundle);
                            } else {
                                mockStorage.getInstalledBundle.withArgs(bundleId, scope).resolves(undefined);
                            }
                        }

                        // Act: get all conflicting scopes
                        const conflictingScopes = await resolver.getConflictingScopes(bundleId);

                        // Assert: should match installed scopes
                        expect(conflictingScopes.sort(), 'Should report all scopes where bundle is installed').toEqual(installedScopes.sort());

                        return true;
                    }
                ),
                { 
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS, 
                    numRuns: PropertyTestConfig.RUNS.STANDARD 
                }
            );
        });
    });
});
