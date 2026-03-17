/**
 * RegistryManager.listInstalledBundles Property-Based Tests
 * 
 * Property-based tests for the listInstalledBundles method.
 * These tests verify correctness properties for the lockfile-as-source-of-truth feature.
 * 
 * Properties covered:
 * - Property 1: Repository Scope Queries Lockfile (Requirements 1.1)
 * - Property 2: Combined Scope Queries Both Sources (Requirements 1.2)
 */

import * as fc from 'fast-check';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { vi } from 'vitest';
import { RegistryManager } from '../../src/services/RegistryManager';
import { RegistryStorage } from '../../src/storage/RegistryStorage';
import { LockfileManager } from '../../src/services/LockfileManager';
import { InstalledBundle } from '../../src/types/registry';
import { PropertyTestConfig } from '../helpers/propertyTestHelpers';
import { createMockLockfile } from '../helpers/lockfileTestHelpers';
import { createTestWorkspace, cleanupTestWorkspace } from '../helpers/mockData';

// Mock scopeSelectionUI at module level for ESM compatibility
const mockGetWorkspaceRoot = vi.fn();
vi.mock('../../src/utils/scopeSelectionUI', () => ({
    getWorkspaceRoot: (...args: any[]) => mockGetWorkspaceRoot(...args),
}));

