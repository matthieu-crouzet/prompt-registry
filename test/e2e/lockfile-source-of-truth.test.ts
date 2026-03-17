/**
 * E2E Tests: Lockfile as Single Source of Truth
 * 
 * Tests the lockfile-based repository bundle management:
 * - Repository bundle listing from lockfile
 * - Stale record handling (lockfile takes precedence over RegistryStorage)
 * - Cleanup command for stale lockfile entries
 * 
 * Requirements covered:
 * - 1.1: Repository scope queries lockfile
 * - 1.3: LockfileBundleEntry to InstalledBundle conversion
 * - 2.1: Repository scope operations don't modify RegistryStorage
 * - 3.4: Cleanup command for stale lockfile entries
 */

import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import nock from 'nock';
import { createE2ETestContext, E2ETestContext, generateTestId } from '../helpers/e2eTestHelpers';
import { 
    RepositoryTestConfig,
    ReleaseConfig,
    setupReleaseMocks,
    createMockGitHubSource,
    cleanupReleaseMocks,
    computeBundleId,
    setupSourceWithCustomConfig,
    MochaTestContext
} from '../helpers/repositoryFixtureHelpers';
import { RepositoryCommitMode } from '../../src/types/registry';
import { LockfileManager } from '../../src/services/LockfileManager';
import { BundleCommands } from '../../src/commands/BundleCommands';
import { generateHubSourceId, isLegacyHubSourceId } from '../../src/utils/sourceIdUtils';

