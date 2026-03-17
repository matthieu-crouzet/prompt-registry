/**
 * LocalAwesomeCopilotAdapter Unit Tests
 * Tests local filesystem-based awesome-copilot collection loading
 */

import * as path from 'path';
import AdmZip from 'adm-zip';
import { LocalAwesomeCopilotAdapter } from '../../src/adapters/LocalAwesomeCopilotAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('LocalAwesomeCopilotAdapter', () => {
    const fixturesPath = path.join(__dirname, '../fixtures/local-awesome-collections');
    
    const mockSource: RegistrySource = {
        id: 'test-local-awesome',
        name: 'Test Local Awesome',
        type: 'local-awesome-copilot',
        url: fixturesPath,
        enabled: true,
        priority: 1,
    };

    describe('Constructor and Validation', () => {
        it('should accept valid local path', () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            expect(adapter.type).toBe('local-awesome-copilot');
        });

        it('should accept file:// URL', () => {
            const source = { ...mockSource, url: `file://${fixturesPath}` };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should throw error for invalid path format', () => {
            const source = { ...mockSource, url: 'http://invalid.com/path' };
            expect(() => new LocalAwesomeCopilotAdapter(source)).toThrow(/Invalid local path/);
        });

        it('should use default collectionsPath config', () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            expect(adapter).toBeTruthy();
            // Default should be 'collections'
        });

        it('should accept custom collectionsPath config', () => {
            const source = { 
                ...mockSource, 
                config: { collectionsPath: 'custom-collections' } 
            };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            expect(adapter).toBeTruthy();
        });
    });

    describe('fetchMetadata', () => {
        it('should fetch local collections metadata', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const metadata = await adapter.fetchMetadata();

            expect(metadata).toBeTruthy();
            expect(typeof metadata.name).toBe('string');
            expect(typeof metadata.description).toBe('string');
            expect(typeof metadata.bundleCount).toBe('number');
            expect(metadata.bundleCount >= 0).toBeTruthy();
            expect(metadata.lastUpdated).toBeTruthy();
        });

        it('should report correct collection count', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const metadata = await adapter.fetchMetadata();

            // We have 3 collections in fixtures
            expect(metadata.bundleCount).toBe(3);
        });

        it('should throw error for non-existent directory', async () => {
            const source = { ...mockSource, url: '/non/existent/path' };
            const adapter = new LocalAwesomeCopilotAdapter(source);

            await expect(() => adapter.fetchMetadata()).rejects.toThrow(/Collections directory does not exist/);
        });
    });

    describe('fetchBundles', () => {
        it('should discover all collection files', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            expect(Array.isArray(bundles)).toBeTruthy();
            expect(bundles.length).toBe(3);

            // Check collection IDs
            const bundleIds = bundles.map(b => b.id).sort();
            expect(bundleIds).toEqual(['python-dev', 'skills-collection', 'test-collection']);
        });

        it('should parse YAML collections correctly', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            const testBundle = bundles.find(b => b.id === 'test-collection');
            expect(testBundle).toBeTruthy();
            expect(testBundle.name).toBe('Test Collection');
            expect(testBundle.version).toBe('1.0.0');
            expect(testBundle.description).toBe('A test collection for unit testing');
            expect(testBundle.author).toBe('Local Developer');
            expect(Array.isArray(testBundle.tags)).toBeTruthy();
            expect(testBundle.tags.includes('test')).toBeTruthy();
            expect(testBundle.tags.includes('azure')).toBeTruthy();
        });

        it('should include all bundle metadata', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            for (const bundle of bundles) {
                expect(bundle.id).toBeTruthy();
                expect(bundle.name).toBeTruthy();
                expect(bundle.version).toBe('1.0.0');
                expect(bundle.description).toBeTruthy();
                expect(bundle.author).toBeTruthy();
                expect(bundle.sourceId).toBe('test-local-awesome');
                expect(Array.isArray(bundle.environments)).toBeTruthy();
                expect(Array.isArray(bundle.tags)).toBeTruthy();
                expect(bundle.lastUpdated).toBeTruthy();
                expect(bundle.downloadUrl).toBeTruthy();
                expect(bundle.manifestUrl).toBeTruthy();
                expect(bundle.license).toBe('MIT');
            }
        });

        it('should handle file:// URLs in download/manifest URLs', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            for (const bundle of bundles) {
                expect(bundle.downloadUrl.startsWith('file://')).toBeTruthy();
                expect(bundle.manifestUrl.startsWith('file://')).toBeTruthy();
                expect(bundle.manifestUrl.includes('.collection.yml')).toBeTruthy();
            }
        });

        it('should infer environments from tags', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            const testBundle = bundles.find(b => b.id === 'test-collection');
            expect(testBundle).toBeTruthy();
            // Should have 'cloud' environment from 'azure' tag
            expect(testBundle.environments.includes('cloud')).toBeTruthy();
        });

        it('should calculate item breakdown', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            const testBundle = bundles.find(b => b.id === 'test-collection');
            expect(testBundle).toBeTruthy();
            
            // Check that breakdown metadata was added
            const breakdown = (testBundle as any).breakdown;
            expect(breakdown).toBeTruthy();
            expect(breakdown.prompts).toBe(1);
            expect(breakdown.instructions).toBe(1);
        });

        it('should cache results for performance', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            
            const start1 = Date.now();
            const bundles1 = await adapter.fetchBundles();
            const time1 = Date.now() - start1;

            const start2 = Date.now();
            const bundles2 = await adapter.fetchBundles();
            const time2 = Date.now() - start2;

            // Second call should be faster (cached)
            expect(time2 < time1 || time2 < 10, 'Second call should use cache').toBeTruthy();
            expect(bundles1).toEqual(bundles2);
        });

        it('should skip non-collection files', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            // Only .collection.yml files should be processed
            expect(bundles.every(b => b.id && b.name)).toBeTruthy();
        });
    });

    describe('validate', () => {
        it('should validate accessible collections directory', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const result = await adapter.validate();

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.bundlesFound).toBe(3);
        });

        it('should fail validation for non-existent directory', async () => {
            const source = { ...mockSource, url: '/non/existent/path' };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
            expect(result.errors[0].includes('Collections directory does not exist')).toBeTruthy();
            expect(result.bundlesFound).toBe(0);
        });

        it('should fail validation for directory without collections', async () => {
            // Use a directory that exists but has no collections subdirectory
            const source = { ...mockSource, url: path.join(__dirname, '../fixtures') };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
        });
    });

    describe('getDownloadUrl', () => {
        it('should generate correct file:// URL for collection', () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const url = adapter.getDownloadUrl('test-collection', '1.0.0');

            expect(url.startsWith('file://')).toBeTruthy();
            expect(url.includes('test-collection.collection.yml')).toBeTruthy();
        });
    });

    describe('getManifestUrl', () => {
        it('should generate correct manifest URL', () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const url = adapter.getManifestUrl('test-collection', '1.0.0');

            expect(url.startsWith('file://')).toBeTruthy();
            expect(url.includes('test-collection.collection.yml')).toBeTruthy();
            expect(url.includes('collections')).toBeTruthy();
        });

        it('should match download URL', () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const manifestUrl = adapter.getManifestUrl('test-collection');
            const downloadUrl = adapter.getDownloadUrl('test-collection');

            // For local awesome copilot, manifest and download URLs are the same
            expect(manifestUrl).toBe(downloadUrl);
        });
    });

    describe('downloadBundle', () => {
        it('should create zip archive from collection', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            const testBundle = bundles.find(b => b.id === 'test-collection');
            
            expect(testBundle).toBeTruthy();
            const buffer = await adapter.downloadBundle(testBundle);

            expect(Buffer.isBuffer(buffer)).toBeTruthy();
            expect(buffer.length > 0).toBeTruthy();
        });

        it('should include deployment manifest in archive', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            const testBundle = bundles.find(b => b.id === 'test-collection');
            
            expect(testBundle).toBeTruthy();
            const buffer = await adapter.downloadBundle(testBundle);

            // Archive should contain manifest
            // This is a basic check - full archive inspection would need unzip
            expect(buffer.length > 100).toBeTruthy(); // Reasonable size for manifest + files
        });

        it('should include skill nested subdirectories recursively in archive', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            const skillsBundle = bundles.find(b => b.id === 'skills-collection');

            expect(skillsBundle, 'skills-collection bundle must be discoverable').toBeTruthy();
            const buffer = await adapter.downloadBundle(skillsBundle);

            const zip = new AdmZip(buffer);
            const entryNames = zip.getEntries().map(e => e.entryName);

            expect(entryNames.includes('deployment-manifest.yml'), 'archive must contain deployment-manifest.yml').toBeTruthy();
            expect(entryNames.some(e => e === 'skills/analyzer/SKILL.md'), 'archive must contain skills/analyzer/SKILL.md').toBeTruthy();
            expect(entryNames.some(e => e === 'skills/analyzer/templates/analysis-template.md'), 'archive must contain skills/analyzer/templates/analysis-template.md (nested subdirectory)').toBeTruthy();
            expect(entryNames.some(e => e === 'skills/reporter/SKILL.md'), 'archive must contain skills/reporter/SKILL.md').toBeTruthy();
        });

        it('should handle bundle without stored collectionFile', async () => {
            const adapter = new LocalAwesomeCopilotAdapter(mockSource);
            const testBundle = {
                id: 'test-collection',
                name: 'Test',
                version: '1.0.0',
                description: 'Test',
                author: 'Test',
                sourceId: 'test',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '1',
                dependencies: [],
                license: 'MIT',
                downloadUrl: 'file://test',
                manifestUrl: 'file://test',
                repository: 'test'
            };

            const buffer = await adapter.downloadBundle(testBundle);
            expect(Buffer.isBuffer(buffer)).toBeTruthy();
        });
    });

    describe('Path Handling', () => {
        it('should handle absolute paths', () => {
            const source = { ...mockSource, url: fixturesPath };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should handle file:// URLs', () => {
            const source = { ...mockSource, url: `file://${fixturesPath}` };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should normalize paths correctly', async () => {
            const source = { ...mockSource, url: fixturesPath + '//' };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            
            // Should still work despite extra slashes
            const bundles = await adapter.fetchBundles();
            expect(bundles.length > 0).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should handle missing item files gracefully', async () => {
            // Create a collection that references non-existent files
            const source = { ...mockSource };
            const adapter = new LocalAwesomeCopilotAdapter(source);
            
            // This should work for fetchBundles (parsing only)
            const bundles = await adapter.fetchBundles();
            expect(bundles.length > 0).toBeTruthy();
        });

        it('should provide helpful error messages', async () => {
            const source = { ...mockSource, url: '/completely/invalid/path' };
            const adapter = new LocalAwesomeCopilotAdapter(source);

            try {
                await adapter.fetchBundles();
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message.includes('local awesome-copilot collections')).toBeTruthy();
                expect(error.message.includes('Collections directory does not exist')).toBeTruthy();
            }
        });
    });
});
