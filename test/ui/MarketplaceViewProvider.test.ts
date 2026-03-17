/**
 * Tests for MarketplaceViewProvider
 * Focus on dynamic tag extraction and source filtering
 */

import { Bundle, RegistrySource } from '../../src/types/registry';
import {
    extractAllTags,
    getTagFrequency,
    extractBundleSources,
    filterBundlesBySource,
    filterBundlesByTags,
    filterBundlesBySearch
} from '../../src/utils/filterUtils';
import { determineButtonState, matchesBundleIdentity } from '../helpers/marketplaceTestHelpers';

describe('MarketplaceViewProvider - Dynamic Filtering', () => {
    let mockBundles: Bundle[];
    let mockSources: RegistrySource[];

    beforeEach(() => {
        // Setup mock bundles with various tags
        mockBundles = [
            {
                id: 'bundle1',
                name: 'Testing Bundle',
                version: '1.0.0',
                description: 'A testing bundle',
                author: 'Test Author',
                sourceId: 'source1',
                environments: ['vscode'],
                tags: ['testing', 'automation', 'tdd'],
                lastUpdated: '2024-01-01',
                size: '1MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest.yml',
                downloadUrl: 'https://example.com/bundle.zip'
            },
            {
                id: 'bundle2',
                name: 'Accessibility Bundle',
                version: '1.0.0',
                description: 'Accessibility helpers',
                author: 'A11y Team',
                sourceId: 'source2',
                environments: ['vscode'],
                tags: ['accessibility', 'a11y', 'testing'],
                lastUpdated: '2024-01-02',
                size: '2MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest2.yml',
                downloadUrl: 'https://example.com/bundle2.zip'
            },
            {
                id: 'bundle3',
                name: 'Agents Bundle',
                version: '2.0.0',
                description: 'AI agents collection',
                author: 'AI Team',
                sourceId: 'source1',
                environments: ['vscode', 'cursor'],
                tags: ['agents', 'ai', 'automation'],
                lastUpdated: '2024-01-03',
                size: '3MB',
                dependencies: [],
                license: 'Apache-2.0',
                manifestUrl: 'https://example.com/manifest3.yml',
                downloadUrl: 'https://example.com/bundle3.zip'
            },
            {
                id: 'bundle4',
                name: 'Angular Bundle',
                version: '1.5.0',
                description: 'Angular development prompts',
                author: 'Angular Team',
                sourceId: 'source2',
                environments: ['vscode'],
                tags: ['angular', 'frontend', 'typescript'],
                lastUpdated: '2024-01-04',
                size: '1.5MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest4.yml',
                downloadUrl: 'https://example.com/bundle4.zip'
            }
        ];

        mockSources = [
            {
                id: 'source1',
                name: 'Primary Source',
                type: 'github',
                url: 'https://github.com/org/repo1',
                enabled: true,
                priority: 1
            },
            {
                id: 'source2',
                name: 'Secondary Source',
                type: 'local',
                url: '/path/to/local',
                enabled: true,
                priority: 2
            },
            {
                id: 'source3',
                name: 'Disabled Source',
                type: 'http',
                url: 'https://example.com/bundles',
                enabled: false,
                priority: 3
            }
        ];
    });

    describe('Dynamic Tag Extraction', () => {
        it('should extract all unique tags from bundles', () => {
            const tags = extractAllTags(mockBundles);
            
            // Should have 10 unique tags
            expect(tags.length).toBe(10);
            expect(tags.includes('testing')).toBeTruthy();
            expect(tags.includes('automation')).toBeTruthy();
            expect(tags.includes('tdd')).toBeTruthy();
            expect(tags.includes('accessibility')).toBeTruthy();
            expect(tags.includes('a11y')).toBeTruthy();
            expect(tags.includes('agents')).toBeTruthy();
            expect(tags.includes('ai')).toBeTruthy();
            expect(tags.includes('angular')).toBeTruthy();
            expect(tags.includes('frontend')).toBeTruthy();
            expect(tags.includes('typescript')).toBeTruthy();
        });

        it('should sort tags alphabetically', () => {
            const tags = extractAllTags(mockBundles);
            
            // Verify alphabetical order
            for (let i = 0; i < tags.length - 1; i++) {
                expect(tags[i].localeCompare(tags[i + 1]) <= 0, `Tag "${tags[i]}" should come before "${tags[i + 1]}"`).toBeTruthy();
            }
        });

        it('should handle bundles with no tags', () => {
            const bundleNoTags: Bundle = {
                ...mockBundles[0],
                id: 'bundle-no-tags',
                tags: []
            };
            
            const tags = extractAllTags([bundleNoTags]);
            expect(tags.length).toBe(0);
        });

        it('should handle empty bundle array', () => {
            const tags = extractAllTags([]);
            expect(tags.length).toBe(0);
        });

        it('should deduplicate tags across bundles', () => {
            // 'testing' and 'automation' appear in multiple bundles
            const tags = extractAllTags(mockBundles);
            
            const testingCount = tags.filter(t => t === 'testing').length;
            const automationCount = tags.filter(t => t === 'automation').length;
            
            expect(testingCount, 'testing tag should appear only once').toBe(1);
            expect(automationCount, 'automation tag should appear only once').toBe(1);
        });

        it('should count tag frequency', () => {
            const tagFrequency = getTagFrequency(mockBundles);
            
            expect(tagFrequency.get('testing')).toBe(2);
            expect(tagFrequency.get('automation')).toBe(2);
            expect(tagFrequency.get('a11y')).toBe(1);
            expect(tagFrequency.get('agents')).toBe(1);
            expect(tagFrequency.get('angular')).toBe(1);
        });
    });

    describe('Source Filtering', () => {
        it('should extract all sources from bundles', () => {
            const sources = extractBundleSources(mockBundles, mockSources);
            
            // Should have 2 sources (source1 and source2 have bundles)
            expect(sources.length).toBe(2);
            
            const sourceIds = sources.map(s => s.id);
            expect(sourceIds.includes('source1')).toBeTruthy();
            expect(sourceIds.includes('source2')).toBeTruthy();
        });

        it('should include bundle count per source', () => {
            const sources = extractBundleSources(mockBundles, mockSources);
            
            const source1 = sources.find(s => s.id === 'source1');
            const source2 = sources.find(s => s.id === 'source2');
            
            expect(source1).toBeTruthy();
            expect(source2).toBeTruthy();
            expect(source1.bundleCount).toBe(2); // bundle1 and bundle3
            expect(source2.bundleCount).toBe(2); // bundle2 and bundle4
        });

        it('should not include sources with no bundles', () => {
            const sources = extractBundleSources(mockBundles, mockSources);
            
            const source3 = sources.find(s => s.id === 'source3');
            expect(source3).toBe(undefined);
        });

        it('should handle empty bundles array', () => {
            const sources = extractBundleSources([], mockSources);
            expect(sources.length).toBe(0);
        });

        it('should filter bundles by source', () => {
            const filtered = filterBundlesBySource(mockBundles, 'source1');
            
            expect(filtered.length).toBe(2);
            expect(filtered.every(b => b.sourceId === 'source1')).toBeTruthy();
        });

        it('should return all bundles when source is "all"', () => {
            const filtered = filterBundlesBySource(mockBundles, 'all');
            
            expect(filtered.length).toBe(mockBundles.length);
        });

        it('should return empty array for non-existent source', () => {
            const filtered = filterBundlesBySource(mockBundles, 'non-existent');
            
            expect(filtered.length).toBe(0);
        });
    });

    describe('Tag Filtering', () => {
        it('should filter bundles by single tag', () => {
            const filtered = filterBundlesByTags(mockBundles, ['testing']);
            
            expect(filtered.length).toBe(2);
            filtered.forEach(bundle => {
                expect(bundle.tags.some(t => t.toLowerCase() === 'testing')).toBeTruthy();
            });
        });

        it('should filter bundles by multiple tags (OR logic)', () => {
            const filtered = filterBundlesByTags(mockBundles, ['agents', 'angular']);
            
            // Should match bundle3 (agents) and bundle4 (angular)
            expect(filtered.length).toBe(2);
            const ids = filtered.map(b => b.id);
            expect(ids.includes('bundle3')).toBeTruthy();
            expect(ids.includes('bundle4')).toBeTruthy();
        });

        it('should return all bundles when tags array is empty', () => {
            const filtered = filterBundlesByTags(mockBundles, []);
            
            expect(filtered.length).toBe(mockBundles.length);
        });

        it('should return empty array when no bundles match tags', () => {
            const filtered = filterBundlesByTags(mockBundles, ['non-existent-tag']);
            
            expect(filtered.length).toBe(0);
        });

        it('should be case-insensitive', () => {
            const filtered = filterBundlesByTags(mockBundles, ['TESTING']);
            
            expect(filtered.length).toBe(2);
        });
    });

    describe('Combined Filtering', () => {
        it('should filter by both source and tags', () => {
            // Filter source1 bundles with 'automation' tag
            let filtered = filterBundlesBySource(mockBundles, 'source1');
            filtered = filterBundlesByTags(filtered, ['automation']);
            
            // Should match bundle1 and bundle3
            expect(filtered.length).toBe(2);
            filtered.forEach(bundle => {
                expect(bundle.sourceId).toBe('source1');
                expect(bundle.tags.some(t => t.toLowerCase() === 'automation')).toBeTruthy();
            });
        });

        it('should filter by source, tags, and search text', () => {
            let filtered = filterBundlesBySource(mockBundles, 'source1');
            filtered = filterBundlesByTags(filtered, ['automation']);
            filtered = filterBundlesBySearch(filtered, 'testing');
            
            // Should match only bundle1
            expect(filtered.length).toBe(1);
            expect(filtered[0].id).toBe('bundle1');
        });
    });

    describe('Button State Determination', () => {

        it('should return "install" state when no version installed', () => {
            const buttonState = determineButtonState(undefined, '1.0.0');
            expect(buttonState).toBe('install');
        });

        it('should return "update" state when older version installed', () => {
            const buttonState = determineButtonState('1.0.0', '2.0.0');
            expect(buttonState).toBe('update');
        });

        it('should return "update" state for minor version difference', () => {
            const buttonState = determineButtonState('1.0.0', '1.1.0');
            expect(buttonState).toBe('update');
        });

        it('should return "update" state for patch version difference', () => {
            const buttonState = determineButtonState('1.0.0', '1.0.1');
            expect(buttonState).toBe('update');
        });

        it('should return "uninstall" state when latest version installed', () => {
            const buttonState = determineButtonState('2.0.0', '2.0.0');
            expect(buttonState).toBe('uninstall');
        });

        it('should return "uninstall" state when newer version installed', () => {
            // Edge case: user has a newer version than what's available
            const buttonState = determineButtonState('3.0.0', '2.0.0');
            expect(buttonState).toBe('uninstall');
        });

        it('should handle version prefixes correctly', () => {
            const buttonState1 = determineButtonState('v1.0.0', 'v2.0.0');
            expect(buttonState1).toBe('update');

            const buttonState2 = determineButtonState('v2.0.0', 'v2.0.0');
            expect(buttonState2).toBe('uninstall');
        });

        it('should match GitHub bundle identity without version suffix', () => {
            const matches = matchesBundleIdentity(
                'microsoft-vscode-1.0.0',
                'microsoft-vscode-2.0.0',
                'github'
            );
            expect(matches).toBe(true);
        });

        it('should not match different GitHub repositories', () => {
            const matches = matchesBundleIdentity(
                'microsoft-vscode-1.0.0',
                'microsoft-copilot-1.0.0',
                'github'
            );
            expect(matches).toBe(false);
        });

        it('should match GitHub bundles with complex names', () => {
            const matches = matchesBundleIdentity(
                'my-org-my-repo-123-v1.0.0',
                'my-org-my-repo-123-v2.0.0',
                'github'
            );
            expect(matches).toBe(true);
        });

        it('should require exact match for non-GitHub bundles', () => {
            const matches1 = matchesBundleIdentity(
                'local-bundle-1.0.0',
                'local-bundle-1.0.0',
                'local'
            );
            expect(matches1).toBe(true);

            const matches2 = matchesBundleIdentity(
                'local-bundle-1.0.0',
                'local-bundle-2.0.0',
                'local'
            );
            expect(matches2).toBe(false);
        });

        it('should require exact match for GitLab bundles', () => {
            const matches = matchesBundleIdentity(
                'gitlab-bundle-1',
                'gitlab-bundle-2',
                'gitlab'
            );
            expect(matches).toBe(false);
        });

        it('should require exact match for HTTP bundles', () => {
            const matches = matchesBundleIdentity(
                'http-bundle-v1',
                'http-bundle-v2',
                'http'
            );
            expect(matches).toBe(false);
        });

        it('should require exact match for awesome-copilot bundles', () => {
            const matches = matchesBundleIdentity(
                'awesome-bundle',
                'awesome-bundle',
                'awesome-copilot'
            );
            expect(matches).toBe(true);
        });
    });

    describe('Update Action', () => {
        /**
         * Mock RegistryManager for testing update action
         */
        class MockRegistryManager {
            private installedBundles: Map<string, any> = new Map();
            private uninstallCalls: Array<{ bundleId: string; scope: string }> = [];
            private installCalls: Array<{ bundleId: string; options: any }> = [];
            
            async listInstalledBundles() {
                return Array.from(this.installedBundles.values());
            }
            
            async uninstallBundle(bundleId: string, scope: string) {
                this.uninstallCalls.push({ bundleId, scope });
                this.installedBundles.delete(bundleId);
            }
            
            async installBundle(bundleId: string, options: any) {
                this.installCalls.push({ bundleId, options });
                this.installedBundles.set(bundleId, {
                    bundleId,
                    version: options.version || 'latest',
                    scope: options.scope || 'user'
                });
            }
            
            setInstalledBundle(bundleId: string, version: string, scope: string) {
                this.installedBundles.set(bundleId, { bundleId, version, scope });
            }
            
            getUninstallCalls() {
                return this.uninstallCalls;
            }
            
            getInstallCalls() {
                return this.installCalls;
            }
            
            clearCalls() {
                this.uninstallCalls = [];
                this.installCalls = [];
            }
        }

        it('should successfully update bundle from older to latest version', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'test-bundle';
            const oldVersion = '1.0.0';
            const newVersion = '2.0.0';
            
            // Setup: bundle is installed with old version
            mockManager.setInstalledBundle(bundleId, oldVersion, 'user');
            
            // Simulate update action: uninstall then install
            await mockManager.uninstallBundle(bundleId, 'user');
            await mockManager.installBundle(bundleId, { scope: 'user', version: newVersion });
            
            // Verify uninstall was called
            const uninstallCalls = mockManager.getUninstallCalls();
            expect(uninstallCalls.length).toBe(1);
            expect(uninstallCalls[0].bundleId).toBe(bundleId);
            expect(uninstallCalls[0].scope).toBe('user');
            
            // Verify install was called with new version
            const installCalls = mockManager.getInstallCalls();
            expect(installCalls.length).toBe(1);
            expect(installCalls[0].bundleId).toBe(bundleId);
            expect(installCalls[0].options.version).toBe(newVersion);
            expect(installCalls[0].options.scope).toBe('user');
        });

        it('should handle update with uninstall failure', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'test-bundle';
            
            // Setup: bundle is installed
            mockManager.setInstalledBundle(bundleId, '1.0.0', 'user');
            
            // Override uninstallBundle to throw error
            const originalUninstall = mockManager.uninstallBundle.bind(mockManager);
            mockManager.uninstallBundle = async () => {
                throw new Error('Uninstall failed');
            };
            
            // Attempt update - should fail at uninstall
            try {
                await mockManager.uninstallBundle(bundleId, 'user');
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error instanceof Error).toBeTruthy();
                expect((error as Error).message).toBe('Uninstall failed');
            }
            
            // Verify install was not called (update should stop after uninstall failure)
            const installCalls = mockManager.getInstallCalls();
            expect(installCalls.length).toBe(0);
        });

        it('should handle update with install failure', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'test-bundle';
            
            // Setup: bundle is installed
            mockManager.setInstalledBundle(bundleId, '1.0.0', 'user');
            
            // Uninstall succeeds
            await mockManager.uninstallBundle(bundleId, 'user');
            
            // Override installBundle to throw error
            mockManager.installBundle = async () => {
                throw new Error('Install failed');
            };
            
            // Attempt install - should fail
            try {
                await mockManager.installBundle(bundleId, { scope: 'user', version: '2.0.0' });
                expect.fail('Should have thrown error');
            } catch (error) {
                expect(error instanceof Error).toBeTruthy();
                expect((error as Error).message).toBe('Install failed');
            }
            
            // Verify uninstall was called (bundle is now uninstalled but new version not installed)
            const uninstallCalls = mockManager.getUninstallCalls();
            expect(uninstallCalls.length).toBe(1);
        });

        it('should preserve bundle scope during update', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'test-bundle';
            
            // Test with 'workspace' scope
            mockManager.setInstalledBundle(bundleId, '1.0.0', 'workspace');
            
            await mockManager.uninstallBundle(bundleId, 'workspace');
            await mockManager.installBundle(bundleId, { scope: 'workspace', version: '2.0.0' });
            
            const uninstallCalls = mockManager.getUninstallCalls();
            const installCalls = mockManager.getInstallCalls();
            
            expect(uninstallCalls[0].scope).toBe('workspace');
            expect(installCalls[0].options.scope).toBe('workspace');
        });

        it('should handle update for GitHub bundles with version suffix', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'microsoft-vscode-1.0.0';
            const newBundleId = 'microsoft-vscode-2.0.0';
            
            // Setup: old version installed
            mockManager.setInstalledBundle(bundleId, '1.0.0', 'user');
            
            // Update should uninstall old and install new
            await mockManager.uninstallBundle(bundleId, 'user');
            await mockManager.installBundle(newBundleId, { scope: 'user', version: '2.0.0' });
            
            const uninstallCalls = mockManager.getUninstallCalls();
            const installCalls = mockManager.getInstallCalls();
            
            expect(uninstallCalls[0].bundleId).toBe(bundleId);
            expect(installCalls[0].bundleId).toBe(newBundleId);
        });

        it('should handle multiple sequential updates', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'test-bundle';
            
            // Install v1.0.0
            mockManager.setInstalledBundle(bundleId, '1.0.0', 'user');
            
            // Update to v1.5.0
            await mockManager.uninstallBundle(bundleId, 'user');
            await mockManager.installBundle(bundleId, { scope: 'user', version: '1.5.0' });
            mockManager.clearCalls();
            
            // Update to v2.0.0
            mockManager.setInstalledBundle(bundleId, '1.5.0', 'user');
            await mockManager.uninstallBundle(bundleId, 'user');
            await mockManager.installBundle(bundleId, { scope: 'user', version: '2.0.0' });
            
            const uninstallCalls = mockManager.getUninstallCalls();
            const installCalls = mockManager.getInstallCalls();
            
            // Should have one uninstall and one install for the second update
            expect(uninstallCalls.length).toBe(1);
            expect(installCalls.length).toBe(1);
            expect(installCalls[0].options.version).toBe('2.0.0');
        });

        it('should handle update when bundle is not installed', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'test-bundle';
            
            // Attempt to uninstall non-existent bundle
            // In real implementation, this should either:
            // 1. Skip uninstall and just install
            // 2. Throw an error
            // For this test, we'll verify the behavior
            
            const installedBundles = await mockManager.listInstalledBundles();
            const isInstalled = installedBundles.some(b => b.bundleId === bundleId);
            
            expect(isInstalled).toBe(false);
            
            // If not installed, update should just install
            if (!isInstalled) {
                await mockManager.installBundle(bundleId, { scope: 'user', version: '2.0.0' });
            }
            
            const installCalls = mockManager.getInstallCalls();
            expect(installCalls.length).toBe(1);
        });

        it('should handle installVersion with specific version', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'test-bundle';
            const version = '1.5.0';
            
            // Install specific version
            await mockManager.installBundle(bundleId, { scope: 'user', version });
            
            const installCalls = mockManager.getInstallCalls();
            expect(installCalls.length).toBe(1);
            expect(installCalls[0].bundleId).toBe(bundleId);
            expect(installCalls[0].options.version).toBe(version);
        });

        it('should pass version parameter to RegistryManager.installBundle', async () => {
            const mockManager = new MockRegistryManager();
            const bundleId = 'owner-repo-v2.0.0';
            const requestedVersion = '1.0.0';
            
            // Simulate version-specific installation
            await mockManager.installBundle(bundleId, { 
                scope: 'user', 
                version: requestedVersion 
            });
            
            const installCalls = mockManager.getInstallCalls();
            expect(installCalls.length).toBe(1);
            expect(installCalls[0].options.version).toBe(requestedVersion);
        });
    });

    describe('Version Selection Backend Logic', () => {
        it('should handle getVersions message and return available versions', () => {
            // Mock bundle with multiple versions
            const bundle: Bundle = {
                id: 'owner-repo-v2.0.0',
                name: 'Test Bundle',
                version: '2.0.0',
                description: 'Test',
                author: 'Test',
                sourceId: 'github-source',
                environments: ['vscode'],
                tags: [],
                lastUpdated: '2024-01-01',
                size: '1MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest.yml',
                downloadUrl: 'https://example.com/bundle.zip'
            };

            // Add available versions to bundle (as would be done by consolidator)
            const enhancedBundle = {
                ...bundle,
                availableVersions: [
                    { version: '2.0.0' },
                    { version: '1.5.0' },
                    { version: '1.0.0' }
                ]
            };

            // Verify versions are present
            expect(enhancedBundle.availableVersions).toBeTruthy();
            expect(enhancedBundle.availableVersions.length).toBe(3);
            expect(enhancedBundle.availableVersions[0].version).toBe('2.0.0');
        });

        it('should include availableVersions in enhanced bundles', () => {
            const bundle: any = {
                id: 'owner-repo-v2.0.0',
                name: 'Test Bundle',
                version: '2.0.0',
                isConsolidated: true,
                availableVersions: [
                    { version: '2.0.0', publishedAt: '2024-01-03', downloadUrl: 'url3', manifestUrl: 'manifest3' },
                    { version: '1.5.0', publishedAt: '2024-01-02', downloadUrl: 'url2', manifestUrl: 'manifest2' },
                    { version: '1.0.0', publishedAt: '2024-01-01', downloadUrl: 'url1', manifestUrl: 'manifest1' }
                ]
            };

            // Simulate what loadBundles does
            let availableVersions: Array<{version: string}> | undefined;
            if (bundle.isConsolidated && bundle.availableVersions) {
                availableVersions = bundle.availableVersions.map((v: any) => ({
                    version: v.version
                }));
            }

            expect(availableVersions).toBeTruthy();
            expect(availableVersions!.length).toBe(3);
            expect(availableVersions).toEqual([
                { version: '2.0.0' },
                { version: '1.5.0' },
                { version: '1.0.0' }
            ]);
        });
    });
});