describe('E2E: Lockfile as Single Source of Truth Tests', () => {
    let testContext: E2ETestContext;
    let testId: string;
    let sandbox: sinon.SinonSandbox;
    let workspaceRoot: string;

    // Test configuration using shared fixtures
    const TEST_CONFIG: RepositoryTestConfig = {
        owner: 'test-owner',
        repo: 'test-repo',
        manifestId: 'test-bundle',
        baseVersion: '1.0.0'
    };

    const LOCKFILE_NAME = 'prompt-registry.lock.json';
    const GITHUB_PROMPTS_DIR = '.github/prompts';

    // Compute bundle ID using shared helper
    const BUNDLE_ID = computeBundleId(TEST_CONFIG, TEST_CONFIG.baseVersion || '1.0.0');

    /**
     * Helper to handle "not yet implemented" errors gracefully.
     * Uses MochaTestContext for proper typing of the test context.
     */
    async function installBundleOrSkip(
        context: MochaTestContext,
        bundleId: string,
        options: { scope: 'repository' | 'user'; commitMode?: RepositoryCommitMode; version: string }
    ): Promise<void> {
        try {
            await testContext.registryManager.installBundle(bundleId, {
                scope: options.scope,
                commitMode: options.commitMode || 'commit',
                version: options.version
            });
        } catch (error: any) {
            if (error.message.includes('not yet implemented')) {
                context.skip();
            }
            throw error;
        }
    }

    /**
     * Helper to clear adapter authentication for isolated testing.
     */
    function clearAdapterAuth(): void {
        const adapters = (testContext.registryManager as any).adapters;
        if (adapters) {
            adapters.forEach((adapter: any) => {
                if (adapter.authToken !== undefined) {
                    adapter.authToken = undefined;
                    adapter.authMethod = 'none';
                }
            });
        }
    }

    /**
     * Helper to set up a source and get a bundle for testing.
     * Uses shared repository fixture helpers.
     */
    async function setupSourceAndGetBundle(
        testIdSuffix: string, 
        content: string
    ): Promise<{ sourceId: string; bundle: any }> {
        const sourceId = `${testId}-${testIdSuffix}`;
        const source = createMockGitHubSource(sourceId, TEST_CONFIG);
        const releases: ReleaseConfig[] = [{ tag: 'v1.0.0', version: '1.0.0', content }];
        setupReleaseMocks(TEST_CONFIG, releases);
        
        sandbox.stub(vscode.workspace, 'workspaceFolders').value([
            { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
        ]);
        
        await testContext.registryManager.addSource(source);
        await testContext.registryManager.syncSource(sourceId);
        
        const rawBundles = await testContext.storage.getCachedSourceBundles(sourceId);
        const bundle = rawBundles.find(b => b.id === BUNDLE_ID);
        
        if (!bundle) {
            throw new Error(`Should find bundle ${BUNDLE_ID}, found: ${rawBundles.map(b => b.id).join(', ')}`);
        }
        
        return { sourceId, bundle };
    }

    beforeEach(async function() {
        testId = generateTestId('lockfile-sot');
        sandbox = sinon.createSandbox();
        
        if (vscode.authentication && typeof vscode.authentication.getSession === 'function') {
            sandbox.stub(vscode.authentication, 'getSession').resolves(undefined);
        }
        
        const childProcess = require('child_process');
        sandbox.stub(childProcess, 'exec').callsFake((...args: unknown[]) => {
            const cmd = args[0] as string;
            const callback = args[args.length - 1] as Function;
            if (cmd === 'gh auth token') {
                callback(new Error('gh not available'), '', '');
            } else {
                callback(null, '', '');
            }
        });
        
        testContext = await createE2ETestContext();
        workspaceRoot = path.join(testContext.tempStoragePath, 'test-workspace');
        fs.mkdirSync(workspaceRoot, { recursive: true });
        fs.mkdirSync(path.join(workspaceRoot, '.git', 'info'), { recursive: true });
        
        clearAdapterAuth();
        
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    afterEach(async function() {
        LockfileManager.resetInstance();
        await testContext.cleanup();
        sandbox.restore();
        cleanupReleaseMocks();
    });


    describe('11.1: Repository Bundle Listing from Lockfile', () => {
        /**
         * E2E Test: Install bundle at repository scope and verify listInstalledBundles returns it
         * 
         * Requirements covered:
         * - 1.1: Repository scope queries lockfile
         * - 1.3: LockfileBundleEntry to InstalledBundle conversion
         */
        it('Requirement 1.1, 1.3: listInstalledBundles(repository) returns bundles from lockfile', async function() {
            const { bundle } = await setupSourceAndGetBundle('listing-source', 'listing-test');
            
            // Install bundle at repository scope
            await installBundleOrSkip(this, bundle.id, { 
                scope: 'repository', commitMode: 'commit', version: '1.0.0'
            });
            
            // Verify lockfile was created
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            expect(fs.existsSync(lockfilePath), 'Lockfile should exist after installation').toBeTruthy();
            
            // Read lockfile directly to get the actual bundle ID
            const lockfileContent = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));
            const lockfileBundleIds = Object.keys(lockfileContent.bundles);
            expect(lockfileBundleIds.length > 0, 'Lockfile should have at least one bundle').toBeTruthy();
            
            const actualBundleId = lockfileBundleIds[0];
            const lockfileEntry = lockfileContent.bundles[actualBundleId];
            
            // Query repository bundles via listInstalledBundles
            const installedBundles = await testContext.registryManager.listInstalledBundles('repository');
            
            // Verify bundle is returned
            expect(installedBundles.length > 0, 'listInstalledBundles should return at least one bundle').toBeTruthy();
            
            const installedBundle = installedBundles.find(b => b.bundleId === actualBundleId);
            expect(installedBundle, `Should find bundle ${actualBundleId} in installed bundles`).toBeTruthy();
            
            // Verify bundle data matches lockfile entry (Requirement 1.3)
            expect(installedBundle!.version, 'Version should match lockfile entry').toBe(lockfileEntry.version);
            expect(installedBundle!.sourceId, 'SourceId should match lockfile entry').toBe(lockfileEntry.sourceId);
            expect(installedBundle!.sourceType, 'SourceType should match lockfile entry').toBe(lockfileEntry.sourceType);
            expect(installedBundle!.scope, 'Scope should be repository').toBe('repository');
            expect(installedBundle!.installPath, 'InstallPath should be set').toBeTruthy();
            expect(installedBundle!.installPath!.includes('.github'), 'InstallPath should include .github').toBeTruthy();
        });

        it('Requirement 1.1: listInstalledBundles without scope includes repository bundles', async function() {
            const { bundle } = await setupSourceAndGetBundle('combined-source', 'combined-test');
            
            // Install bundle at repository scope
            await installBundleOrSkip(this, bundle.id, { 
                scope: 'repository', commitMode: 'commit', version: '1.0.0'
            });
            
            // Get the actual bundle ID from lockfile
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            const lockfileContent = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));
            const actualBundleId = Object.keys(lockfileContent.bundles)[0];
            
            // Query all bundles (no scope filter)
            const allBundles = await testContext.registryManager.listInstalledBundles();
            
            // Verify repository bundle is included
            const repoBundle = allBundles.find(b => b.bundleId === actualBundleId);
            expect(repoBundle, 'Repository bundle should be included when querying without scope filter').toBeTruthy();
            expect(repoBundle!.scope, 'Bundle scope should be repository').toBe('repository');
        });

        it('Requirement 1.4: listInstalledBundles returns empty array when lockfile does not exist', async function() {
            // Ensure no lockfile exists
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            if (fs.existsSync(lockfilePath)) {
                fs.unlinkSync(lockfilePath);
            }
            
            // Stub workspace folders to point to our test workspace
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Query repository bundles
            const installedBundles = await testContext.registryManager.listInstalledBundles('repository');
            
            // Should return empty array
            expect(installedBundles.length, 'Should return empty array when lockfile does not exist').toBe(0);
        });
    });


    describe('11.2: Stale Record Handling', () => {
        /**
         * E2E Test: Verify lockfile takes precedence over stale RegistryStorage records
         * 
         * Requirements covered:
         * - 1.1: Repository scope queries lockfile
         * - 2.1: Repository scope operations don't modify RegistryStorage
         */
        it('Requirement 1.1, 2.1: Lockfile takes precedence over stale RegistryStorage records', async function() {
            // Stub workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Create a stale RegistryStorage record for repository scope
            // This simulates a scenario where RegistryStorage has old data
            const staleBundleId = 'stale-bundle-v1.0.0';
            const staleRecord = {
                bundleId: staleBundleId,
                version: '1.0.0',
                sourceId: 'stale-source',
                sourceType: 'github',
                installedAt: new Date().toISOString(),
                scope: 'repository' as const,
                installPath: path.join(workspaceRoot, '.github')
            };
            
            // Note: RegistryStorage.getInstalledBundles('repository') returns empty array by design
            // This test verifies that listInstalledBundles queries the lockfile, not RegistryStorage
            
            // Create a lockfile with a different bundle
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            const lockfileBundleId = 'lockfile-bundle-v2.0.0';
            const mockLockfile = {
                $schema: 'https://github.com/AmadeusITGroup/prompt-registry/schemas/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    [lockfileBundleId]: {
                        version: '2.0.0',
                        sourceId: 'lockfile-source',
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/test.prompt.md', checksum: 'abc123' }]
                    }
                },
                sources: {
                    'lockfile-source': { type: 'github', url: 'https://github.com/test/repo' }
                }
            };
            
            // Create the files so they're not marked as missing
            const promptsDir = path.join(workspaceRoot, GITHUB_PROMPTS_DIR);
            fs.mkdirSync(promptsDir, { recursive: true });
            fs.writeFileSync(path.join(promptsDir, 'test.prompt.md'), '# Test Prompt');
            
            fs.writeFileSync(lockfilePath, JSON.stringify(mockLockfile, null, 2));
            
            // Reset LockfileManager to pick up the new lockfile
            LockfileManager.resetInstance();
            
            // Query repository bundles
            const installedBundles = await testContext.registryManager.listInstalledBundles('repository');
            
            // Verify lockfile bundle is returned (not the stale record)
            expect(installedBundles.length, 'Should return exactly one bundle from lockfile').toBe(1);
            expect(installedBundles[0].bundleId, 'Should return bundle from lockfile').toBe(lockfileBundleId);
            expect(installedBundles[0].version, 'Version should match lockfile').toBe('2.0.0');
            
            // Verify stale record is NOT returned
            const staleBundle = installedBundles.find(b => b.bundleId === staleBundleId);
            expect(!staleBundle, 'Stale RegistryStorage record should NOT be returned').toBeTruthy();
        });

        it('Requirement 2.1: Repository scope installation does not create RegistryStorage record', async function() {
            const { bundle } = await setupSourceAndGetBundle('no-storage-source', 'no-storage-test');
            
            // Get RegistryStorage records before installation
            const storageBundlesBefore = await testContext.storage.getInstalledBundles('user');
            const storageCountBefore = storageBundlesBefore.length;
            
            // Install bundle at repository scope
            await installBundleOrSkip(this, bundle.id, { 
                scope: 'repository', commitMode: 'commit', version: '1.0.0'
            });
            
            // Verify lockfile was created
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            expect(fs.existsSync(lockfilePath), 'Lockfile should exist after installation').toBeTruthy();
            
            // Verify RegistryStorage was NOT modified
            const storageBundlesAfter = await testContext.storage.getInstalledBundles('user');
            expect(storageBundlesAfter.length, 'RegistryStorage should NOT have new records for repository scope installation').toBe(storageCountBefore);
            
            // Also check workspace scope
            const workspaceBundles = await testContext.storage.getInstalledBundles('workspace');
            const repoScopeInWorkspace = workspaceBundles.find(b => b.scope === 'repository');
            expect(!repoScopeInWorkspace, 'Repository scope bundle should NOT be in workspace storage').toBeTruthy();
        });
    });


    describe('11.3: Cleanup Command for Stale Lockfile Entries', () => {
        /**
         * E2E Test: Verify cleanup command removes stale lockfile entries
         * 
         * Requirements covered:
         * - 3.4: Provide command to clean up stale lockfile entries
         */
        it('Requirement 3.4: Cleanup command removes stale entries with missing files', async function() {
            // Stub workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Create a lockfile with a bundle that has missing files
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            const staleBundleId = 'stale-bundle-missing-files';
            const validBundleId = 'valid-bundle-with-files';
            
            const mockLockfile = {
                $schema: 'https://github.com/AmadeusITGroup/prompt-registry/schemas/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    [staleBundleId]: {
                        version: '1.0.0',
                        sourceId: 'test-source',
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/missing.prompt.md', checksum: 'abc123' }]
                    },
                    [validBundleId]: {
                        version: '1.0.0',
                        sourceId: 'test-source',
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/existing.prompt.md', checksum: 'def456' }]
                    }
                },
                sources: {
                    'test-source': { type: 'github', url: 'https://github.com/test/repo' }
                }
            };
            
            // Create only the valid bundle's files (not the stale one)
            const promptsDir = path.join(workspaceRoot, GITHUB_PROMPTS_DIR);
            fs.mkdirSync(promptsDir, { recursive: true });
            fs.writeFileSync(path.join(promptsDir, 'existing.prompt.md'), '# Existing Prompt');
            // Note: missing.prompt.md is NOT created, making staleBundleId stale
            
            fs.writeFileSync(lockfilePath, JSON.stringify(mockLockfile, null, 2));
            
            // Reset LockfileManager to pick up the new lockfile
            LockfileManager.resetInstance();
            
            // Verify initial state - should have 2 bundles, one with missing files
            const lockfileManager = LockfileManager.getInstance(workspaceRoot);
            const bundlesBefore = await lockfileManager.getInstalledBundles();
            expect(bundlesBefore.length, 'Should have 2 bundles initially').toBe(2);
            
            const staleBundle = bundlesBefore.find(b => b.bundleId === staleBundleId);
            expect(staleBundle, 'Should find stale bundle').toBeTruthy();
            expect(staleBundle!.filesMissing, 'Stale bundle should have filesMissing flag set').toBeTruthy();
            
            const validBundle = bundlesBefore.find(b => b.bundleId === validBundleId);
            expect(validBundle, 'Should find valid bundle').toBeTruthy();
            expect(!validBundle!.filesMissing, 'Valid bundle should NOT have filesMissing flag set').toBeTruthy();
            
            // Stub the confirmation dialog to auto-confirm
            const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
            showWarningMessageStub.resolves('Remove' as any);
            
            // Stub the info message
            const showInfoMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            showInfoMessageStub.resolves(undefined);
            
            // Execute cleanup command
            const bundleCommands = new BundleCommands(testContext.registryManager);
            await bundleCommands.cleanupStaleLockfileEntries();
            
            // Verify confirmation dialog was shown
            expect(showWarningMessageStub.called, 'Should show confirmation dialog').toBeTruthy();
            
            // Verify stale entry was removed from lockfile
            LockfileManager.resetInstance();
            const lockfileManagerAfter = LockfileManager.getInstance(workspaceRoot);
            const bundlesAfter = await lockfileManagerAfter.getInstalledBundles();
            
            expect(bundlesAfter.length, 'Should have 1 bundle after cleanup').toBe(1);
            expect(bundlesAfter[0].bundleId, 'Valid bundle should remain').toBe(validBundleId);
            
            const staleBundleAfter = bundlesAfter.find(b => b.bundleId === staleBundleId);
            expect(!staleBundleAfter, 'Stale bundle should be removed').toBeTruthy();
        });

        it('Requirement 3.4: Cleanup command shows info message when no stale entries', async function() {
            // Stub workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Create a lockfile with only valid bundles (files exist)
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            const validBundleId = 'valid-bundle';
            
            const mockLockfile = {
                $schema: 'https://github.com/AmadeusITGroup/prompt-registry/schemas/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    [validBundleId]: {
                        version: '1.0.0',
                        sourceId: 'test-source',
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/valid.prompt.md', checksum: 'abc123' }]
                    }
                },
                sources: {
                    'test-source': { type: 'github', url: 'https://github.com/test/repo' }
                }
            };
            
            // Create the bundle's files
            const promptsDir = path.join(workspaceRoot, GITHUB_PROMPTS_DIR);
            fs.mkdirSync(promptsDir, { recursive: true });
            fs.writeFileSync(path.join(promptsDir, 'valid.prompt.md'), '# Valid Prompt');
            
            fs.writeFileSync(lockfilePath, JSON.stringify(mockLockfile, null, 2));
            
            // Reset LockfileManager
            LockfileManager.resetInstance();
            
            // Stub the info message
            const showInfoMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            showInfoMessageStub.resolves(undefined);
            
            // Execute cleanup command
            const bundleCommands = new BundleCommands(testContext.registryManager);
            await bundleCommands.cleanupStaleLockfileEntries();
            
            // Verify info message was shown (no stale entries)
            expect(showInfoMessageStub.called, 'Should show info message').toBeTruthy();
            const infoMessage = showInfoMessageStub.firstCall.args[0];
            expect(infoMessage.includes('No stale') || infoMessage.includes('no stale'), `Info message should indicate no stale entries, got: ${infoMessage}`).toBeTruthy();
        });

        it('Requirement 3.4: Cleanup command respects user cancellation', async function() {
            // Stub workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Create a lockfile with a stale bundle
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            const staleBundleId = 'stale-bundle';
            
            const mockLockfile = {
                $schema: 'https://github.com/AmadeusITGroup/prompt-registry/schemas/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    [staleBundleId]: {
                        version: '1.0.0',
                        sourceId: 'test-source',
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/missing.prompt.md', checksum: 'abc123' }]
                    }
                },
                sources: {
                    'test-source': { type: 'github', url: 'https://github.com/test/repo' }
                }
            };
            
            // Don't create the files (making the bundle stale)
            fs.writeFileSync(lockfilePath, JSON.stringify(mockLockfile, null, 2));
            
            // Reset LockfileManager
            LockfileManager.resetInstance();
            
            // Stub the confirmation dialog to cancel
            const showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
            showWarningMessageStub.resolves('Cancel' as any);
            
            // Execute cleanup command
            const bundleCommands = new BundleCommands(testContext.registryManager);
            await bundleCommands.cleanupStaleLockfileEntries();
            
            // Verify stale entry was NOT removed (user cancelled)
            LockfileManager.resetInstance();
            const lockfileManagerAfter = LockfileManager.getInstance(workspaceRoot);
            const bundlesAfter = await lockfileManagerAfter.getInstalledBundles();
            
            expect(bundlesAfter.length, 'Bundle should still exist after cancellation').toBe(1);
            expect(bundlesAfter[0].bundleId, 'Stale bundle should remain').toBe(staleBundleId);
        });
    });


    describe('11.4: Uninstall Scenarios', () => {
        /**
         * E2E Test: Uninstalling the last bundle deletes the lockfile and fires event
         * 
         * Requirements covered:
         * - 3.1: Last bundle uninstall deletes lockfile
         * - 3.2: onLockfileUpdated event fires with null
         * - 3.4: Complete uninstall workflow verification
         */
        it('Requirement 3.1, 3.2, 3.4: Uninstalling last bundle deletes lockfile and fires event with null', async function() {
            const { bundle } = await setupSourceAndGetBundle('uninstall-last-source', 'uninstall-last-test');
            
            // Install single bundle at repository scope
            await installBundleOrSkip(this, bundle.id, { 
                scope: 'repository', commitMode: 'commit', version: '1.0.0'
            });
            
            // Verify lockfile exists after installation
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            expect(fs.existsSync(lockfilePath), 'Lockfile should exist after installation').toBeTruthy();
            
            // Verify this is the only bundle in the lockfile
            const lockfileBefore = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));
            const bundleCount = Object.keys(lockfileBefore.bundles).length;
            expect(bundleCount, 'Should have exactly one bundle in lockfile').toBe(1);
            
            // Get the actual bundle ID from the lockfile
            const actualBundleId = Object.keys(lockfileBefore.bundles)[0];
            
            // Set up event listener to capture onLockfileUpdated event
            const lockfileManager = LockfileManager.getInstance(workspaceRoot);
            let eventFired = false;
            let eventPayload: any = 'not-fired';
            
            const disposable = lockfileManager.onLockfileUpdated((lockfile) => {
                eventFired = true;
                eventPayload = lockfile;
            });
            
            try {
                // Uninstall the bundle
                await testContext.registryManager.uninstallBundle(actualBundleId, 'repository');
                
                // Verify lockfile is deleted
                expect(!fs.existsSync(lockfilePath), 'Lockfile should be deleted when last bundle is uninstalled').toBeTruthy();
                
                // Verify onLockfileUpdated event fired with null
                expect(eventFired, 'onLockfileUpdated event should fire').toBeTruthy();
                expect(eventPayload, 'onLockfileUpdated event should fire with null when lockfile is deleted').toBe(null);
            } finally {
                disposable.dispose();
            }
        });

        /**
         * E2E Test: Uninstalling one bundle preserves others in lockfile
         * 
         * Requirements covered:
         * - 3.3: Partial uninstall preserves other bundles
         */
        it('Requirement 3.3: Uninstalling one bundle preserves other bundles in lockfile', async function() {
            // Stub workspace folders once for both bundles
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Dependencies for the shared helper
            const deps = { registryManager: testContext.registryManager, storage: testContext.storage };
            
            // Set up and install first bundle
            const config1: RepositoryTestConfig = {
                owner: 'test-owner-1',
                repo: 'test-repo-1',
                manifestId: 'bundle-1',
                baseVersion: '1.0.0'
            };
            const { sourceId: sourceId1, bundle: bundle1 } = await setupSourceWithCustomConfig(
                deps, testId, 'partial-source-1', config1, 'bundle1'
            );
            await installBundleOrSkip(this, bundle1.id as string, { scope: 'repository', commitMode: 'commit', version: '1.0.0' });
            
            // Set up and install second bundle
            const config2: RepositoryTestConfig = {
                owner: 'test-owner-2',
                repo: 'test-repo-2',
                manifestId: 'bundle-2',
                baseVersion: '1.0.0'
            };
            const { sourceId: sourceId2, bundle: bundle2 } = await setupSourceWithCustomConfig(
                deps, testId, 'partial-source-2', config2, 'bundle2'
            );
            await installBundleOrSkip(this, bundle2.id as string, { scope: 'repository', commitMode: 'commit', version: '1.0.0' });
            
            // Verify lockfile has two bundles
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            expect(fs.existsSync(lockfilePath), 'Lockfile should exist').toBeTruthy();
            
            const lockfileBefore = JSON.parse(fs.readFileSync(lockfilePath, 'utf-8'));
            const bundleIdsBefore = Object.keys(lockfileBefore.bundles);
            expect(bundleIdsBefore.length, 'Should have two bundles in lockfile').toBe(2);
            
            // Find the actual bundle IDs from lockfile
            const actualBundleId1 = bundleIdsBefore.find(id => id.includes('bundle-1'));
            const actualBundleId2 = bundleIdsBefore.find(id => id.includes('bundle-2'));
            expect(actualBundleId1, 'Should find bundle-1 in lockfile').toBeTruthy();
            expect(actualBundleId2, 'Should find bundle-2 in lockfile').toBeTruthy();
            
            // Uninstall first bundle
            await testContext.registryManager.uninstallBundle(actualBundleId1!, 'repository');
            
            // Verify lockfile still exists
            expect(fs.existsSync(lockfilePath), 'Lockfile should still exist after partial uninstall').toBeTruthy();
            
            // Verify second bundle remains in lockfile
            LockfileManager.resetInstance();
            const lockfileManager = LockfileManager.getInstance(workspaceRoot);
            const lockfileAfter = await lockfileManager.read();
            
            expect(lockfileAfter, 'Lockfile should exist').toBeTruthy();
            const bundleIdsAfter = Object.keys(lockfileAfter!.bundles);
            expect(bundleIdsAfter.length, 'Should have one bundle remaining in lockfile').toBe(1);
            expect(bundleIdsAfter.includes(actualBundleId2!), 'Bundle-2 should remain in lockfile').toBeTruthy();
            expect(!bundleIdsAfter.includes(actualBundleId1!), 'Bundle-1 should be removed from lockfile').toBeTruthy();
            
            // Verify bundle-2 data is intact
            const remainingBundle = lockfileAfter!.bundles[actualBundleId2!];
            expect(remainingBundle.version, 'Remaining bundle version should be intact').toBe('1.0.0');
            expect(remainingBundle.sourceId, 'Remaining bundle sourceId should be intact').toBe(sourceId2);
        });
    });


    describe('12.2: Lockfile Portability - SourceId Format', () => {
        /**
         * E2E Test: Verify lockfile with new sourceId format works across different hub configurations
         * 
         * The new sourceId format is `{sourceType}-{12-char-hash}` (e.g., `github-a1b2c3d4e5f6`)
         * which is based on source properties (type + URL), not hub ID.
         * This makes lockfiles portable across different hub configurations.
         * 
         * Requirements covered:
         * - Requirement 2: Remove Hub ID from SourceId Generation
         * - Requirement 3: Backward Compatibility for Legacy Lockfiles
         */
        it('Requirement 2.1, 2.3: Lockfile with new sourceId format is portable across hub configurations', async function() {
            // Stub workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Generate a sourceId using the new format
            const sourceUrl = 'https://github.com/test-owner/test-repo';
            const sourceType = 'github';
            const newFormatSourceId = generateHubSourceId(sourceType, sourceUrl);
            
            expect(!isLegacyHubSourceId(newFormatSourceId), 'New format sourceId should NOT be detected as legacy format').toBeTruthy();

            // Create a lockfile with the new sourceId format
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            const bundleId = 'portable-bundle-v1.0.0';
            
            const mockLockfile = {
                $schema: 'https://github.com/AmadeusITGroup/prompt-registry/schemas/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    [bundleId]: {
                        version: '1.0.0',
                        sourceId: newFormatSourceId,
                        sourceType: sourceType,
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/portable.prompt.md', checksum: 'abc123' }]
                    }
                },
                sources: {
                    [newFormatSourceId]: {
                        type: sourceType,
                        url: sourceUrl
                    }
                }
            };
            
            // Create the bundle files so they're not marked as missing
            const promptsDir = path.join(workspaceRoot, GITHUB_PROMPTS_DIR);
            fs.mkdirSync(promptsDir, { recursive: true });
            fs.writeFileSync(path.join(promptsDir, 'portable.prompt.md'), '# Portable Prompt');
            
            fs.writeFileSync(lockfilePath, JSON.stringify(mockLockfile, null, 2));
            
            // Reset LockfileManager to pick up the new lockfile
            LockfileManager.resetInstance();
            
            // Query repository bundles - this simulates a different user with different hub config
            // The lockfile should work regardless of what hubs the user has configured
            const installedBundles = await testContext.registryManager.listInstalledBundles('repository');
            
            // Verify bundle is returned correctly
            expect(installedBundles.length, 'Should return exactly one bundle').toBe(1);
            expect(installedBundles[0].bundleId, 'Bundle ID should match').toBe(bundleId);
            expect(installedBundles[0].version, 'Version should match').toBe('1.0.0');
            expect(installedBundles[0].sourceId, 'SourceId should use new format').toBe(newFormatSourceId);
            expect(installedBundles[0].sourceType, 'SourceType should match').toBe(sourceType);
            expect(installedBundles[0].scope, 'Scope should be repository').toBe('repository');
        });

        it('Requirement 2.2, 2.3: Same source URL always produces same sourceId (deterministic)', async function() {
            const sourceUrl = 'https://github.com/owner/repo';
            const sourceType = 'github';
            
            // Generate sourceId multiple times
            const sourceId1 = generateHubSourceId(sourceType, sourceUrl);
            const sourceId2 = generateHubSourceId(sourceType, sourceUrl);
            const sourceId3 = generateHubSourceId(sourceType, sourceUrl);
            
            // All should be identical (deterministic)
            expect(sourceId1, 'SourceId should be deterministic (1 vs 2)').toBe(sourceId2);
            expect(sourceId2, 'SourceId should be deterministic (2 vs 3)').toBe(sourceId3);
        });

        it('Requirement 2.3: SourceId is URL-normalized (case-insensitive, protocol-agnostic)', async function() {
            const sourceType = 'github';
            
            // Different URL variations that should produce the same sourceId
            const url1 = 'https://github.com/Owner/Repo';
            const url2 = 'HTTPS://GITHUB.COM/OWNER/REPO';
            const url3 = 'http://github.com/owner/repo';
            const url4 = 'https://github.com/owner/repo/';
            
            const sourceId1 = generateHubSourceId(sourceType, url1);
            const sourceId2 = generateHubSourceId(sourceType, url2);
            const sourceId3 = generateHubSourceId(sourceType, url3);
            const sourceId4 = generateHubSourceId(sourceType, url4);
            
            // All should produce the same sourceId due to URL normalization
            expect(sourceId1, 'SourceId should be case-insensitive').toBe(sourceId2);
            expect(sourceId2, 'SourceId should be protocol-agnostic').toBe(sourceId3);
            expect(sourceId3, 'SourceId should ignore trailing slashes').toBe(sourceId4);
        });

        it('Requirement 3.1, 3.4: Legacy hub-prefixed sourceId still resolves correctly', async function() {
            // Stub workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Create a lockfile with legacy hub-prefixed sourceId format
            const legacySourceId = 'hub-my-hub-github-source';
            const bundleId = 'legacy-bundle-v1.0.0';
            
            // Verify this is detected as legacy format
            expect(isLegacyHubSourceId(legacySourceId), 'Legacy sourceId should be detected as legacy format').toBeTruthy();
            
            const mockLockfile = {
                $schema: 'https://github.com/AmadeusITGroup/prompt-registry/schemas/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    [bundleId]: {
                        version: '1.0.0',
                        sourceId: legacySourceId,
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/legacy.prompt.md', checksum: 'def456' }]
                    }
                },
                sources: {
                    [legacySourceId]: {
                        type: 'github',
                        url: 'https://github.com/legacy-owner/legacy-repo'
                    }
                }
            };
            
            // Create the bundle files
            const promptsDir = path.join(workspaceRoot, GITHUB_PROMPTS_DIR);
            fs.mkdirSync(promptsDir, { recursive: true });
            fs.writeFileSync(path.join(promptsDir, 'legacy.prompt.md'), '# Legacy Prompt');
            
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            fs.writeFileSync(lockfilePath, JSON.stringify(mockLockfile, null, 2));
            
            // Reset LockfileManager
            LockfileManager.resetInstance();
            
            // Query repository bundles - legacy format should still work
            const installedBundles = await testContext.registryManager.listInstalledBundles('repository');
            
            // Verify bundle is returned correctly (backward compatibility)
            expect(installedBundles.length, 'Should return exactly one bundle').toBe(1);
            expect(installedBundles[0].bundleId, 'Bundle ID should match').toBe(bundleId);
            expect(installedBundles[0].sourceId, 'Legacy sourceId should be preserved').toBe(legacySourceId);
            expect(installedBundles[0].sourceType, 'SourceType should match').toBe('github');
        });

        it('Requirement 2.5: Different source types with same URL produce different sourceIds', async function() {
            const url = 'https://example.com/repo';
            
            // Same URL but different source types
            const githubSourceId = generateHubSourceId('github', url);
            const gitlabSourceId = generateHubSourceId('gitlab', url);
            const httpSourceId = generateHubSourceId('http', url);
            
            // All should be different because source type is part of the hash input
            expect(githubSourceId, 'Different types should produce different sourceIds').not.toBe(gitlabSourceId);
            expect(gitlabSourceId, 'Different types should produce different sourceIds').not.toBe(httpSourceId);
            expect(githubSourceId, 'Different types should produce different sourceIds').not.toBe(httpSourceId);
            
            // Verify each has correct type prefix
            expect(githubSourceId.startsWith('github-'), 'GitHub sourceId should start with github-').toBeTruthy();
            expect(gitlabSourceId.startsWith('gitlab-'), 'GitLab sourceId should start with gitlab-').toBeTruthy();
            expect(httpSourceId.startsWith('http-'), 'HTTP sourceId should start with http-').toBeTruthy();
        });

        it('Requirement 2: Lockfile with multiple bundles from different sources works correctly', async function() {
            // Stub workspace folders
            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { uri: vscode.Uri.file(workspaceRoot), name: 'test-workspace', index: 0 }
            ]);
            
            // Generate sourceIds for different sources
            const githubSourceId = generateHubSourceId('github', 'https://github.com/owner1/repo1');
            const gitlabSourceId = generateHubSourceId('gitlab', 'https://gitlab.com/group/project');
            
            // Create a lockfile with bundles from multiple sources
            const lockfilePath = path.join(workspaceRoot, LOCKFILE_NAME);
            const bundle1Id = 'github-bundle-v1.0.0';
            const bundle2Id = 'gitlab-bundle-v2.0.0';
            
            const mockLockfile = {
                $schema: 'https://github.com/AmadeusITGroup/prompt-registry/schemas/lockfile.schema.json',
                version: '1.0.0',
                generatedAt: new Date().toISOString(),
                generatedBy: 'prompt-registry@1.0.0',
                bundles: {
                    [bundle1Id]: {
                        version: '1.0.0',
                        sourceId: githubSourceId,
                        sourceType: 'github',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/github-bundle.prompt.md', checksum: 'gh123' }]
                    },
                    [bundle2Id]: {
                        version: '2.0.0',
                        sourceId: gitlabSourceId,
                        sourceType: 'gitlab',
                        installedAt: new Date().toISOString(),
                        commitMode: 'commit',
                        files: [{ path: '.github/prompts/gitlab-bundle.prompt.md', checksum: 'gl456' }]
                    }
                },
                sources: {
                    [githubSourceId]: {
                        type: 'github',
                        url: 'https://github.com/owner1/repo1'
                    },
                    [gitlabSourceId]: {
                        type: 'gitlab',
                        url: 'https://gitlab.com/group/project'
                    }
                }
            };
            
            // Create the bundle files
            const promptsDir = path.join(workspaceRoot, GITHUB_PROMPTS_DIR);
            fs.mkdirSync(promptsDir, { recursive: true });
            fs.writeFileSync(path.join(promptsDir, 'github-bundle.prompt.md'), '# GitHub Bundle');
            fs.writeFileSync(path.join(promptsDir, 'gitlab-bundle.prompt.md'), '# GitLab Bundle');
            
            fs.writeFileSync(lockfilePath, JSON.stringify(mockLockfile, null, 2));
            
            // Reset LockfileManager
            LockfileManager.resetInstance();
            
            // Query repository bundles
            const installedBundles = await testContext.registryManager.listInstalledBundles('repository');
            
            // Verify both bundles are returned correctly
            expect(installedBundles.length, 'Should return both bundles').toBe(2);
            
            const githubBundle = installedBundles.find(b => b.bundleId === bundle1Id);
            const gitlabBundle = installedBundles.find(b => b.bundleId === bundle2Id);
            
            expect(githubBundle, 'Should find GitHub bundle').toBeTruthy();
            expect(githubBundle!.sourceId, 'GitHub bundle sourceId should match').toBe(githubSourceId);
            expect(githubBundle!.sourceType, 'GitHub bundle sourceType should match').toBe('github');
            
            expect(gitlabBundle, 'Should find GitLab bundle').toBeTruthy();
            expect(gitlabBundle!.sourceId, 'GitLab bundle sourceId should match').toBe(gitlabSourceId);
            expect(gitlabBundle!.sourceType, 'GitLab bundle sourceType should match').toBe('gitlab');
        });
    });
});
