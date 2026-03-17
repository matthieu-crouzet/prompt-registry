/**
 * Tests for lockfileTestHelpers
 * 
 * Verifies that the LockfileBuilder, factory functions, and generators
 * work correctly for creating test lockfile data.
 */
import * as fc from 'fast-check';
import {
    LockfileBuilder,
    createMockLockfile,
    createMockBundleEntry,
    createMockFileEntry,
    createMockSourceEntry,
    createMockHubEntry,
    createMockProfileEntry,
    generateMockChecksum,
    LockfileGenerators,
    LOCKFILE_DEFAULTS
} from './lockfileTestHelpers';

describe('lockfileTestHelpers', () => {
    describe('LockfileBuilder', () => {
        it('should create empty lockfile with defaults', () => {
            const lockfile = LockfileBuilder.create().build();

            expect(lockfile.$schema).toBe(LOCKFILE_DEFAULTS.SCHEMA_URL);
            expect(lockfile.version).toBe(LOCKFILE_DEFAULTS.VERSION);
            expect(lockfile.generatedBy).toBe(LOCKFILE_DEFAULTS.GENERATED_BY);
            expect(lockfile.bundles).toEqual({});
            expect(lockfile.sources).toEqual({});
            expect(lockfile.generatedAt).toBeTruthy();
        });

        it('should add bundle with default values', () => {
            const lockfile = LockfileBuilder.create()
                .withBundle('test-bundle', '1.0.0', 'test-source')
                .build();

            expect(lockfile.bundles['test-bundle']).toBeTruthy();
            expect(lockfile.bundles['test-bundle'].version).toBe('1.0.0');
            expect(lockfile.bundles['test-bundle'].sourceId).toBe('test-source');
            expect(lockfile.bundles['test-bundle'].sourceType).toBe('github');
            expect(lockfile.bundles['test-bundle'].commitMode).toBe('commit');
            expect(lockfile.bundles['test-bundle'].files).toEqual([]);
        });

        it('should add bundle with custom options', () => {
            const lockfile = LockfileBuilder.create()
                .withBundle('test-bundle', '2.0.0', 'gitlab-source', {
                    sourceType: 'gitlab',
                    commitMode: 'local-only',
                    checksum: 'abc123'
                })
                .build();

            const bundle = lockfile.bundles['test-bundle'];
            expect(bundle.sourceType).toBe('gitlab');
            expect(bundle.commitMode).toBe('local-only');
            expect(bundle.checksum).toBe('abc123');
        });

        it('should add bundle with files', () => {
            const files = [
                { path: '.github/prompts/test.prompt.md', checksum: 'abc123' }
            ];
            const lockfile = LockfileBuilder.create()
                .withBundleAndFiles('test-bundle', '1.0.0', 'test-source', files)
                .build();

            expect(lockfile.bundles['test-bundle'].files).toEqual(files);
        });

        it('should add source entry', () => {
            const lockfile = LockfileBuilder.create()
                .withSource('github-source', 'github', 'https://github.com/owner/repo', 'main')
                .build();

            expect(lockfile.sources['github-source']).toBeTruthy();
            expect(lockfile.sources['github-source'].type).toBe('github');
            expect(lockfile.sources['github-source'].url).toBe('https://github.com/owner/repo');
            expect(lockfile.sources['github-source'].branch).toBe('main');
        });

        it('should add source entry without branch', () => {
            const lockfile = LockfileBuilder.create()
                .withSource('http-source', 'http', 'https://example.com/bundles')
                .build();

            expect(lockfile.sources['http-source']).toBeTruthy();
            expect(lockfile.sources['http-source'].branch).toBe(undefined);
        });

        it('should add hub entry', () => {
            const lockfile = LockfileBuilder.create()
                .withHub('my-hub', 'My Hub', 'https://hub.example.com')
                .build();

            expect(lockfile.hubs).toBeTruthy();
            expect(lockfile.hubs!['my-hub']).toBeTruthy();
            expect(lockfile.hubs!['my-hub'].name).toBe('My Hub');
            expect(lockfile.hubs!['my-hub'].url).toBe('https://hub.example.com');
        });

        it('should add profile entry', () => {
            const lockfile = LockfileBuilder.create()
                .withProfile('my-profile', 'My Profile', ['bundle-1', 'bundle-2'])
                .build();

            expect(lockfile.profiles).toBeTruthy();
            expect(lockfile.profiles!['my-profile']).toBeTruthy();
            expect(lockfile.profiles!['my-profile'].name).toBe('My Profile');
            expect(lockfile.profiles!['my-profile'].bundleIds).toEqual(['bundle-1', 'bundle-2']);
        });

        it('should support fluent chaining', () => {
            const lockfile = LockfileBuilder.create()
                .withVersion('2.0.0')
                .withGeneratedBy('test-extension@1.0.0')
                .withSource('src-1', 'github', 'https://github.com/test/repo')
                .withBundle('bundle-1', '1.0.0', 'src-1')
                .withBundle('bundle-2', '2.0.0', 'src-1')
                .withHub('hub-1', 'Test Hub', 'https://hub.test.com')
                .withProfile('profile-1', 'Test Profile', ['bundle-1', 'bundle-2'])
                .build();

            expect(lockfile.version).toBe('2.0.0');
            expect(lockfile.generatedBy).toBe('test-extension@1.0.0');
            expect(Object.keys(lockfile.bundles).length).toBe(2);
            expect(Object.keys(lockfile.sources).length).toBe(1);
            expect(lockfile.hubs).toBeTruthy();
            expect(lockfile.profiles).toBeTruthy();
        });
    });

    describe('createMockLockfile', () => {
        it('should create lockfile with specified bundle count', () => {
            const lockfile = createMockLockfile(3);

            expect(Object.keys(lockfile.bundles).length).toBe(3);
            expect(lockfile.bundles['bundle-0']).toBeTruthy();
            expect(lockfile.bundles['bundle-1']).toBeTruthy();
            expect(lockfile.bundles['bundle-2']).toBeTruthy();
        });

        it('should create empty lockfile with zero bundles', () => {
            const lockfile = createMockLockfile(0);

            expect(Object.keys(lockfile.bundles).length).toBe(0);
            expect(Object.keys(lockfile.sources).length).toBe(1); // Source still exists
        });

        it('should include files when requested', () => {
            const lockfile = createMockLockfile(1, { includeFiles: true });

            expect(lockfile.bundles['bundle-0'].files.length > 0).toBeTruthy();
            expect(lockfile.bundles['bundle-0'].files[0].path).toBeTruthy();
            expect(lockfile.bundles['bundle-0'].files[0].checksum).toBeTruthy();
            expect(lockfile.bundles['bundle-0'].files[0].checksum.length).toBe(64);
        });

        it('should include hubs when requested', () => {
            const lockfile = createMockLockfile(1, { includeHubs: true });

            expect(lockfile.hubs).toBeTruthy();
            expect(lockfile.hubs!['mock-hub']).toBeTruthy();
            expect(lockfile.hubs!['mock-hub'].name).toBe('Mock Hub');
        });

        it('should include profiles when requested', () => {
            const lockfile = createMockLockfile(2, { includeProfiles: true });

            expect(lockfile.profiles).toBeTruthy();
            expect(lockfile.profiles!['mock-profile']).toBeTruthy();
            expect(lockfile.profiles!['mock-profile'].bundleIds).toEqual(['bundle-0', 'bundle-1']);
        });

        it('should use specified commit mode', () => {
            const lockfile = createMockLockfile(2, { commitMode: 'local-only' });

            expect(lockfile.bundles['bundle-0'].commitMode).toBe('local-only');
            expect(lockfile.bundles['bundle-1'].commitMode).toBe('local-only');
        });

        it('should use specified source type', () => {
            const lockfile = createMockLockfile(1, { sourceType: 'gitlab' });

            expect(lockfile.bundles['bundle-0'].sourceType).toBe('gitlab');
            expect(lockfile.sources['mock-source'].type).toBe('gitlab');
        });
    });

    describe('Factory functions', () => {
        it('createMockBundleEntry should create valid entry', () => {
            const entry = createMockBundleEntry('test-bundle', '1.0.0');

            expect(entry.version).toBe('1.0.0');
            expect(entry.sourceId).toBe('mock-source');
            expect(entry.sourceType).toBe('github');
            expect(entry.commitMode).toBe('commit');
            expect(entry.installedAt).toBeTruthy();
            expect(entry.files).toEqual([]);
        });

        it('createMockBundleEntry should accept overrides', () => {
            const entry = createMockBundleEntry('test-bundle', '2.0.0', {
                sourceId: 'custom-source',
                sourceType: 'local',
                commitMode: 'local-only'
            });

            expect(entry.sourceId).toBe('custom-source');
            expect(entry.sourceType).toBe('local');
            expect(entry.commitMode).toBe('local-only');
        });

        it('createMockFileEntry should create valid entry', () => {
            const entry = createMockFileEntry('.github/prompts/test.prompt.md');

            expect(entry.path).toBe('.github/prompts/test.prompt.md');
            expect(entry.checksum.length).toBe(64);
            expect(/^[0-9a-f]{64}$/.test(entry.checksum)).toBeTruthy();
        });

        it('createMockFileEntry should accept custom checksum', () => {
            const checksum = 'a'.repeat(64);
            const entry = createMockFileEntry('.github/prompts/test.prompt.md', checksum);

            expect(entry.checksum).toBe(checksum);
        });

        it('createMockSourceEntry should create valid entry', () => {
            const entry = createMockSourceEntry('github', 'https://github.com/test/repo', 'main');

            expect(entry.type).toBe('github');
            expect(entry.url).toBe('https://github.com/test/repo');
            expect(entry.branch).toBe('main');
        });

        it('createMockSourceEntry should work without branch', () => {
            const entry = createMockSourceEntry('http', 'https://example.com');

            expect(entry.type).toBe('http');
            expect(entry.url).toBe('https://example.com');
            expect(entry.branch).toBe(undefined);
        });

        it('createMockHubEntry should create valid entry', () => {
            const entry = createMockHubEntry('Test Hub', 'https://hub.test.com');

            expect(entry.name).toBe('Test Hub');
            expect(entry.url).toBe('https://hub.test.com');
        });

        it('createMockProfileEntry should create valid entry', () => {
            const entry = createMockProfileEntry('Test Profile', ['bundle-1', 'bundle-2']);

            expect(entry.name).toBe('Test Profile');
            expect(entry.bundleIds).toEqual(['bundle-1', 'bundle-2']);
        });

        it('generateMockChecksum should create valid SHA256 checksum', () => {
            const checksum = generateMockChecksum();

            expect(checksum.length).toBe(64);
            expect(/^[0-9a-f]{64}$/.test(checksum)).toBeTruthy();
        });
    });

    describe('LockfileGenerators', () => {
        it('checksum generator should produce valid SHA256 checksums', () => {
            fc.assert(
                fc.property(LockfileGenerators.checksum(), (checksum) => {
                    return checksum.length === 64 && /^[0-9a-f]{64}$/.test(checksum);
                }),
                { numRuns: 20 }
            );
        });

        it('version generator should produce valid semver strings', () => {
            fc.assert(
                fc.property(LockfileGenerators.version(), (version) => {
                    return /^\d+\.\d+\.\d+$/.test(version);
                }),
                { numRuns: 20 }
            );
        });

        it('bundleId generator should produce valid IDs', () => {
            fc.assert(
                fc.property(LockfileGenerators.bundleId(), (id) => {
                    return id.length > 0 && /^[a-z0-9-]+$/.test(id);
                }),
                { numRuns: 20 }
            );
        });

        it('sourceType generator should produce valid types', () => {
            const validTypes = [
                'github', 'gitlab', 'http', 'local', 'awesome-copilot',
                'local-awesome-copilot', 'apm', 'local-apm', 'olaf', 'local-olaf'
            ];
            fc.assert(
                fc.property(LockfileGenerators.sourceType(), (type) => {
                    return validTypes.includes(type);
                }),
                { numRuns: 20 }
            );
        });

        it('commitMode generator should produce valid modes', () => {
            fc.assert(
                fc.property(LockfileGenerators.commitMode(), (mode) => {
                    return mode === 'commit' || mode === 'local-only';
                }),
                { numRuns: 20 }
            );
        });

        it('isoTimestamp generator should produce valid ISO timestamps', () => {
            fc.assert(
                fc.property(LockfileGenerators.isoTimestamp(), (timestamp) => {
                    const date = new Date(timestamp);
                    return !isNaN(date.getTime()) && timestamp.includes('T');
                }),
                { numRuns: 20 }
            );
        });

        it('fileEntry generator should produce valid entries', () => {
            fc.assert(
                fc.property(LockfileGenerators.fileEntry(), (entry) => {
                    return (
                        entry.path.length > 0 &&
                        entry.checksum.length === 64 &&
                        /^[0-9a-f]{64}$/.test(entry.checksum)
                    );
                }),
                { numRuns: 20 }
            );
        });

        it('sourceEntry generator should produce valid entries', () => {
            fc.assert(
                fc.property(LockfileGenerators.sourceEntry(), (entry) => {
                    return (
                        entry.type.length > 0 &&
                        entry.url.length > 0
                    );
                }),
                { numRuns: 20 }
            );
        });

        it('bundleEntry generator should produce valid entries', () => {
            fc.assert(
                fc.property(LockfileGenerators.bundleEntry(), (entry) => {
                    return (
                        /^\d+\.\d+\.\d+$/.test(entry.version) &&
                        entry.sourceId.length > 0 &&
                        entry.sourceType.length > 0 &&
                        (entry.commitMode === 'commit' || entry.commitMode === 'local-only') &&
                        Array.isArray(entry.files)
                    );
                }),
                { numRuns: 20 }
            );
        });

        it('consistentLockfile generator should produce lockfiles with matching source references', () => {
            fc.assert(
                fc.property(LockfileGenerators.consistentLockfile(), (lockfile) => {
                    // All bundles should reference sources that exist
                    for (const bundleId of Object.keys(lockfile.bundles)) {
                        const bundle = lockfile.bundles[bundleId];
                        if (!lockfile.sources[bundle.sourceId]) {
                            return false;
                        }
                    }
                    return true;
                }),
                { numRuns: 20 }
            );
        });

        it('lockfile generator should produce valid lockfiles', () => {
            fc.assert(
                fc.property(LockfileGenerators.lockfile({ minBundles: 1, maxBundles: 3 }), (lockfile) => {
                    return (
                        lockfile.$schema === LOCKFILE_DEFAULTS.SCHEMA_URL &&
                        /^\d+\.\d+\.\d+$/.test(lockfile.version) &&
                        lockfile.generatedAt.length > 0 &&
                        lockfile.generatedBy === LOCKFILE_DEFAULTS.GENERATED_BY &&
                        typeof lockfile.bundles === 'object' &&
                        typeof lockfile.sources === 'object'
                    );
                }),
                { numRuns: 20 }
            );
        });
    });
});
