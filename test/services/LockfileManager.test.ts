/**
 * LockfileManager Unit Tests
 * 
 * Tests for the LockfileManager service that manages prompt-registry.lock.json files.
 * Following TDD approach - these tests are written before the implementation.
 * 
 * Requirements covered:
 * - 4.1-4.10: Lockfile creation and management
 * - 5.1-5.7: Lockfile detection and auto-sync
 * - 12.1-12.6: Source and hub tracking
 */

import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import {
    LockfileBuilder,
    createMockLockfile,
    createMockBundleEntry,
    createMockFileEntry,
    createMockSourceEntry,
    createMockHubEntry,
    createMockProfileEntry,
    LOCKFILE_DEFAULTS
} from '../helpers/lockfileTestHelpers';
import { Lockfile, LockfileValidationResult, ModifiedFileInfo } from '../../src/types/lockfile';
import { LockfileManager, CreateOrUpdateOptions } from '../../src/services/LockfileManager';
import { calculateFileChecksum } from '../../src/utils/fileIntegrityService';
import { Logger } from '../../src/utils/logger';

describe('LockfileManager', () => {
    let sandbox: sinon.SinonSandbox;
    let tempDir: string;
    let lockfilePath: string;

    // ===== Test Utilities =====
    const createTempDir = (): string => {
        const dir = path.join(__dirname, '..', '..', 'test-temp-lockfile-' + Date.now());
        fs.mkdirSync(dir, { recursive: true });
        return dir;
    };

    const cleanupTempDir = (dir: string): void => {
        if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };

    const writeLockfile = (lockfile: Lockfile): void => {
        fs.writeFileSync(lockfilePath, JSON.stringify(lockfile, null, 2));
    };

    const readLockfileFromDisk = (): Lockfile | null => {
        if (!fs.existsSync(lockfilePath)) {
            return null;
        }
        return JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));
    };

    const createTestOptions = (bundleId: string, version: string = '1.0.0'): CreateOrUpdateOptions => ({
        bundleId,
        version,
        sourceId: 'test-source',
        sourceType: 'github',
        commitMode: 'commit',
        files: [createMockFileEntry('.github/prompts/test.prompt.md')],
        source: createMockSourceEntry('github', 'https://github.com/owner/repo')
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        tempDir = createTempDir();
        lockfilePath = path.join(tempDir, 'prompt-registry.lock.json');
        // Reset singleton for each test
        LockfileManager.resetInstance();
    });

    afterEach(() => {
        sandbox.restore();
        LockfileManager.resetInstance();
        cleanupTempDir(tempDir);
    });

    describe('Singleton Pattern', () => {
        it('should return same instance on multiple calls', () => {
            const instance1 = LockfileManager.getInstance(tempDir);
            const instance2 = LockfileManager.getInstance(tempDir);
            expect(instance1).toBe(instance2);
        });

        it('should require repository path on first call', () => {
            LockfileManager.resetInstance();
            expect(() => {
                LockfileManager.getInstance();
            }).toThrow(/Repository path required/);
        });
    });

    describe('createOrUpdate()', () => {
        describe('Lockfile Creation', () => {
            it('should create lockfile with all required fields', async () => {
                // Requirements: 4.2-4.7
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('test-bundle');
                
                await manager.createOrUpdate(options);
                
                const lockfile = readLockfileFromDisk();
                expect(lockfile).toBeTruthy();
                expect(lockfile!.$schema).toBeTruthy();
                expect(lockfile!.version).toBeTruthy();
                expect(lockfile!.generatedAt).toBeTruthy();
                expect(lockfile!.generatedBy).toBeTruthy();
                expect(lockfile!.bundles).toBeTruthy();
                expect(lockfile!.sources).toBeTruthy();
            });

            it('should include $schema field pointing to schema definition', async () => {
                // Requirements: 11.4
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.$schema.includes('lockfile.schema.json')).toBeTruthy();
            });

            it('should include version field with schema version', async () => {
                // Requirements: 4.2
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.version).toMatch(/^\d+\.\d+\.\d+$/);
            });

            it('should include generatedAt ISO timestamp', async () => {
                // Requirements: 4.3
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(new Date(lockfile!.generatedAt).toISOString() === lockfile!.generatedAt).toBeTruthy();
            });

            it('should include generatedBy with extension name and version', async () => {
                // Requirements: 4.4
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.generatedBy.includes('prompt-registry')).toBeTruthy();
            });

            it('should use 2-space indentation for readability', async () => {
                // Requirements: 4.10
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const content = fs.readFileSync(lockfilePath, 'utf8');
                expect(content.includes('  "version"')).toBeTruthy();
            });
        });

        describe('Bundle Entry Management', () => {
            it('should add bundle entry to lockfile', async () => {
                // Requirements: 4.5
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.bundles['my-bundle']).toBeTruthy();
            });

            it('should include version in bundle entry', async () => {
                // Requirements: 4.6
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle', '1.0.0'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.bundles['my-bundle'].version).toBe('1.0.0');
            });

            it('should include sourceId in bundle entry', async () => {
                // Requirements: 4.6
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.bundles['my-bundle'].sourceId).toBe('test-source');
            });

            it('should include sourceType in bundle entry', async () => {
                // Requirements: 4.6
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.bundles['my-bundle'].sourceType).toBe('github');
            });

            it('should include installedAt timestamp in bundle entry', async () => {
                // Requirements: 4.6
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.bundles['my-bundle'].installedAt).toBeTruthy();
            });

            it('should NOT include commitMode in bundle entry (implicit based on file)', async () => {
                // Requirements: 1.4, 1.5 - commitMode is implicit based on which lockfile contains the entry
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle'));
                const lockfile = readLockfileFromDisk();
                // commitMode should NOT be present in the bundle entry
                expect(lockfile!.bundles['my-bundle'].commitMode).toBe(undefined);
            });

            it('should include files array with checksums', async () => {
                // Requirements: 15.1-15.2
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(Array.isArray(lockfile!.bundles['my-bundle'].files)).toBeTruthy();
                expect(lockfile!.bundles['my-bundle'].files[0].path).toBeTruthy();
                expect(lockfile!.bundles['my-bundle'].files[0].checksum).toBeTruthy();
            });

            it('should update existing bundle entry', async () => {
                // Requirements: 4.1
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('my-bundle', '1.0.0'));
                await manager.createOrUpdate(createTestOptions('my-bundle', '2.0.0'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.bundles['my-bundle'].version).toBe('2.0.0');
            });

            it('should preserve other bundles when updating one', async () => {
                // Requirements: 11.5
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('bundle-1', '1.0.0'));
                await manager.createOrUpdate(createTestOptions('bundle-2', '2.0.0'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.bundles['bundle-1']).toBeTruthy();
                expect(lockfile!.bundles['bundle-2']).toBeTruthy();
            });
        });

        describe('Source Recording', () => {
            it('should record source configuration in sources section', async () => {
                // Requirements: 4.7, 12.1
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.sources['test-source']).toBeTruthy();
            });

            it('should include source type', async () => {
                // Requirements: 12.3
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.sources['test-source'].type).toBe('github');
            });

            it('should include source URL', async () => {
                // Requirements: 12.3
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.sources['test-source'].url).toBe('https://github.com/owner/repo');
            });

            it('should include optional branch for git sources', async () => {
                // Requirements: 12.3
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('test-bundle');
                options.source = createMockSourceEntry('github', 'https://github.com/owner/repo', 'main');
                await manager.createOrUpdate(options);
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.sources['test-source'].branch).toBe('main');
            });
        });

        describe('Hub Recording', () => {
            it('should record hub configuration when bundle comes from hub', async () => {
                // Requirements: 12.2
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('test-bundle');
                options.hub = {
                    id: 'hub-1',
                    entry: createMockHubEntry('My Hub', 'https://hub.example.com/config.yml')
                };
                await manager.createOrUpdate(options);
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.hubs).toBeTruthy();
                expect(lockfile!.hubs!['hub-1']).toBeTruthy();
            });

            it('should include hub name', async () => {
                // Requirements: 12.2
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('test-bundle');
                options.hub = {
                    id: 'hub-1',
                    entry: createMockHubEntry('My Hub', 'https://hub.example.com/config.yml')
                };
                await manager.createOrUpdate(options);
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.hubs!['hub-1'].name).toBe('My Hub');
            });

            it('should include hub URL', async () => {
                // Requirements: 12.2
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('test-bundle');
                options.hub = {
                    id: 'hub-1',
                    entry: createMockHubEntry('My Hub', 'https://hub.example.com/config.yml')
                };
                await manager.createOrUpdate(options);
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.hubs!['hub-1'].url).toBe('https://hub.example.com/config.yml');
            });

            it('should not include hubs section when no hub provided', async () => {
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.hubs).toBe(undefined);
            });
        });

        describe('Profile Recording', () => {
            it('should record profile when bundle installed as part of profile', async () => {
                // Requirements: 12.6, 15.3
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('bundle-1');
                options.profile = {
                    id: 'profile-1',
                    entry: createMockProfileEntry('My Profile', ['bundle-1', 'bundle-2'])
                };
                await manager.createOrUpdate(options);
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.profiles).toBeTruthy();
            });

            it('should include profile name', async () => {
                // Requirements: 15.4
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('bundle-1');
                options.profile = {
                    id: 'profile-1',
                    entry: createMockProfileEntry('My Profile', ['bundle-1', 'bundle-2'])
                };
                await manager.createOrUpdate(options);
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.profiles!['profile-1'].name).toBe('My Profile');
            });

            it('should include profile bundleIds', async () => {
                // Requirements: 15.4
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('bundle-1');
                options.profile = {
                    id: 'profile-1',
                    entry: createMockProfileEntry('My Profile', ['bundle-1', 'bundle-2'])
                };
                await manager.createOrUpdate(options);
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.profiles!['profile-1'].bundleIds).toEqual(['bundle-1', 'bundle-2']);
            });

            it('should not include profiles section when no profile provided', async () => {
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                const lockfile = readLockfileFromDisk();
                expect(lockfile!.profiles).toBe(undefined);
            });
        });

        describe('Atomic Write', () => {
            it('should write atomically using temp file and rename', async () => {
                // Requirements: 15.6
                const manager = LockfileManager.getInstance(tempDir);
                await manager.createOrUpdate(createTestOptions('test-bundle'));
                
                // Verify lockfile exists and temp file doesn't
                expect(fs.existsSync(lockfilePath)).toBeTruthy();
                expect(!fs.existsSync(lockfilePath + '.tmp')).toBeTruthy();
            });

            it('should not corrupt lockfile on concurrent writes', async () => {
                // Requirements: 15.6
                const manager = LockfileManager.getInstance(tempDir);
                
                // Perform multiple concurrent writes
                await Promise.all([
                    manager.createOrUpdate(createTestOptions('bundle-1', '1.0.0')),
                    manager.createOrUpdate(createTestOptions('bundle-2', '2.0.0')),
                    manager.createOrUpdate(createTestOptions('bundle-3', '3.0.0'))
                ]);
                
                // Verify lockfile is valid JSON
                const lockfile = readLockfileFromDisk();
                expect(lockfile).toBeTruthy();
                expect(lockfile!.bundles).toBeTruthy();
            });
        });

        describe('Dual-Lockfile Write Operations', () => {
            const localLockfilePath = () => path.join(tempDir, 'prompt-registry.local.lock.json');
            
            const readLocalLockfileFromDisk = (): Lockfile | null => {
                const localPath = localLockfilePath();
                if (!fs.existsSync(localPath)) {
                    return null;
                }
                return JSON.parse(fs.readFileSync(localPath, 'utf8'));
            };

            it('should write commit mode bundles to main lockfile', async () => {
                // Requirements: 1.2 - Write commit bundles to prompt-registry.lock.json
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('commit-bundle');
                options.commitMode = 'commit';
                
                await manager.createOrUpdate(options);
                
                // Verify bundle is in main lockfile
                const mainLockfile = readLockfileFromDisk();
                expect(mainLockfile, 'Main lockfile should exist').toBeTruthy();
                expect(mainLockfile!.bundles['commit-bundle'], 'Bundle should be in main lockfile').toBeTruthy();
                
                // Verify bundle is NOT in local lockfile
                const localLockfile = readLocalLockfileFromDisk();
                expect(localLockfile, 'Local lockfile should not exist').toBe(null);
            });

            it('should write local-only mode bundles to local lockfile', async () => {
                // Requirements: 1.1 - Write local-only bundles to prompt-registry.local.lock.json
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('local-bundle');
                options.commitMode = 'local-only';
                
                await manager.createOrUpdate(options);
                
                // Verify bundle is in local lockfile
                const localLockfile = readLocalLockfileFromDisk();
                expect(localLockfile, 'Local lockfile should exist').toBeTruthy();
                expect(localLockfile!.bundles['local-bundle'], 'Bundle should be in local lockfile').toBeTruthy();
                
                // Verify bundle is NOT in main lockfile
                const mainLockfile = readLockfileFromDisk();
                expect(mainLockfile, 'Main lockfile should not exist').toBe(null);
            });

            it('should NOT include commitMode field in bundle entries for commit mode', async () => {
                // Requirements: 1.5 - commitMode field should not be included in main lockfile entries
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('commit-bundle');
                options.commitMode = 'commit';
                
                await manager.createOrUpdate(options);
                
                const mainLockfile = readLockfileFromDisk();
                expect(mainLockfile, 'Main lockfile should exist').toBeTruthy();
                expect(mainLockfile!.bundles['commit-bundle'].commitMode, 'commitMode should NOT be in bundle entry').toBe(undefined);
            });

            it('should NOT include commitMode field in bundle entries for local-only mode', async () => {
                // Requirements: 1.4 - commitMode field should not be included in local lockfile entries
                const manager = LockfileManager.getInstance(tempDir);
                const options = createTestOptions('local-bundle');
                options.commitMode = 'local-only';
                
                await manager.createOrUpdate(options);
                
                const localLockfile = readLocalLockfileFromDisk();
                expect(localLockfile, 'Local lockfile should exist').toBeTruthy();
                expect(localLockfile!.bundles['local-bundle'].commitMode, 'commitMode should NOT be in bundle entry').toBe(undefined);
            });

            it('should keep commit and local-only bundles in separate lockfiles', async () => {
                // Requirements: 1.1, 1.2 - Bundles should be in correct lockfiles based on commitMode
                const manager = LockfileManager.getInstance(tempDir);
                
                // Create commit mode bundle
                const commitOptions = createTestOptions('commit-bundle');
                commitOptions.commitMode = 'commit';
                await manager.createOrUpdate(commitOptions);
                
                // Create local-only mode bundle
                const localOptions = createTestOptions('local-bundle');
                localOptions.commitMode = 'local-only';
                localOptions.sourceId = 'local-source';
                await manager.createOrUpdate(localOptions);
                
                // Verify commit bundle is only in main lockfile
                const mainLockfile = readLockfileFromDisk();
                expect(mainLockfile!.bundles['commit-bundle'], 'Commit bundle should be in main lockfile').toBeTruthy();
                expect(mainLockfile!.bundles['local-bundle'], 'Local bundle should NOT be in main lockfile').toBe(undefined);
                
                // Verify local-only bundle is only in local lockfile
                const localLockfile = readLocalLockfileFromDisk();
                expect(localLockfile!.bundles['local-bundle'], 'Local bundle should be in local lockfile').toBeTruthy();
                expect(localLockfile!.bundles['commit-bundle'], 'Commit bundle should NOT be in local lockfile').toBe(undefined);
            });

            it('should add local lockfile to git exclude on first local-only bundle creation', async () => {
                // Requirements: 2.1 - Add prompt-registry.local.lock.json to .git/info/exclude
                const manager = LockfileManager.getInstance(tempDir);
                
                // Create .git/info directory
                const gitInfoDir = path.join(tempDir, '.git', 'info');
                fs.mkdirSync(gitInfoDir, { recursive: true });
                
                // Create local-only bundle
                const options = createTestOptions('local-bundle');
                options.commitMode = 'local-only';
                await manager.createOrUpdate(options);
                
                // Verify .git/info/exclude has the local lockfile entry
                const excludePath = path.join(gitInfoDir, 'exclude');
                expect(fs.existsSync(excludePath), '.git/info/exclude should exist').toBeTruthy();
                
                const excludeContent = fs.readFileSync(excludePath, 'utf-8');
                expect(excludeContent.includes('prompt-registry.local.lock.json'), 'Local lockfile should be in git exclude').toBeTruthy();
                expect(excludeContent.includes('# Prompt Registry (local)'), 'Git exclude should have Prompt Registry section header').toBeTruthy();
            });

            it('should not add to git exclude when .git directory does not exist', async () => {
                // Requirements: 2.3 - Skip git exclude operations if .git directory does not exist
                const manager = LockfileManager.getInstance(tempDir);
                
                // Ensure .git directory does NOT exist
                const gitDir = path.join(tempDir, '.git');
                if (fs.existsSync(gitDir)) {
                    fs.rmSync(gitDir, { recursive: true });
                }
                
                // Create local-only bundle - should not throw
                const options = createTestOptions('local-bundle');
                options.commitMode = 'local-only';
                await manager.createOrUpdate(options);
                
                // Verify local lockfile was created
                const localLockfile = readLocalLockfileFromDisk();
                expect(localLockfile, 'Local lockfile should exist').toBeTruthy();
                
                // Verify .git/info/exclude was NOT created
                const excludePath = path.join(tempDir, '.git', 'info', 'exclude');
                expect(!fs.existsSync(excludePath), '.git/info/exclude should NOT exist').toBeTruthy();
            });

            it('should not duplicate git exclude entry on subsequent local-only bundle creations', async () => {
                // Requirements: 2.5 - Prevent duplicate entries in git exclude
                const manager = LockfileManager.getInstance(tempDir);
                
                // Create .git/info directory
                const gitInfoDir = path.join(tempDir, '.git', 'info');
                fs.mkdirSync(gitInfoDir, { recursive: true });
                
                // Create first local-only bundle
                const options1 = createTestOptions('local-bundle-1');
                options1.commitMode = 'local-only';
                await manager.createOrUpdate(options1);
                
                // Create second local-only bundle
                const options2 = createTestOptions('local-bundle-2');
                options2.commitMode = 'local-only';
                options2.sourceId = 'source-2';
                await manager.createOrUpdate(options2);
                
                // Verify .git/info/exclude has only one entry for local lockfile
                const excludePath = path.join(gitInfoDir, 'exclude');
                const excludeContent = fs.readFileSync(excludePath, 'utf-8');
                
                const matches = excludeContent.match(/prompt-registry\.local\.lock\.json/g);
                expect(matches?.length, 'Local lockfile should appear only once in git exclude').toBe(1);
            });
        });
    });

    describe('remove()', () => {
        it('should remove bundle entry from lockfile', async () => {
            // Requirements: 4.8
            const lockfile = createMockLockfile(2);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            await manager.remove('bundle-0');
            const updated = readLockfileFromDisk();
            expect(!updated!.bundles['bundle-0']).toBeTruthy();
            expect(updated!.bundles['bundle-1']).toBeTruthy();
        });

        it('should delete lockfile when last bundle is removed', async () => {
            // Requirements: 4.9
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            await manager.remove('bundle-0');
            expect(fs.existsSync(lockfilePath)).toBe(false);
        });

        it('should preserve other bundles when removing one', async () => {
            const lockfile = createMockLockfile(3);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            await manager.remove('bundle-1');
            const updated = readLockfileFromDisk();
            expect(updated!.bundles['bundle-0']).toBeTruthy();
            expect(!updated!.bundles['bundle-1']).toBeTruthy();
            expect(updated!.bundles['bundle-2']).toBeTruthy();
        });

        it('should handle removing non-existent bundle gracefully', async () => {
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            await manager.remove('non-existent');
            const updated = readLockfileFromDisk();
            expect(updated!.bundles['bundle-0']).toBeTruthy();
        });

        it('should clean up orphaned sources when bundle removed', async () => {
            // If a source is only referenced by the removed bundle, it should be cleaned up
            const manager = LockfileManager.getInstance(tempDir);
            
            // Create two bundles with different sources
            const options1 = createTestOptions('bundle-1');
            options1.sourceId = 'source-1';
            await manager.createOrUpdate(options1);
            
            const options2 = createTestOptions('bundle-2');
            options2.sourceId = 'source-2';
            options2.source = createMockSourceEntry('gitlab', 'https://gitlab.com/owner/repo');
            await manager.createOrUpdate(options2);
            
            // Remove bundle-1
            await manager.remove('bundle-1');
            
            const updated = readLockfileFromDisk();
            expect(!updated!.sources['source-1'], 'Orphaned source should be removed').toBeTruthy();
            expect(updated!.sources['source-2'], 'Referenced source should remain').toBeTruthy();
        });

        describe('Dual-Lockfile Remove Operations', () => {
            // Requirements: 5.1, 5.2, 5.3, 5.4 - Remove from correct lockfile
            
            const localLockfilePath = () => path.join(tempDir, 'prompt-registry.local.lock.json');
            
            const readLocalLockfileFromDisk = (): Lockfile | null => {
                const localPath = localLockfilePath();
                if (!fs.existsSync(localPath)) {
                    return null;
                }
                return JSON.parse(fs.readFileSync(localPath, 'utf8'));
            };

            const writeLocalLockfile = (lockfile: Lockfile): void => {
                fs.writeFileSync(localLockfilePath(), JSON.stringify(lockfile, null, 2));
            };

            it('should remove local-only bundle from local lockfile', async () => {
                // Requirements: 5.1 - Remove local-only bundle from Local_Lockfile
                const localLockfile = createMockLockfile(2);
                writeLocalLockfile(localLockfile);
                
                const manager = LockfileManager.getInstance(tempDir);
                await manager.remove('bundle-0');
                
                // Bundle should be removed from local lockfile
                const updatedLocal = readLocalLockfileFromDisk();
                expect(updatedLocal, 'Local lockfile should still exist').toBeTruthy();
                expect(!updatedLocal!.bundles['bundle-0'], 'bundle-0 should be removed').toBeTruthy();
                expect(updatedLocal!.bundles['bundle-1'], 'bundle-1 should remain').toBeTruthy();
                
                // Main lockfile should not exist
                const mainLockfile = readLockfileFromDisk();
                expect(mainLockfile, 'Main lockfile should not exist').toBe(null);
            });

            it('should remove committed bundle from main lockfile', async () => {
                // Requirements: 5.2 - Remove committed bundle from Main_Lockfile
                const mainLockfile = createMockLockfile(2);
                writeLockfile(mainLockfile);
                
                const manager = LockfileManager.getInstance(tempDir);
                await manager.remove('bundle-0');
                
                // Bundle should be removed from main lockfile
                const updatedMain = readLockfileFromDisk();
                expect(updatedMain, 'Main lockfile should still exist').toBeTruthy();
                expect(!updatedMain!.bundles['bundle-0'], 'bundle-0 should be removed').toBeTruthy();
                expect(updatedMain!.bundles['bundle-1'], 'bundle-1 should remain').toBeTruthy();
                
                // Local lockfile should not exist
                const localLockfile = readLocalLockfileFromDisk();
                expect(localLockfile, 'Local lockfile should not exist').toBe(null);
            });

            it('should delete local lockfile when last local-only bundle is removed', async () => {
                // Requirements: 5.3 - Delete Local_Lockfile when last bundle removed
                const localLockfile = createMockLockfile(1);
                writeLocalLockfile(localLockfile);
                
                const manager = LockfileManager.getInstance(tempDir);
                await manager.remove('bundle-0');
                
                // Local lockfile should be deleted
                expect(fs.existsSync(localLockfilePath()), 'Local lockfile should be deleted').toBe(false);
            });

            it('should delete main lockfile when last committed bundle is removed', async () => {
                // Requirements: 5.5 - Delete Main_Lockfile when last bundle removed
                const mainLockfile = createMockLockfile(1);
                writeLockfile(mainLockfile);
                
                const manager = LockfileManager.getInstance(tempDir);
                await manager.remove('bundle-0');
                
                // Main lockfile should be deleted
                expect(fs.existsSync(lockfilePath), 'Main lockfile should be deleted').toBe(false);
            });

            it('should remove local lockfile from git exclude when local lockfile is deleted', async () => {
                // Requirements: 5.4 - Remove local lockfile from git exclude when deleted
                const localLockfile = createMockLockfile(1);
                writeLocalLockfile(localLockfile);
                
                // Create .git/info directory with local lockfile entry
                const gitInfoDir = path.join(tempDir, '.git', 'info');
                fs.mkdirSync(gitInfoDir, { recursive: true });
                const excludePath = path.join(gitInfoDir, 'exclude');
                fs.writeFileSync(excludePath, '# Prompt Registry (local)\nprompt-registry.local.lock.json\n');
                
                const manager = LockfileManager.getInstance(tempDir);
                await manager.remove('bundle-0');
                
                // Local lockfile should be deleted
                expect(fs.existsSync(localLockfilePath()), 'Local lockfile should be deleted').toBe(false);
                
                // Git exclude should no longer have the local lockfile entry
                const excludeContent = fs.readFileSync(excludePath, 'utf-8');
                expect(!excludeContent.includes('prompt-registry.local.lock.json'), 'Local lockfile should be removed from git exclude').toBeTruthy();
            });

            it('should remove from correct lockfile when both exist', async () => {
                // Test that remove finds the bundle in the correct lockfile
                const mainLockfile = LockfileBuilder.create()
                    .withSource('main-source', 'github', 'https://github.com/main/repo')
                    .withBundle('main-bundle', '1.0.0', 'main-source')
                    .build();
                writeLockfile(mainLockfile);
                
                const localLockfile = LockfileBuilder.create()
                    .withSource('local-source', 'github', 'https://github.com/local/repo')
                    .withBundle('local-bundle', '1.0.0', 'local-source')
                    .build();
                writeLocalLockfile(localLockfile);
                
                const manager = LockfileManager.getInstance(tempDir);
                
                // Remove from local lockfile
                await manager.remove('local-bundle');
                
                // Local lockfile should be deleted (was the only bundle)
                expect(fs.existsSync(localLockfilePath()), 'Local lockfile should be deleted').toBe(false);
                
                // Main lockfile should still have its bundle
                const updatedMain = readLockfileFromDisk();
                expect(updatedMain, 'Main lockfile should still exist').toBeTruthy();
                expect(updatedMain!.bundles['main-bundle'], 'main-bundle should remain').toBeTruthy();
            });

            it('should handle removing non-existent bundle from both lockfiles gracefully', async () => {
                // Test that remove handles non-existent bundle when both lockfiles exist
                const mainLockfile = createMockLockfile(1);
                writeLockfile(mainLockfile);
                
                const localLockfile = createMockLockfile(1);
                writeLocalLockfile(localLockfile);
                
                const manager = LockfileManager.getInstance(tempDir);
                
                // Remove non-existent bundle - should not throw
                await manager.remove('non-existent');
                
                // Both lockfiles should remain unchanged
                const updatedMain = readLockfileFromDisk();
                const updatedLocal = readLocalLockfileFromDisk();
                expect(updatedMain!.bundles['bundle-0'], 'Main lockfile bundle should remain').toBeTruthy();
                expect(updatedLocal!.bundles['bundle-0'], 'Local lockfile bundle should remain').toBeTruthy();
            });
        });
    });

    describe('updateCommitMode()', () => {
        const localLockfilePath = () => path.join(tempDir, 'prompt-registry.local.lock.json');
        
        const readLocalLockfileFromDisk = (): Lockfile | null => {
            const localPath = localLockfilePath();
            if (!fs.existsSync(localPath)) {
                return null;
            }
            return JSON.parse(fs.readFileSync(localPath, 'utf8'));
        };

        const writeLocalLockfile = (lockfile: Lockfile): void => {
            fs.writeFileSync(localLockfilePath(), JSON.stringify(lockfile, null, 2));
        };

        it('should move bundle from main lockfile to local lockfile when switching to local-only', async () => {
            // Requirements: 4.1 - Move bundle from Main_Lockfile to Local_Lockfile
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'local-only');
            
            // Bundle should be in local lockfile
            const localLockfile = readLocalLockfileFromDisk();
            expect(localLockfile, 'Local lockfile should exist').toBeTruthy();
            expect(localLockfile!.bundles['bundle-0'], 'Bundle should be in local lockfile').toBeTruthy();
            
            // Bundle should NOT be in main lockfile (main lockfile should be deleted since it was the only bundle)
            const mainLockfile = readLockfileFromDisk();
            expect(mainLockfile, 'Main lockfile should be deleted when empty').toBe(null);
        });

        it('should move bundle from local lockfile to main lockfile when switching to commit', async () => {
            // Requirements: 4.2 - Move bundle from Local_Lockfile to Main_Lockfile
            const lockfile = createMockLockfile(1);
            writeLocalLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'commit');
            
            // Bundle should be in main lockfile
            const mainLockfile = readLockfileFromDisk();
            expect(mainLockfile, 'Main lockfile should exist').toBeTruthy();
            expect(mainLockfile!.bundles['bundle-0'], 'Bundle should be in main lockfile').toBeTruthy();
            
            // Bundle should NOT be in local lockfile (local lockfile should be deleted since it was the only bundle)
            const localLockfile = readLocalLockfileFromDisk();
            expect(localLockfile, 'Local lockfile should be deleted when empty').toBe(null);
        });

        it('should update generatedAt timestamp in target lockfile', async () => {
            const lockfile = createMockLockfile(1);
            const originalTimestamp = lockfile.generatedAt;
            writeLockfile(lockfile);
            
            // Wait a bit to ensure timestamp changes
            await new Promise(resolve => setTimeout(resolve, 10));
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'local-only');
            
            const localLockfile = readLocalLockfileFromDisk();
            expect(localLockfile, 'Local lockfile should exist').toBeTruthy();
            expect(localLockfile!.generatedAt).not.toBe(originalTimestamp);
        });

        it('should throw error if bundle not found in source lockfile', async () => {
            // Requirements: 4.6 - Return error if bundle not found in source lockfile
            const manager = LockfileManager.getInstance(tempDir);
            
            await expect(async () => manager.updateCommitMode('bundle-0', 'local-only')).rejects.toThrow(/Bundle bundle-0 not found in commit lockfile/);
        });

        it('should throw error if bundle not found when switching to commit', async () => {
            // Requirements: 4.6 - Return error if bundle not found in source lockfile
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            
            // Bundle is in main lockfile, but we're trying to switch to commit (which looks in local lockfile)
            await expect(async () => manager.updateCommitMode('non-existent', 'local-only')).rejects.toThrow(/Bundle non-existent not found in commit lockfile/);
        });

        it('should emit onLockfileUpdated event with target lockfile', async () => {
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            let eventFired = false;
            let eventLockfile: Lockfile | null = null;
            
            manager.onLockfileUpdated((lf) => {
                eventFired = true;
                eventLockfile = lf;
            });
            
            await manager.updateCommitMode('bundle-0', 'local-only');
            
            expect(eventFired, 'Event should be fired').toBeTruthy();
            // The event should contain the target lockfile (local lockfile) with the bundle
            expect(eventLockfile!.bundles['bundle-0'], 'Event lockfile should contain the moved bundle').toBeTruthy();
        });

        it('should preserve all bundle metadata during move', async () => {
            // Requirements: 4.3 - Preserve all bundle metadata during move
            const lockfile = createMockLockfile(1);
            const originalVersion = lockfile.bundles['bundle-0'].version;
            const originalSourceId = lockfile.bundles['bundle-0'].sourceId;
            const originalSourceType = lockfile.bundles['bundle-0'].sourceType;
            const originalInstalledAt = lockfile.bundles['bundle-0'].installedAt;
            const originalFiles = lockfile.bundles['bundle-0'].files;
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'local-only');
            
            const localLockfile = readLocalLockfileFromDisk();
            expect(localLockfile, 'Local lockfile should exist').toBeTruthy();
            expect(localLockfile!.bundles['bundle-0'].version, 'Version should be preserved').toBe(originalVersion);
            expect(localLockfile!.bundles['bundle-0'].sourceId, 'SourceId should be preserved').toBe(originalSourceId);
            expect(localLockfile!.bundles['bundle-0'].sourceType, 'SourceType should be preserved').toBe(originalSourceType);
            expect(localLockfile!.bundles['bundle-0'].installedAt, 'InstalledAt should be preserved').toBe(originalInstalledAt);
            expect(localLockfile!.bundles['bundle-0'].files, 'Files should be preserved').toEqual(originalFiles);
        });

        it('should copy source entry to target lockfile', async () => {
            // Requirements: 4.3 - Source entry should be migrated
            const lockfile = createMockLockfile(1);
            const sourceId = lockfile.bundles['bundle-0'].sourceId;
            const originalSource = lockfile.sources[sourceId];
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'local-only');
            
            const localLockfile = readLocalLockfileFromDisk();
            expect(localLockfile, 'Local lockfile should exist').toBeTruthy();
            expect(localLockfile!.sources[sourceId], 'Source should be copied to local lockfile').toBeTruthy();
            expect(localLockfile!.sources[sourceId].type, 'Source type should be preserved').toBe(originalSource.type);
            expect(localLockfile!.sources[sourceId].url, 'Source URL should be preserved').toBe(originalSource.url);
        });

        it('should add local lockfile to git exclude when moving to local-only', async () => {
            // Requirements: 4.4 - Add local lockfile to git exclude when moving to local-only
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            
            // Create .git/info directory
            const gitInfoDir = path.join(tempDir, '.git', 'info');
            fs.mkdirSync(gitInfoDir, { recursive: true });
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'local-only');
            
            // Verify .git/info/exclude has the local lockfile entry
            const excludePath = path.join(gitInfoDir, 'exclude');
            expect(fs.existsSync(excludePath), '.git/info/exclude should exist').toBeTruthy();
            
            const excludeContent = fs.readFileSync(excludePath, 'utf-8');
            expect(excludeContent.includes('prompt-registry.local.lock.json'), 'Local lockfile should be in git exclude').toBeTruthy();
        });

        it('should remove local lockfile from git exclude when local lockfile becomes empty', async () => {
            // Requirements: 4.5 - Remove local lockfile from git exclude when empty
            const lockfile = createMockLockfile(1);
            writeLocalLockfile(lockfile);
            
            // Create .git/info directory with local lockfile entry
            const gitInfoDir = path.join(tempDir, '.git', 'info');
            fs.mkdirSync(gitInfoDir, { recursive: true });
            const excludePath = path.join(gitInfoDir, 'exclude');
            fs.writeFileSync(excludePath, '# Prompt Registry (local)\nprompt-registry.local.lock.json\n');
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'commit');
            
            // Local lockfile should be deleted (was the only bundle)
            expect(fs.existsSync(localLockfilePath()), 'Local lockfile should be deleted').toBe(false);
            
            // Git exclude should no longer have the local lockfile entry
            const excludeContent = fs.readFileSync(excludePath, 'utf-8');
            expect(!excludeContent.includes('prompt-registry.local.lock.json'), 'Local lockfile should be removed from git exclude').toBeTruthy();
        });

        it('should preserve other bundles in source lockfile when moving one', async () => {
            const lockfile = createMockLockfile(2);
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.updateCommitMode('bundle-0', 'local-only');
            
            // bundle-0 should be in local lockfile
            const localLockfile = readLocalLockfileFromDisk();
            expect(localLockfile!.bundles['bundle-0'], 'bundle-0 should be in local lockfile').toBeTruthy();
            
            // bundle-1 should still be in main lockfile
            const mainLockfile = readLockfileFromDisk();
            expect(mainLockfile, 'Main lockfile should still exist').toBeTruthy();
            expect(mainLockfile!.bundles['bundle-1'], 'bundle-1 should still be in main lockfile').toBeTruthy();
            expect(!mainLockfile!.bundles['bundle-0'], 'bundle-0 should NOT be in main lockfile').toBeTruthy();
        });
    });

    describe('read()', () => {
        it('should return lockfile when it exists', async () => {
            // Requirements: 5.2
            const lockfile = createMockLockfile(2);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.read();
            expect(result).toBeTruthy();
            expect(Object.keys(result!.bundles).length).toBe(2);
        });

        it('should return null when lockfile does not exist', async () => {
            // Requirements: 5.1
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.read();
            expect(result).toBe(null);
        });

        it('should parse and return valid lockfile structure', async () => {
            // Requirements: 5.2
            const lockfile = createMockLockfile(1, { includeHubs: true, includeProfiles: true });
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.read();
            expect(result!.bundles).toBeTruthy();
            expect(result!.sources).toBeTruthy();
            expect(result!.hubs).toBeTruthy();
            expect(result!.profiles).toBeTruthy();
        });

        it('should handle corrupted lockfile gracefully', async () => {
            fs.writeFileSync(lockfilePath, 'not valid json');
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.read();
            // Should return null for corrupted file
            expect(result).toBe(null);
        });
    });

    describe('validate()', () => {
        it('should return valid result for valid lockfile', async () => {
            // Requirements: 5.2
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.validate();
            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it('should detect missing required fields', async () => {
            const invalidLockfile = { bundles: {} };
            fs.writeFileSync(lockfilePath, JSON.stringify(invalidLockfile));
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.validate();
            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
        });

        it('should return schema version in result', async () => {
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.validate();
            expect(result.schemaVersion).toBeTruthy();
        });

        it('should return valid=false when lockfile does not exist', async () => {
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.validate();
            expect(result.valid).toBe(false);
        });

        it('should use fallback schema path when extension not available', async () => {
            // Requirements: 11.4 - Schema path resolution with fallback
            // In test environment, extension is not available, so it should fall back to process.cwd()
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            
            // Validation should still work using fallback path (process.cwd()/schemas/)
            const result = await manager.validate();
            // If schema is found via fallback, validation should succeed for valid lockfile
            expect(result.valid).toBe(true);
        });

        it('should load schema from extension path when available', async () => {
            // Requirements: 11.4 - Schema path resolution from extension
            // This test verifies the schema loading works regardless of source
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            
            // Store original getExtension if it exists
            const originalGetExtension = vscode.extensions?.getExtension;
            
            // Mock vscode.extensions.getExtension to return a mock extension
            const mockExtension = {
                extensionPath: process.cwd(), // Use cwd as mock extension path
                packageJSON: { version: '1.0.0' }
            };
            
            // Ensure vscode.extensions exists
            if (!vscode.extensions) {
                (vscode as any).extensions = {};
            }
            (vscode.extensions as any).getExtension = (id: string) => {
                if (id === 'AmadeusITGroup.prompt-registry') {
                    return mockExtension;
                }
                return originalGetExtension?.(id);
            };
            
            try {
                const result = await manager.validate();
                // Schema should be found and validation should work
                expect(result.valid).toBe(true);
            } finally {
                // Restore original
                if (originalGetExtension) {
                    (vscode.extensions as any).getExtension = originalGetExtension;
                }
            }
        });
    });

    describe('detectModifiedFiles()', () => {
        it('should return empty array when no files modified', async () => {
            // Requirements: 14.1-14.2
            const manager = LockfileManager.getInstance(tempDir);
            
            // Create a test file
            const testFilePath = path.join(tempDir, '.github', 'prompts', 'test.prompt.md');
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
            fs.writeFileSync(testFilePath, 'test content');
            
            // Calculate checksum and create lockfile
            const checksum = await calculateFileChecksum(testFilePath);
            const options = createTestOptions('test-bundle');
            options.files = [{ path: '.github/prompts/test.prompt.md', checksum }];
            await manager.createOrUpdate(options);
            
            const result = await manager.detectModifiedFiles('test-bundle');
            expect(result.length).toBe(0);
        });

        it('should detect modified files by checksum comparison', async () => {
            // Requirements: 14.2
            const manager = LockfileManager.getInstance(tempDir);
            
            // Create a test file
            const testFilePath = path.join(tempDir, '.github', 'prompts', 'test.prompt.md');
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
            fs.writeFileSync(testFilePath, 'original content');
            
            // Calculate checksum and create lockfile
            const checksum = await calculateFileChecksum(testFilePath);
            const options = createTestOptions('test-bundle');
            options.files = [{ path: '.github/prompts/test.prompt.md', checksum }];
            await manager.createOrUpdate(options);
            
            // Modify the file
            fs.writeFileSync(testFilePath, 'modified content');
            
            const result = await manager.detectModifiedFiles('test-bundle');
            expect(result.length).toBe(1);
            expect(result[0].modificationType).toBe('modified');
        });

        it('should detect missing files', async () => {
            // Requirements: 14.3
            const manager = LockfileManager.getInstance(tempDir);
            
            // Create lockfile with file entry but don't create the file
            const options = createTestOptions('test-bundle');
            options.files = [{ path: '.github/prompts/missing.prompt.md', checksum: 'abc123' }];
            await manager.createOrUpdate(options);
            
            const result = await manager.detectModifiedFiles('test-bundle');
            expect(result[0].modificationType).toBe('missing');
        });

        it('should include original and current checksums in result', async () => {
            // Requirements: 14.2
            const manager = LockfileManager.getInstance(tempDir);
            
            // Create a test file
            const testFilePath = path.join(tempDir, '.github', 'prompts', 'test.prompt.md');
            fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
            fs.writeFileSync(testFilePath, 'original content');
            
            const originalChecksum = await calculateFileChecksum(testFilePath);
            const options = createTestOptions('test-bundle');
            options.files = [{ path: '.github/prompts/test.prompt.md', checksum: originalChecksum }];
            await manager.createOrUpdate(options);
            
            // Modify the file
            fs.writeFileSync(testFilePath, 'modified content');
            
            const result = await manager.detectModifiedFiles('test-bundle');
            expect(result[0].originalChecksum).toBeTruthy();
            expect(result[0].currentChecksum).toBeTruthy();
            expect(result[0].originalChecksum).not.toBe(result[0].currentChecksum);
        });

        it('should return empty array for non-existent bundle', async () => {
            const manager = LockfileManager.getInstance(tempDir);
            const result = await manager.detectModifiedFiles('non-existent');
            expect(result.length).toBe(0);
        });
    });

    describe('Events', () => {
        it('should emit onLockfileUpdated event when lockfile created', async () => {
            const manager = LockfileManager.getInstance(tempDir);
            let eventFired = false;
            manager.onLockfileUpdated(() => { eventFired = true; });
            await manager.createOrUpdate(createTestOptions('test-bundle'));
            expect(eventFired).toBe(true);
        });

        it('should emit onLockfileUpdated event when lockfile updated', async () => {
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            let eventFired = false;
            manager.onLockfileUpdated(() => { eventFired = true; });
            await manager.createOrUpdate(createTestOptions('new-bundle'));
            expect(eventFired).toBe(true);
        });

        it('should emit onLockfileUpdated event when bundle removed', async () => {
            const lockfile = createMockLockfile(2);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            let eventFired = false;
            manager.onLockfileUpdated(() => { eventFired = true; });
            await manager.remove('bundle-0');
            expect(eventFired).toBe(true);
        });

        it('should emit onLockfileUpdated event when lockfile deleted', async () => {
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            const manager = LockfileManager.getInstance(tempDir);
            let eventFired = false;
            let receivedNull = false;
            manager.onLockfileUpdated((lf) => { 
                eventFired = true; 
                receivedNull = lf === null;
            });
            await manager.remove('bundle-0');
            expect(eventFired).toBe(true);
            expect(receivedNull).toBe(true);
        });
    });

    describe('getLockfilePath()', () => {
        it('should return correct lockfile path', () => {
            const manager = LockfileManager.getInstance(tempDir);
            const lockfilePath = manager.getLockfilePath();
            expect(lockfilePath.endsWith('prompt-registry.lock.json')).toBeTruthy();
        });
    });

    describe('getLocalLockfilePath()', () => {
        it('should return correct local lockfile path', () => {
            const manager = LockfileManager.getInstance(tempDir);
            const localLockfilePath = manager.getLocalLockfilePath();
            expect(localLockfilePath.endsWith('prompt-registry.local.lock.json')).toBeTruthy();
        });

        it('should return path in repository root', () => {
            const manager = LockfileManager.getInstance(tempDir);
            const localLockfilePath = manager.getLocalLockfilePath();
            expect(localLockfilePath.startsWith(tempDir)).toBeTruthy();
        });

        it('should return different path than main lockfile', () => {
            const manager = LockfileManager.getInstance(tempDir);
            const mainPath = manager.getLockfilePath();
            const localPath = manager.getLocalLockfilePath();
            expect(mainPath).not.toBe(localPath);
        });
    });

    describe('Lockfile Deletion Error Handling', () => {
        // Requirements: 3.5 - If lockfile deletion fails, log error and continue without throwing
        
        it('should log error and not throw when lockfile deletion fails', async () => {
            // Requirements: 3.5 - Error is logged, no exception thrown
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            
            // Stub fs.promises.unlink to simulate deletion failure
            const unlinkStub = sandbox.stub(fs.promises, 'unlink').rejects(new Error('Permission denied'));
            
            // Track if error was logged
            const logger = Logger.getInstance();
            const logErrorStub = sandbox.stub(logger, 'error');
            
            // Remove the last bundle - this should trigger lockfile deletion
            // which will fail, but should NOT throw
            await expect(manager.remove('bundle-0')).resolves.not.toThrow();
            
            // Verify error was logged
            expect(logErrorStub.called, 'Error should be logged').toBeTruthy();
            expect(logErrorStub.firstCall.args[0].includes('Failed to delete lockfile'), 'Error message should mention lockfile deletion failure').toBeTruthy();
            
            // Verify unlink was attempted
            expect(unlinkStub.called, 'unlink should have been called').toBeTruthy();
        });

        it('should emit onLockfileUpdated with null even when deletion fails', async () => {
            // Requirements: 3.5 - Continue operation (emit event) even on deletion failure
            const lockfile = createMockLockfile(1);
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            
            // Stub fs.promises.unlink to simulate deletion failure
            sandbox.stub(fs.promises, 'unlink').rejects(new Error('Permission denied'));
            
            // Track events
            let eventFired = false;
            let receivedNull = false;
            manager.onLockfileUpdated((lf) => {
                eventFired = true;
                receivedNull = lf === null;
            });
            
            // Remove the last bundle
            await manager.remove('bundle-0');
            
            // Event should still fire with null even though deletion failed
            expect(eventFired, 'Event should be fired').toBe(true);
            expect(receivedNull, 'Event should receive null').toBe(true);
        });
    });

    describe('File Watcher Initialization and Disposal', () => {
        // Requirements: 2.4, 2.5 - File watcher initialization and disposal
        
        let mockFileWatcher: {
            onDidChange: sinon.SinonStub;
            onDidCreate: sinon.SinonStub;
            onDidDelete: sinon.SinonStub;
            dispose: sinon.SinonStub;
        };
        let createFileSystemWatcherStub: sinon.SinonStub;

        beforeEach(() => {
            // Create mock file watcher with stubbed methods
            mockFileWatcher = {
                onDidChange: sandbox.stub().returns({ dispose: sandbox.stub() }),
                onDidCreate: sandbox.stub().returns({ dispose: sandbox.stub() }),
                onDidDelete: sandbox.stub().returns({ dispose: sandbox.stub() }),
                dispose: sandbox.stub()
            };

            // Stub vscode.workspace.createFileSystemWatcher
            createFileSystemWatcherStub = sandbox.stub(vscode.workspace, 'createFileSystemWatcher')
                .returns(mockFileWatcher as any);
        });

        it('should initialize file watcher on construction', () => {
            // Requirements: 2.4 - File watcher is initialized on construction
            LockfileManager.resetInstance();
            
            // Create a new instance - this should call setupFileWatcher
            const manager = LockfileManager.getInstance(tempDir);
            
            // Verify createFileSystemWatcher was called
            expect(createFileSystemWatcherStub.calledOnce, 'createFileSystemWatcher should be called once').toBeTruthy();
            
            // Verify the pattern includes the lockfile name
            const callArgs = createFileSystemWatcherStub.firstCall.args;
            expect(callArgs[0], 'Pattern should be provided').toBeTruthy();
            
            // Verify event handlers were registered
            expect(mockFileWatcher.onDidChange.calledOnce, 'onDidChange handler should be registered').toBeTruthy();
            expect(mockFileWatcher.onDidCreate.calledOnce, 'onDidCreate handler should be registered').toBeTruthy();
            expect(mockFileWatcher.onDidDelete.calledOnce, 'onDidDelete handler should be registered').toBeTruthy();
            
            // Clean up
            manager.dispose();
        });

        it('should dispose file watcher on dispose() call', () => {
            // Requirements: 2.5 - File watcher is disposed on dispose() call
            LockfileManager.resetInstance();
            
            const manager = LockfileManager.getInstance(tempDir);
            
            // Verify watcher was created
            expect(createFileSystemWatcherStub.calledOnce).toBeTruthy();
            
            // Dispose the manager
            manager.dispose();
            
            // Verify file watcher dispose was called
            expect(mockFileWatcher.dispose.calledOnce, 'File watcher dispose should be called').toBeTruthy();
        });

        it('should not fire events after disposal', async () => {
            // Requirements: 2.5 - No events fire after disposal
            LockfileManager.resetInstance();
            
            const manager = LockfileManager.getInstance(tempDir);
            
            // Track events
            let eventCount = 0;
            const disposable = manager.onLockfileUpdated(() => {
                eventCount++;
            });
            
            // Capture the handlers that were registered with the file watcher
            const changeHandler = mockFileWatcher.onDidChange.firstCall?.args[0];
            const createHandler = mockFileWatcher.onDidCreate.firstCall?.args[0];
            const deleteHandler = mockFileWatcher.onDidDelete.firstCall?.args[0];
            
            // Dispose the manager - this should dispose the event emitter
            manager.dispose();
            
            // After dispose, calling the file watcher handlers should not propagate
            // events to listeners because the EventEmitter is disposed
            // Simulate external file changes by invoking the captured handlers
            if (changeHandler) {
                try { changeHandler(); } catch { /* handler may fail after dispose */ }
            }
            if (createHandler) {
                try { createHandler(); } catch { /* handler may fail after dispose */ }
            }
            if (deleteHandler) {
                try { deleteHandler(); } catch { /* handler may fail after dispose */ }
            }
            
            // Allow any async operations to complete
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Verify no events were fired to listeners after disposal
            expect(eventCount, 'No events should fire after disposal').toBe(0);
            
            disposable.dispose();
        });

        it('should handle file watcher initialization failure gracefully', () => {
            // Test that the manager handles errors during file watcher setup
            LockfileManager.resetInstance();
            
            // Make createFileSystemWatcher throw an error
            createFileSystemWatcherStub.throws(new Error('Mock watcher creation failed'));
            
            // Creating the manager should not throw
            let manager: LockfileManager | undefined;
            expect(() => {
                manager = LockfileManager.getInstance(tempDir);
            }).not.toThrow();
            
            // Manager should still be functional for basic operations
            expect(manager, 'Manager should be created').toBeTruthy();
            
            // Clean up
            manager?.dispose();
        });
    });

    describe('getInstalledBundles() - Dual Lockfile Support', () => {
        // Requirements: 3.1, 3.2, 3.3, 3.4 - Unified bundle listing with conflict detection
        
        const localLockfilePath = () => path.join(tempDir, 'prompt-registry.local.lock.json');
        
        const writeLocalLockfile = (lockfile: Lockfile): void => {
            fs.writeFileSync(localLockfilePath(), JSON.stringify(lockfile, null, 2));
        };

        it('should return empty array when no lockfiles exist', async () => {
            // Requirements: 3.1 - Read from both lockfiles
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            expect(bundles.length).toBe(0);
        });

        it('should return bundles from main lockfile only when local lockfile does not exist', async () => {
            // Requirements: 3.1, 3.3 - Read from main lockfile, set commitMode: 'commit'
            const mainLockfile = createMockLockfile(2);
            writeLockfile(mainLockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length).toBe(2);
            expect(bundles.every(b => b.commitMode === 'commit'), 'All bundles from main lockfile should have commitMode: commit').toBeTruthy();
        });

        it('should return bundles from local lockfile only when main lockfile does not exist', async () => {
            // Requirements: 3.1, 3.2 - Read from local lockfile, set commitMode: 'local-only'
            const localLockfile = createMockLockfile(2, { commitMode: 'local-only' });
            writeLocalLockfile(localLockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length).toBe(2);
            expect(bundles.every(b => b.commitMode === 'local-only'), 'All bundles from local lockfile should have commitMode: local-only').toBeTruthy();
        });

        it('should merge bundles from both lockfiles', async () => {
            // Requirements: 3.1 - Read from both Main_Lockfile and Local_Lockfile
            const mainLockfile = LockfileBuilder.create()
                .withSource('main-source', 'github', 'https://github.com/main/repo')
                .withBundle('main-bundle-1', '1.0.0', 'main-source', { commitMode: 'commit' })
                .withBundle('main-bundle-2', '2.0.0', 'main-source', { commitMode: 'commit' })
                .build();
            writeLockfile(mainLockfile);
            
            const localLockfile = LockfileBuilder.create()
                .withSource('local-source', 'github', 'https://github.com/local/repo')
                .withBundle('local-bundle-1', '1.0.0', 'local-source', { commitMode: 'local-only' })
                .build();
            writeLocalLockfile(localLockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length, 'Should have 3 bundles total').toBe(3);
            
            const mainBundles = bundles.filter(b => b.commitMode === 'commit');
            const localBundles = bundles.filter(b => b.commitMode === 'local-only');
            
            expect(mainBundles.length, 'Should have 2 bundles from main lockfile').toBe(2);
            expect(localBundles.length, 'Should have 1 bundle from local lockfile').toBe(1);
        });

        it('should annotate bundles from main lockfile with commitMode: commit', async () => {
            // Requirements: 3.3 - Set commitMode: 'commit' on bundles from Main_Lockfile
            const mainLockfile = createMockLockfile(1);
            // Even if the entry has a different commitMode, it should be overridden
            mainLockfile.bundles['bundle-0'].commitMode = 'local-only';
            writeLockfile(mainLockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length).toBe(1);
            expect(bundles[0].commitMode, 'Bundle from main lockfile should have commitMode: commit regardless of entry value').toBe('commit');
        });

        it('should annotate bundles from local lockfile with commitMode: local-only', async () => {
            // Requirements: 3.2 - Set commitMode: 'local-only' on bundles from Local_Lockfile
            const localLockfile = createMockLockfile(1);
            // Even if the entry has a different commitMode, it should be overridden
            localLockfile.bundles['bundle-0'].commitMode = 'commit';
            writeLocalLockfile(localLockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length).toBe(1);
            expect(bundles[0].commitMode, 'Bundle from local lockfile should have commitMode: local-only regardless of entry value').toBe('local-only');
        });

        it('should detect conflict when bundle ID exists in both lockfiles', async () => {
            // Requirements: 3.4 - Display error when bundle ID exists in both lockfiles
            const conflictingBundleId = 'conflicting-bundle';
            
            const mainLockfile = LockfileBuilder.create()
                .withSource('main-source', 'github', 'https://github.com/main/repo')
                .withBundle(conflictingBundleId, '1.0.0', 'main-source', { commitMode: 'commit' })
                .build();
            writeLockfile(mainLockfile);
            
            const localLockfile = LockfileBuilder.create()
                .withSource('local-source', 'github', 'https://github.com/local/repo')
                .withBundle(conflictingBundleId, '2.0.0', 'local-source', { commitMode: 'local-only' })
                .build();
            writeLocalLockfile(localLockfile);
            
            // Track error message display
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            // Should only return the bundle from main lockfile (first one wins)
            expect(bundles.length, 'Should only return 1 bundle (conflict skips local)').toBe(1);
            expect(bundles[0].bundleId).toBe(conflictingBundleId);
            expect(bundles[0].commitMode, 'Should be from main lockfile').toBe('commit');
            
            // Should display error message
            expect(showErrorMessageStub.calledOnce, 'Should display error message for conflict').toBeTruthy();
            expect(showErrorMessageStub.firstCall.args[0].includes(conflictingBundleId), 'Error message should contain the conflicting bundle ID').toBeTruthy();
            expect(showErrorMessageStub.firstCall.args[0].includes('both lockfiles'), 'Error message should mention both lockfiles').toBeTruthy();
        });

        it('should log error when conflict is detected', async () => {
            // Requirements: 3.4 - Log error for conflicts
            const conflictingBundleId = 'conflicting-bundle';
            
            const mainLockfile = LockfileBuilder.create()
                .withSource('main-source', 'github', 'https://github.com/main/repo')
                .withBundle(conflictingBundleId, '1.0.0', 'main-source')
                .build();
            writeLockfile(mainLockfile);
            
            const localLockfile = LockfileBuilder.create()
                .withSource('local-source', 'github', 'https://github.com/local/repo')
                .withBundle(conflictingBundleId, '2.0.0', 'local-source')
                .build();
            writeLocalLockfile(localLockfile);
            
            // Track logger error calls
            const logger = Logger.getInstance();
            const logErrorStub = sandbox.stub(logger, 'error');
            sandbox.stub(vscode.window, 'showErrorMessage');
            
            const manager = LockfileManager.getInstance(tempDir);
            await manager.getInstalledBundles();
            
            // Should log error
            expect(logErrorStub.called, 'Should log error for conflict').toBeTruthy();
            expect(logErrorStub.firstCall.args[0].includes(conflictingBundleId), 'Log message should contain the conflicting bundle ID').toBeTruthy();
        });

        it('should handle multiple conflicts correctly', async () => {
            // Requirements: 3.4 - Handle multiple conflicts
            const mainLockfile = LockfileBuilder.create()
                .withSource('main-source', 'github', 'https://github.com/main/repo')
                .withBundle('conflict-1', '1.0.0', 'main-source')
                .withBundle('conflict-2', '1.0.0', 'main-source')
                .withBundle('main-only', '1.0.0', 'main-source')
                .build();
            writeLockfile(mainLockfile);
            
            const localLockfile = LockfileBuilder.create()
                .withSource('local-source', 'github', 'https://github.com/local/repo')
                .withBundle('conflict-1', '2.0.0', 'local-source')
                .withBundle('conflict-2', '2.0.0', 'local-source')
                .withBundle('local-only', '1.0.0', 'local-source')
                .build();
            writeLocalLockfile(localLockfile);
            
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            // Should return 4 bundles: 3 from main + 1 unique from local
            expect(bundles.length, 'Should return 4 bundles (3 main + 1 unique local)').toBe(4);
            
            // Should display error for each conflict
            expect(showErrorMessageStub.callCount, 'Should display 2 error messages for 2 conflicts').toBe(2);
        });

        it('should preserve bundle metadata when merging', async () => {
            // Verify that all bundle properties are correctly preserved
            const mainLockfile = LockfileBuilder.create()
                .withSource('main-source', 'github', 'https://github.com/main/repo')
                .withBundle('main-bundle', '1.2.3', 'main-source', {
                    sourceType: 'github',
                    files: [createMockFileEntry('.github/prompts/test.prompt.md')]
                })
                .build();
            writeLockfile(mainLockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length).toBe(1);
            expect(bundles[0].bundleId).toBe('main-bundle');
            expect(bundles[0].version).toBe('1.2.3');
            expect(bundles[0].sourceId).toBe('main-source');
            expect(bundles[0].sourceType).toBe('github');
            expect(bundles[0].scope).toBe('repository');
        });
    });

    describe('Backward Compatibility - Legacy SourceId Format', () => {
        /**
         * Tests for backward compatibility with legacy hub-prefixed sourceId format.
         * 
         * Legacy format: `hub-{hubId}-{sourceId}` (e.g., "hub-my-hub-github-source")
         * New format: `{sourceType}-{12-char-hash}` (e.g., "github-a1b2c3d4e5f6")
         * 
         * Requirements covered:
         * - Requirement 3.1: Legacy sourceIds should resolve correctly
         * - Requirement 3.2: Bundle updates should write new sourceId format
         */

        it('should read lockfile with legacy hub-prefixed sourceId correctly', async () => {
            // Requirements: 3.1 - Legacy sourceIds should resolve correctly
            // Legacy format: hub-{hubId}-{sourceId}
            const legacySourceId = 'hub-my-hub-github-source';
            
            const lockfile = LockfileBuilder.create()
                .withSource(legacySourceId, 'github', 'https://github.com/owner/repo')
                .withBundle('test-bundle', '1.0.0', legacySourceId, {
                    sourceType: 'github',
                    files: [createMockFileEntry('.github/prompts/test.prompt.md')]
                })
                .build();
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            // Bundle should be read correctly with legacy sourceId
            expect(bundles.length, 'Should read 1 bundle').toBe(1);
            expect(bundles[0].bundleId).toBe('test-bundle');
            expect(bundles[0].version).toBe('1.0.0');
            expect(bundles[0].sourceId, 'Legacy sourceId should be preserved').toBe(legacySourceId);
            expect(bundles[0].sourceType).toBe('github');
        });

        it('should read lockfile with multiple legacy sourceIds correctly', async () => {
            // Requirements: 3.1 - Multiple legacy sourceIds should all resolve
            const legacySourceId1 = 'hub-test-hub-source1';
            const legacySourceId2 = 'hub-another-hub-gitlab-source';
            
            const lockfile = LockfileBuilder.create()
                .withSource(legacySourceId1, 'github', 'https://github.com/owner/repo1')
                .withSource(legacySourceId2, 'gitlab', 'https://gitlab.com/group/project')
                .withBundle('bundle-1', '1.0.0', legacySourceId1, { sourceType: 'github' })
                .withBundle('bundle-2', '2.0.0', legacySourceId2, { sourceType: 'gitlab' })
                .build();
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length, 'Should read 2 bundles').toBe(2);
            
            const bundle1 = bundles.find(b => b.bundleId === 'bundle-1');
            const bundle2 = bundles.find(b => b.bundleId === 'bundle-2');
            
            expect(bundle1, 'bundle-1 should exist').toBeTruthy();
            expect(bundle1!.sourceId).toBe(legacySourceId1);
            
            expect(bundle2, 'bundle-2 should exist').toBeTruthy();
            expect(bundle2!.sourceId).toBe(legacySourceId2);
        });

        it('should read lockfile with mixed legacy and new sourceId formats', async () => {
            // Requirements: 3.1 - System should handle both formats in same lockfile
            const legacySourceId = 'hub-old-hub-github-source';
            const newSourceId = 'github-a1b2c3d4e5f6'; // New format: {type}-{hash}
            
            const lockfile = LockfileBuilder.create()
                .withSource(legacySourceId, 'github', 'https://github.com/owner/legacy-repo')
                .withSource(newSourceId, 'github', 'https://github.com/owner/new-repo')
                .withBundle('legacy-bundle', '1.0.0', legacySourceId, { sourceType: 'github' })
                .withBundle('new-bundle', '2.0.0', newSourceId, { sourceType: 'github' })
                .build();
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length, 'Should read both bundles').toBe(2);
            
            const legacyBundle = bundles.find(b => b.bundleId === 'legacy-bundle');
            const newBundle = bundles.find(b => b.bundleId === 'new-bundle');
            
            expect(legacyBundle, 'Legacy bundle should exist').toBeTruthy();
            expect(legacyBundle!.sourceId, 'Legacy sourceId preserved').toBe(legacySourceId);
            
            expect(newBundle, 'New bundle should exist').toBeTruthy();
            expect(newBundle!.sourceId, 'New sourceId preserved').toBe(newSourceId);
        });

        it('should write new sourceId format when bundle is updated', async () => {
            // Requirements: 3.2 - Bundle update should write new sourceId format
            // When createOrUpdate is called with a new sourceId, it should be written
            const newSourceId = 'github-b5c6d7e8';
            
            // Start with a lockfile containing a legacy sourceId
            const legacySourceId = 'hub-my-hub-old-source';
            const lockfile = LockfileBuilder.create()
                .withSource(legacySourceId, 'github', 'https://github.com/owner/repo')
                .withBundle('test-bundle', '1.0.0', legacySourceId, { sourceType: 'github' })
                .build();
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            
            // Update the bundle with new sourceId format
            const updateOptions: CreateOrUpdateOptions = {
                bundleId: 'test-bundle',
                version: '2.0.0',
                sourceId: newSourceId,
                sourceType: 'github',
                commitMode: 'commit',
                files: [createMockFileEntry('.github/prompts/test.prompt.md')],
                source: createMockSourceEntry('github', 'https://github.com/owner/repo')
            };
            
            await manager.createOrUpdate(updateOptions);
            
            // Read the lockfile from disk to verify the new format was written
            const updatedLockfile = readLockfileFromDisk();
            expect(updatedLockfile, 'Lockfile should exist').toBeTruthy();
            
            // Bundle should have new sourceId
            expect(updatedLockfile!.bundles['test-bundle'].sourceId, 'Bundle should have new sourceId format').toBe(newSourceId);
            
            // New source entry should exist
            expect(updatedLockfile!.sources[newSourceId], 'New source entry should exist').toBeTruthy();
            
            // Note: Legacy source is NOT automatically cleaned up on update.
            // Source cleanup only happens when bundles are removed (orphan cleanup).
            // This is expected behavior - the legacy source remains until no bundles reference it.
            // The important thing is that the bundle now uses the new sourceId format.
        });

        it('should preserve legacy sourceId when bundle is not updated', async () => {
            // Requirements: 3.1 - Legacy sourceIds should continue to work without migration
            const legacySourceId = 'hub-preserved-hub-source';
            
            const lockfile = LockfileBuilder.create()
                .withSource(legacySourceId, 'github', 'https://github.com/owner/repo')
                .withBundle('preserved-bundle', '1.0.0', legacySourceId, { sourceType: 'github' })
                .build();
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            
            // Add a different bundle (not updating the existing one)
            const newSourceId = 'github-newbundle';
            const addOptions: CreateOrUpdateOptions = {
                bundleId: 'new-bundle',
                version: '1.0.0',
                sourceId: newSourceId,
                sourceType: 'github',
                commitMode: 'commit',
                files: [createMockFileEntry('.github/prompts/new.prompt.md')],
                source: createMockSourceEntry('github', 'https://github.com/owner/new-repo')
            };
            
            await manager.createOrUpdate(addOptions);
            
            // Read the lockfile from disk
            const updatedLockfile = readLockfileFromDisk();
            expect(updatedLockfile, 'Lockfile should exist').toBeTruthy();
            
            // Original bundle should still have legacy sourceId
            expect(updatedLockfile!.bundles['preserved-bundle'].sourceId, 'Legacy sourceId should be preserved for unchanged bundle').toBe(legacySourceId);
            
            // Legacy source should still exist
            expect(updatedLockfile!.sources[legacySourceId], 'Legacy source should still exist').toBeTruthy();
            
            // New bundle should have new sourceId
            expect(updatedLockfile!.bundles['new-bundle'].sourceId, 'New bundle should have new sourceId').toBe(newSourceId);
        });

        it('should handle legacy sourceId with many segments correctly', async () => {
            // Requirements: 3.1 - Legacy format can have 3+ segments
            // Example: hub-my-hub-github-enterprise-source (5 segments)
            const legacySourceId = 'hub-my-hub-github-enterprise-source';
            
            const lockfile = LockfileBuilder.create()
                .withSource(legacySourceId, 'github', 'https://github.enterprise.com/owner/repo')
                .withBundle('enterprise-bundle', '1.0.0', legacySourceId, { sourceType: 'github' })
                .build();
            writeLockfile(lockfile);
            
            const manager = LockfileManager.getInstance(tempDir);
            const bundles = await manager.getInstalledBundles();
            
            expect(bundles.length, 'Should read 1 bundle').toBe(1);
            expect(bundles[0].sourceId, 'Multi-segment legacy sourceId preserved').toBe(legacySourceId);
        });
    });
});