describe('RegistryManager.listInstalledBundles Property Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let manager: RegistryManager;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let tempDir: string;

    /**
     * Create a mock VS Code ExtensionContext for testing.
     * Uses sinon sandbox for proper cleanup.
     */
    const createMockContext = (sandbox: sinon.SinonSandbox): vscode.ExtensionContext => {
        return {
            globalState: {
                get: sandbox.stub(),
                update: sandbox.stub().resolves(),
                keys: sandbox.stub().returns([]),
                setKeysForSync: sandbox.stub()
            } as any,
            workspaceState: {
                get: sandbox.stub(),
                update: sandbox.stub().resolves(),
                keys: sandbox.stub().returns([]),
                setKeysForSync: sandbox.stub()
            } as any,
            subscriptions: [],
            extensionPath: '/mock/path',
            extensionUri: vscode.Uri.file('/mock/path'),
            storageUri: vscode.Uri.file('/mock/storage'),
            globalStorageUri: vscode.Uri.file('/mock/global'),
            asAbsolutePath: (p: string) => `/mock/path/${p}`,
        } as any;
    };

    const createMockUserBundle = (id: string, version: string): InstalledBundle => ({
        bundleId: id,
        version,
        installedAt: new Date().toISOString(),
        scope: 'user',
        installPath: '/mock/user/path',
        sourceId: 'mock-source',
        sourceType: 'github',
        manifest: {
            common: { directories: [], files: [], include_patterns: [], exclude_patterns: [] },
            bundle_settings: { include_common_in_environment_bundles: false, create_common_bundle: false, compression: 'none', naming: { environment_bundle: id } },
            metadata: { manifest_version: '1.0.0', description: `User bundle: ${id}` }
        }
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        tempDir = createTestWorkspace();
        mockContext = createMockContext(sandbox);
        
        // Reset RegistryManager singleton for clean test state
        (RegistryManager as any).instance = undefined;
        manager = RegistryManager.getInstance(mockContext);
        
        // Create and inject mock storage
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        mockStorage.getSources.resolves([]);
        mockStorage.getProfiles.resolves([]);
        mockStorage.getInstalledBundles.resolves([]);
        (manager as any).storage = mockStorage;

        // Mock getWorkspaceRoot to return our temp directory
        mockGetWorkspaceRoot.mockReturnValue(tempDir);

        // Reset LockfileManager instances
        LockfileManager.resetInstance();
    });

    afterEach(() => {
        sandbox.restore();
        cleanupTestWorkspace(tempDir);
        LockfileManager.resetInstance();
        (RegistryManager as any).instance = undefined;
    });

    /**
     * Property 1: Repository Scope Queries Lockfile
     * 
     * For any call to listInstalledBundles('repository'), the returned bundles
     * SHALL be derived from the lockfile, not from RegistryStorage.
     * 
     * **Validates: Requirements 1.1**
     * **Feature: lockfile-source-of-truth, Property 1: Repository Scope Queries Lockfile**
     */
    describe('Property 1: Repository Scope Queries Lockfile', () => {
        it('repository scope should return bundles from lockfile only', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 5 }),
                    async (bundleCount: number) => {
                        // Arrange: Create lockfile with bundles
                        const lockfile = createMockLockfile(bundleCount, {
                            sourceType: 'github',
                            commitMode: 'commit',
                            includeFiles: true
                        });
                        
                        // Write lockfile to temp directory
                        const lockfilePath = path.join(tempDir, 'prompt-registry.lock.json');
                        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
                        
                        // Create files for each bundle to avoid filesMissing flag
                        for (const [, entry] of Object.entries(lockfile.bundles)) {
                            for (const file of entry.files) {
                                const filePath = path.join(tempDir, file.path);
                                fs.mkdirSync(path.dirname(filePath), { recursive: true });
                                fs.writeFileSync(filePath, 'mock content');
                            }
                        }
                        
                        // Mock RegistryStorage to return user bundles (should NOT be included)
                        const userBundles = [createMockUserBundle('user-bundle-1', '1.0.0')];
                        mockStorage.getInstalledBundles.resolves(userBundles);
                        
                        // Act: Query repository scope
                        const result = await manager.listInstalledBundles('repository');
                        
                        // Assert: Should return only lockfile bundles
                        expect(result.length, `Should return ${bundleCount} bundles from lockfile`).toBe(bundleCount);
                        
                        // All returned bundles should have scope 'repository'
                        for (const bundle of result) {
                            expect(bundle.scope, 'All bundles should have repository scope').toBe('repository');
                        }
                        
                        // Should NOT include user bundles
                        const hasUserBundle = result.some(b => b.bundleId === 'user-bundle-1');
                        expect(hasUserBundle, 'Should not include user bundles when querying repository scope').toBe(false);
                        
                        // Cleanup
                        fs.unlinkSync(lockfilePath);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.STANDARD
                }
            );
        });

        it('repository scope should return empty array when lockfile does not exist', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.constant(true), // Dummy property to run the test
                    async () => {
                        // Arrange: No lockfile exists (temp dir is empty)
                        // Mock RegistryStorage to return user bundles
                        const userBundles = [createMockUserBundle('user-bundle-1', '1.0.0')];
                        mockStorage.getInstalledBundles.resolves(userBundles);
                        
                        // Act: Query repository scope
                        const result = await manager.listInstalledBundles('repository');
                        
                        // Assert: Should return empty array
                        expect(result.length, 'Should return empty array when lockfile does not exist').toBe(0);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.QUICK
                }
            );
        });

        it('repository scope should not call RegistryStorage.getInstalledBundles with repository scope', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 0, max: 3 }),
                    async (bundleCount: number) => {
                        // Arrange: Create lockfile
                        const lockfile = createMockLockfile(bundleCount);
                        const lockfilePath = path.join(tempDir, 'prompt-registry.lock.json');
                        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
                        
                        // Reset call history
                        mockStorage.getInstalledBundles.resetHistory();
                        
                        // Act: Query repository scope
                        await manager.listInstalledBundles('repository');
                        
                        // Assert: RegistryStorage should NOT be called for repository scope
                        expect(mockStorage.getInstalledBundles.called, 'RegistryStorage.getInstalledBundles should not be called for repository scope').toBe(false);
                        
                        // Cleanup
                        fs.unlinkSync(lockfilePath);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.QUICK
                }
            );
        });
    });


    /**
     * Property 2: Combined Scope Queries Both Sources
     * 
     * For any call to listInstalledBundles() without a scope filter, the returned
     * bundles SHALL include bundles from both RegistryStorage (user/workspace)
     * and LockfileManager (repository).
     * 
     * **Validates: Requirements 1.2**
     * **Feature: lockfile-source-of-truth, Property 2: Combined Scope Queries Both Sources**
     */
    describe('Property 2: Combined Scope Queries Both Sources', () => {
        it('no scope filter should return bundles from both sources', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 3 }),
                    fc.integer({ min: 1, max: 3 }),
                    async (lockfileBundleCount: number, userBundleCount: number) => {
                        // Arrange: Create lockfile with repository bundles
                        const lockfile = createMockLockfile(lockfileBundleCount, {
                            sourceType: 'github',
                            commitMode: 'commit'
                        });
                        
                        const lockfilePath = path.join(tempDir, 'prompt-registry.lock.json');
                        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
                        
                        // Create user bundles in RegistryStorage
                        const userBundles: InstalledBundle[] = [];
                        for (let i = 0; i < userBundleCount; i++) {
                            userBundles.push(createMockUserBundle(`user-bundle-${i}`, `${i + 1}.0.0`));
                        }
                        mockStorage.getInstalledBundles.resolves(userBundles);
                        
                        // Act: Query without scope filter
                        const result = await manager.listInstalledBundles();
                        
                        // Assert: Should return bundles from both sources
                        const expectedTotal = lockfileBundleCount + userBundleCount;
                        expect(result.length, `Should return ${expectedTotal} bundles (${lockfileBundleCount} from lockfile + ${userBundleCount} from storage)`).toBe(expectedTotal);
                        
                        // Verify we have both repository and user scope bundles
                        const repoBundles = result.filter(b => b.scope === 'repository');
                        const userScopeBundles = result.filter(b => b.scope === 'user');
                        
                        expect(repoBundles.length, `Should have ${lockfileBundleCount} repository bundles`).toBe(lockfileBundleCount);
                        expect(userScopeBundles.length, `Should have ${userBundleCount} user bundles`).toBe(userBundleCount);
                        
                        // Cleanup
                        fs.unlinkSync(lockfilePath);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.STANDARD
                }
            );
        });

        it('no scope filter should call both RegistryStorage and LockfileManager', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 0, max: 3 }),
                    async (bundleCount: number) => {
                        // Arrange: Create lockfile
                        const lockfile = createMockLockfile(bundleCount);
                        const lockfilePath = path.join(tempDir, 'prompt-registry.lock.json');
                        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
                        
                        // Reset call history
                        mockStorage.getInstalledBundles.resetHistory();
                        
                        // Act: Query without scope filter
                        await manager.listInstalledBundles();
                        
                        // Assert: RegistryStorage should be called (for user/workspace bundles)
                        expect(mockStorage.getInstalledBundles.called, 'RegistryStorage.getInstalledBundles should be called for combined query').toBe(true);
                        
                        // Cleanup
                        fs.unlinkSync(lockfilePath);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.QUICK
                }
            );
        });

        it('user scope should only query RegistryStorage, not lockfile', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 3 }),
                    async (lockfileBundleCount: number) => {
                        // Arrange: Create lockfile with bundles
                        const lockfile = createMockLockfile(lockfileBundleCount);
                        const lockfilePath = path.join(tempDir, 'prompt-registry.lock.json');
                        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
                        
                        // Create user bundles
                        const userBundles = [createMockUserBundle('user-bundle-1', '1.0.0')];
                        mockStorage.getInstalledBundles.resolves(userBundles);
                        
                        // Act: Query user scope
                        const result = await manager.listInstalledBundles('user');
                        
                        // Assert: Should return only user bundles, not lockfile bundles
                        expect(result.length, 'Should return only user bundles').toBe(1);
                        expect(result[0].scope, 'Returned bundle should have user scope').toBe('user');
                        
                        // Should NOT include repository bundles
                        const hasRepoBundles = result.some(b => b.scope === 'repository');
                        expect(hasRepoBundles, 'Should not include repository bundles when querying user scope').toBe(false);
                        
                        // Cleanup
                        fs.unlinkSync(lockfilePath);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.QUICK
                }
            );
        });

        it('workspace scope should only query RegistryStorage, not lockfile', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 3 }),
                    async (lockfileBundleCount: number) => {
                        // Arrange: Create lockfile with bundles
                        const lockfile = createMockLockfile(lockfileBundleCount);
                        const lockfilePath = path.join(tempDir, 'prompt-registry.lock.json');
                        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
                        
                        // Create workspace bundles
                        const workspaceBundles: InstalledBundle[] = [{
                            bundleId: 'workspace-bundle-1',
                            version: '1.0.0',
                            installedAt: new Date().toISOString(),
                            scope: 'workspace',
                            installPath: '/mock/workspace/path',
                            sourceId: 'mock-source',
                            sourceType: 'github',
                            manifest: {
                                common: { directories: [], files: [], include_patterns: [], exclude_patterns: [] },
                                bundle_settings: { include_common_in_environment_bundles: false, create_common_bundle: false, compression: 'none', naming: { environment_bundle: 'workspace-bundle-1' } },
                                metadata: { manifest_version: '1.0.0', description: 'Workspace bundle' }
                            }
                        }];
                        mockStorage.getInstalledBundles.resolves(workspaceBundles);
                        
                        // Act: Query workspace scope
                        const result = await manager.listInstalledBundles('workspace');
                        
                        // Assert: Should return only workspace bundles, not lockfile bundles
                        expect(result.length, 'Should return only workspace bundles').toBe(1);
                        expect(result[0].scope, 'Returned bundle should have workspace scope').toBe('workspace');
                        
                        // Should NOT include repository bundles
                        const hasRepoBundles = result.some(b => b.scope === 'repository');
                        expect(hasRepoBundles, 'Should not include repository bundles when querying workspace scope').toBe(false);
                        
                        // Cleanup
                        fs.unlinkSync(lockfilePath);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.QUICK
                }
            );
        });

        it('combined query should handle empty lockfile gracefully', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 3 }),
                    async (userBundleCount: number) => {
                        // Arrange: No lockfile exists
                        // Create user bundles
                        const userBundles: InstalledBundle[] = [];
                        for (let i = 0; i < userBundleCount; i++) {
                            userBundles.push(createMockUserBundle(`user-bundle-${i}`, `${i + 1}.0.0`));
                        }
                        mockStorage.getInstalledBundles.resolves(userBundles);
                        
                        // Act: Query without scope filter
                        const result = await manager.listInstalledBundles();
                        
                        // Assert: Should return only user bundles
                        expect(result.length, `Should return ${userBundleCount} user bundles when lockfile doesn't exist`).toBe(userBundleCount);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.QUICK
                }
            );
        });

        it('combined query should handle no workspace gracefully', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 3 }),
                    async (userBundleCount: number) => {
                        // Arrange: No workspace open
                        mockGetWorkspaceRoot.mockReturnValue(undefined);
                        
                        // Create user bundles
                        const userBundles: InstalledBundle[] = [];
                        for (let i = 0; i < userBundleCount; i++) {
                            userBundles.push(createMockUserBundle(`user-bundle-${i}`, `${i + 1}.0.0`));
                        }
                        mockStorage.getInstalledBundles.resolves(userBundles);
                        
                        // Act: Query without scope filter
                        const result = await manager.listInstalledBundles();
                        
                        // Assert: Should return only user bundles (no repository bundles without workspace)
                        expect(result.length, `Should return ${userBundleCount} user bundles when no workspace is open`).toBe(userBundleCount);
                        
                        // Restore workspace root for other tests
                        mockGetWorkspaceRoot.mockReturnValue(tempDir);
                        
                        return true;
                    }
                ),
                {
                    ...PropertyTestConfig.FAST_CHECK_OPTIONS,
                    numRuns: PropertyTestConfig.RUNS.QUICK
                }
            );
        });
    });
});
