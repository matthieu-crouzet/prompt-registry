/**
 * Tests for Repository Fixture Helpers
 * 
 * Validates that the repository fixture helpers properly:
 * - Create valid deployment manifests
 * - Create valid bundle ZIP files
 * - Configure nock mocks for GitHub releases API
 * 
 * Requirements covered:
 * - 1.1: setupReleaseMocks() for GitHub releases API
 * - 1.2: createBundleZip() for valid bundle ZIP files
 * - 1.3: createDeploymentManifest() for deployment manifests
 * - 1.5: createBundleZip() returns valid ZIP with manifest and prompts
 * - 1.6: RepositoryTestConfig interface for test configuration
 */

import nock from 'nock';
import AdmZip from 'adm-zip';
import {
    RepositoryTestConfig,
    ReleaseConfig,
    createDeploymentManifest,
    createBundleZip,
    setupReleaseMocks,
    createMockGitHubSource,
    cleanupReleaseMocks,
    computeBundleId,
    createTestConfig,
    setupSourceWithCustomConfig,
    SourceSetupDependencies,
    MochaTestContext
} from './repositoryFixtureHelpers';

describe('Repository Fixture Helpers', () => {
    afterEach(() => {
        cleanupReleaseMocks();
    });

    describe('createDeploymentManifest', () => {
        it('should create manifest with all required fields (Requirement 1.3)', () => {
            const config: RepositoryTestConfig = {
                owner: 'test-owner',
                repo: 'test-repo',
                manifestId: 'test-bundle'
            };
            
            const manifest = createDeploymentManifest(config, '1.0.0', 'initial');
            
            // Verify all required fields are present and non-empty
            expect(manifest.id).toBe('test-bundle');
            expect(manifest.name.length > 0, 'name should be non-empty').toBeTruthy();
            expect(manifest.version).toBe('1.0.0');
            expect(manifest.description.length > 0, 'description should be non-empty').toBeTruthy();
            expect(manifest.author).toBe('test-owner');
            expect(Array.isArray(manifest.tags) && manifest.tags.length > 0, 'tags should be non-empty array').toBeTruthy();
            expect(Array.isArray(manifest.environments) && manifest.environments.length > 0, 'environments should be non-empty array').toBeTruthy();
            expect(Array.isArray(manifest.dependencies), 'dependencies should be array').toBeTruthy();
            expect(manifest.license.length > 0, 'license should be non-empty').toBeTruthy();
        });

        it('should include content identifier in name and description', () => {
            const config = createTestConfig();
            const manifest = createDeploymentManifest(config, '2.0.0', 'custom-content');
            
            expect(manifest.name.includes('custom-content'), 'name should include content identifier').toBeTruthy();
            expect(manifest.description.includes('custom-content'), 'description should include content identifier').toBeTruthy();
        });

        it('should use default content when not specified', () => {
            const config = createTestConfig();
            const manifest = createDeploymentManifest(config, '1.0.0');
            
            expect(manifest.name.includes('initial'), 'name should include default content').toBeTruthy();
        });
    });

    describe('createBundleZip', () => {
        it('should create valid ZIP buffer (Requirement 1.2)', () => {
            const config = createTestConfig();
            const zipBuffer = createBundleZip(config, '1.0.0', 'test');
            
            expect(Buffer.isBuffer(zipBuffer), 'should return a Buffer').toBeTruthy();
            expect(zipBuffer.length > 0, 'buffer should not be empty').toBeTruthy();
        });

        it('should contain deployment-manifest.yml (Requirement 1.5)', () => {
            const config = createTestConfig();
            const zipBuffer = createBundleZip(config, '1.0.0', 'test');
            
            const zip = new AdmZip(zipBuffer);
            const entries = zip.getEntries();
            const manifestEntry = entries.find(e => e.entryName === 'deployment-manifest.yml');
            
            expect(manifestEntry, 'ZIP should contain deployment-manifest.yml').toBeTruthy();
            
            const manifestContent = manifestEntry!.getData().toString('utf-8');
            expect(manifestContent.includes('id: test-bundle'), 'manifest should contain id').toBeTruthy();
            expect(manifestContent.includes('version: 1.0.0'), 'manifest should contain version').toBeTruthy();
        });

        it('should contain prompts/test.prompt.md (Requirement 1.5)', () => {
            const config = createTestConfig();
            const zipBuffer = createBundleZip(config, '1.0.0', 'test');
            
            const zip = new AdmZip(zipBuffer);
            const entries = zip.getEntries();
            const promptEntry = entries.find(e => e.entryName === 'prompts/test.prompt.md');
            
            expect(promptEntry, 'ZIP should contain prompts/test.prompt.md').toBeTruthy();
            
            const promptContent = promptEntry!.getData().toString('utf-8');
            expect(promptContent.includes('# Test Prompt'), 'prompt should have header').toBeTruthy();
            expect(promptContent.includes('Content: test'), 'prompt should include content identifier').toBeTruthy();
        });

        it('should create ZIP that can be extracted and re-read (round-trip)', () => {
            const config: RepositoryTestConfig = {
                owner: 'round-trip-owner',
                repo: 'round-trip-repo',
                manifestId: 'round-trip-bundle'
            };
            const version = '2.5.0';
            const content = 'round-trip-test';
            
            // Create ZIP
            const zipBuffer = createBundleZip(config, version, content);
            
            // Extract and verify
            const zip = new AdmZip(zipBuffer);
            const manifestEntry = zip.getEntry('deployment-manifest.yml');
            expect(manifestEntry, 'should find manifest').toBeTruthy();
            
            const manifestContent = manifestEntry!.getData().toString('utf-8');
            expect(manifestContent.includes(`id: ${config.manifestId}`), 'manifest id should match').toBeTruthy();
            expect(manifestContent.includes(`version: ${version}`), 'manifest version should match').toBeTruthy();
            expect(manifestContent.includes(`author: ${config.owner}`), 'manifest author should match').toBeTruthy();
        });
    });

    describe('setupReleaseMocks', () => {
        it('should configure releases endpoint (Requirement 1.1)', async () => {
            const config = createTestConfig();
            const releases: ReleaseConfig[] = [
                { tag: 'v1.0.0', version: '1.0.0', content: 'initial' }
            ];
            
            setupReleaseMocks(config, releases);
            
            // Verify releases endpoint is mocked
            const axios = require('axios');
            const response = await axios.get(
                `https://api.github.com/repos/${config.owner}/${config.repo}/releases`
            );
            
            expect(response.status).toBe(200);
            expect(Array.isArray(response.data)).toBeTruthy();
            expect(response.data.length).toBe(1);
            expect(response.data[0].tag_name).toBe('v1.0.0');
        });

        it('should configure repository metadata endpoint (Requirement 1.4)', async () => {
            const config = createTestConfig();
            setupReleaseMocks(config, [{ tag: 'v1.0.0', version: '1.0.0', content: 'test' }]);
            
            const axios = require('axios');
            const response = await axios.get(
                `https://api.github.com/repos/${config.owner}/${config.repo}`
            );
            
            expect(response.status).toBe(200);
            expect(response.data.name).toBe(config.repo);
        });

        it('should configure manifest asset endpoint (Requirement 1.4)', async () => {
            const config = createTestConfig();
            setupReleaseMocks(config, [{ tag: 'v1.0.0', version: '1.0.0', content: 'test' }]);
            
            const axios = require('axios');
            const response = await axios.get(
                `https://api.github.com/repos/${config.owner}/${config.repo}/releases/assets/1000`
            );
            
            expect(response.status).toBe(200);
            // axios auto-parses JSON, so response.data is already an object
            const manifest = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            expect(manifest.id).toBe(config.manifestId);
            expect(manifest.version).toBe('1.0.0');
        });

        it('should configure bundle download with redirect (Requirement 1.4)', async () => {
            const config = createTestConfig();
            setupReleaseMocks(config, [{ tag: 'v1.0.0', version: '1.0.0', content: 'test' }]);
            
            const axios = require('axios');
            
            // First request gets redirect
            const redirectResponse = await axios.get(
                `https://api.github.com/repos/${config.owner}/${config.repo}/releases/assets/2000`,
                { maxRedirects: 0, validateStatus: (status: number) => status === 302 }
            );
            
            expect(redirectResponse.status).toBe(302);
            expect(redirectResponse.headers.location.includes('objects.githubusercontent.com')).toBeTruthy();
            
            // Follow redirect to get actual bundle
            const bundleResponse = await axios.get(redirectResponse.headers.location, {
                responseType: 'arraybuffer'
            });
            
            expect(bundleResponse.status).toBe(200);
            expect(bundleResponse.data.length > 0, 'bundle should have content').toBeTruthy();
        });

        it('should support multiple releases', async () => {
            const config = createTestConfig();
            const releases: ReleaseConfig[] = [
                { tag: 'v2.0.0', version: '2.0.0', content: 'latest' },
                { tag: 'v1.0.0', version: '1.0.0', content: 'initial' }
            ];
            
            setupReleaseMocks(config, releases);
            
            const axios = require('axios');
            const response = await axios.get(
                `https://api.github.com/repos/${config.owner}/${config.repo}/releases`
            );
            
            expect(response.data.length).toBe(2);
            expect(response.data[0].tag_name).toBe('v2.0.0');
            expect(response.data[1].tag_name).toBe('v1.0.0');
        });
    });

    describe('createMockGitHubSource', () => {
        it('should create valid RegistrySource (Requirement 1.6)', () => {
            const config = createTestConfig();
            const source = createMockGitHubSource('test-source', config);
            
            expect(source.id).toBe('test-source');
            expect(source.type).toBe('github');
            expect(source.url).toBe(`https://github.com/${config.owner}/${config.repo}`);
            expect(source.enabled).toBe(true);
            expect(source.priority >= 0).toBeTruthy();
        });
    });

    describe('cleanupReleaseMocks', () => {
        it('should clear all nock mocks', () => {
            const config = createTestConfig();
            setupReleaseMocks(config, [{ tag: 'v1.0.0', version: '1.0.0', content: 'test' }]);
            
            // Verify mocks are active
            expect(nock.pendingMocks().length > 0, 'should have pending mocks').toBeTruthy();
            
            cleanupReleaseMocks();
            
            // Verify mocks are cleared
            expect(nock.pendingMocks().length, 'should have no pending mocks').toBe(0);
        });
    });

    describe('computeBundleId', () => {
        it('should compute correct bundle ID format', () => {
            const config: RepositoryTestConfig = {
                owner: 'my-owner',
                repo: 'my-repo',
                manifestId: 'my-bundle'
            };
            
            const bundleId = computeBundleId(config, '1.2.3');
            
            expect(bundleId).toBe('my-owner-my-repo-my-bundle-1.2.3');
        });
    });

    describe('createTestConfig', () => {
        it('should create config with defaults', () => {
            const config = createTestConfig();
            
            expect(config.owner).toBe('test-owner');
            expect(config.repo).toBe('test-repo');
            expect(config.manifestId).toBe('test-bundle');
            expect(config.baseVersion).toBe('1.0.0');
        });

        it('should allow overrides', () => {
            const config = createTestConfig({
                owner: 'custom-owner',
                manifestId: 'custom-bundle'
            });
            
            expect(config.owner).toBe('custom-owner');
            expect(config.repo).toBe('test-repo'); // default
            expect(config.manifestId).toBe('custom-bundle');
        });
    });

    describe('MochaTestContext', () => {
        // This test requires Mocha's `this` context binding which is not available in vitest.
        // MochaTestContext type is only used by integration tests running under Mocha.
        it.skip('should be compatible with Mocha test context (mocha-only)', () => {
            // Skipped: requires Mocha test runner for `this` context
        });
    });

    describe('setupSourceWithCustomConfig', () => {
        it('should set up mocks and return bundle when found', async () => {
            const config = createTestConfig({ manifestId: 'custom-bundle' });
            const expectedBundleId = computeBundleId(config, '1.0.0');
            
            // Create mock dependencies
            let addedSource: any = null;
            let syncedSourceId: string | null = null;
            
            const mockDeps: SourceSetupDependencies = {
                registryManager: {
                    addSource: async (source) => { addedSource = source; },
                    syncSource: async (sourceId) => { syncedSourceId = sourceId; }
                },
                storage: {
                    getCachedSourceBundles: async (sourceId) => [
                        { id: expectedBundleId, name: 'Test Bundle' }
                    ]
                }
            };
            
            const result = await setupSourceWithCustomConfig(
                mockDeps,
                'test-id',
                'suffix',
                config,
                'test-content'
            );
            
            // Verify source was added
            expect(addedSource, 'Source should be added').toBeTruthy();
            expect(addedSource.id).toBe('test-id-suffix');
            expect(addedSource.type).toBe('github');
            
            // Verify source was synced
            expect(syncedSourceId).toBe('test-id-suffix');
            
            // Verify result
            expect(result.sourceId).toBe('test-id-suffix');
            expect(result.bundle.id).toBe(expectedBundleId);
        });

        it('should throw error when bundle not found', async () => {
            const config = createTestConfig({ manifestId: 'missing-bundle' });
            
            const mockDeps: SourceSetupDependencies = {
                registryManager: {
                    addSource: async () => {},
                    syncSource: async () => {}
                },
                storage: {
                    getCachedSourceBundles: async () => [
                        { id: 'other-bundle-1.0.0', name: 'Other Bundle' }
                    ]
                }
            };
            
            await expect(() => setupSourceWithCustomConfig(mockDeps, 'test-id', 'suffix', config, 'content')).rejects.toThrow(/Should find bundle containing 'missing-bundle'/, 'Should throw descriptive error when bundle not found');
        });

        it('should configure nock mocks for GitHub API', async () => {
            const config = createTestConfig();
            const expectedBundleId = computeBundleId(config, '1.0.0');
            
            const mockDeps: SourceSetupDependencies = {
                registryManager: {
                    addSource: async () => {},
                    syncSource: async () => {}
                },
                storage: {
                    getCachedSourceBundles: async () => [{ id: expectedBundleId }]
                }
            };
            
            await setupSourceWithCustomConfig(mockDeps, 'test-id', 'suffix', config, 'content');
            
            // Verify nock mocks were configured by making a request
            const axios = require('axios');
            const response = await axios.get(
                `https://api.github.com/repos/${config.owner}/${config.repo}/releases`
            );
            
            expect(response.status).toBe(200);
            expect(Array.isArray(response.data)).toBeTruthy();
        });
    });
});
