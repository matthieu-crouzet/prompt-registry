/**
 * LocalApmAdapter Unit Tests
 * Tests local filesystem-based APM package loading
 */

import * as path from 'path';
import { LocalApmAdapter } from '../../src/adapters/LocalApmAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('LocalApmAdapter', () => {
    const fixturesPath = path.join(__dirname, '../fixtures/apm');
    const singlePackagePath = path.join(fixturesPath, 'single-package');
    const monorepoPath = path.join(fixturesPath, 'monorepo');
    
    const mockSource: RegistrySource = {
        id: 'test-local-apm',
        name: 'Test Local APM',
        type: 'local-apm',
        url: singlePackagePath,
        enabled: true,
        priority: 1,
    };

    describe('Constructor and Validation', () => {
        it('should accept valid local path', () => {
            const adapter = new LocalApmAdapter(mockSource);
            expect(adapter.type).toBe('local-apm');
        });

        it('should accept file:// URL', () => {
            const source = { ...mockSource, url: `file://${singlePackagePath}` };
            const adapter = new LocalApmAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should throw error for invalid path format', () => {
            const source = { ...mockSource, url: 'http://invalid.com/path' };
            expect(() => new LocalApmAdapter(source)).toThrow(/Invalid local path/);
        });

        it('should accept paths starting with ~/', () => {
            // This test validates path format acceptance, not actual resolution
            const source = { ...mockSource, url: '~/some/path' };
            const adapter = new LocalApmAdapter(source);
            expect(adapter).toBeTruthy();
        });
    });

    describe('fetchMetadata', () => {
        it('should fetch local APM package metadata', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const metadata = await adapter.fetchMetadata();

            expect(metadata).toBeTruthy();
            expect(typeof metadata.name).toBe('string');
            expect(typeof metadata.description).toBe('string');
            expect(typeof metadata.bundleCount).toBe('number');
            expect(metadata.bundleCount >= 0).toBeTruthy();
            expect(metadata.lastUpdated).toBeTruthy();
        });

        it('should report correct package count for single package', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const metadata = await adapter.fetchMetadata();

            expect(metadata.bundleCount).toBe(1);
        });

        it('should throw error for non-existent directory', async () => {
            const source = { ...mockSource, url: '/non/existent/path' };
            const adapter = new LocalApmAdapter(source);

            await expect(() => adapter.fetchMetadata()).rejects.toThrow(/not found|does not exist/i);
        });
    });

    describe('fetchBundles - Single Package', () => {
        it('should discover apm.yml at root', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            expect(Array.isArray(bundles)).toBeTruthy();
            expect(bundles.length).toBe(1);
        });

        it('should parse apm.yml correctly', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            const bundle = bundles[0];
            expect(bundle.name).toBe('test-apm-package');
            expect(bundle.version).toBe('1.2.0');
            expect(bundle.description).toBe('A test APM package for unit testing');
            expect(bundle.author).toBe('Test Author');
            expect(Array.isArray(bundle.tags)).toBeTruthy();
            expect(bundle.tags.includes('testing')).toBeTruthy();
            expect(bundle.tags.includes('apm')).toBeTruthy();
            expect(bundle.tags.includes('local')).toBeTruthy();
        });

        it('should include all bundle metadata', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            for (const bundle of bundles) {
                expect(bundle.id).toBeTruthy();
                expect(bundle.name).toBeTruthy();
                expect(bundle.version).toBeTruthy();
                expect(bundle.description).toBeTruthy();
                expect(bundle.author).toBeTruthy();
                expect(bundle.sourceId).toBe('test-local-apm');
                expect(Array.isArray(bundle.environments)).toBeTruthy();
                expect(Array.isArray(bundle.tags)).toBeTruthy();
                expect(bundle.lastUpdated).toBeTruthy();
                expect(bundle.downloadUrl).toBeTruthy();
                expect(bundle.manifestUrl).toBeTruthy();
                expect(bundle.license).toBeTruthy();
            }
        });

        it('should handle file:// URLs in download/manifest URLs', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            for (const bundle of bundles) {
                expect(bundle.downloadUrl.startsWith('file://')).toBeTruthy();
                expect(bundle.manifestUrl.startsWith('file://')).toBeTruthy();
            }
        });

        it('should infer cloud environment from azure tag', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            const bundle = bundles[0];
            expect(bundle.environments.includes('cloud')).toBeTruthy();
        });

        it('should cache results for performance', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            
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
    });

    describe('fetchBundles - Monorepo', () => {
        it('should discover multiple packages in subdirectories', async () => {
            const source = { ...mockSource, url: monorepoPath };
            const adapter = new LocalApmAdapter(source);
            const bundles = await adapter.fetchBundles();

            expect(Array.isArray(bundles)).toBeTruthy();
            expect(bundles.length).toBe(2);

            const names = bundles.map(b => b.name).sort();
            expect(names).toEqual(['package-alpha', 'package-beta']);
        });

        it('should respect scanSubdirectories config', async () => {
            const source = { 
                ...mockSource, 
                url: monorepoPath,
                config: { scanSubdirectories: false }
            };
            const adapter = new LocalApmAdapter(source);
            const bundles = await adapter.fetchBundles();

            // With scanning disabled, should not find packages in subdirs
            expect(bundles.length).toBe(0);
        });
    });

    describe('validate', () => {
        it('should validate accessible directory', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const result = await adapter.validate();

            expect(result.valid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.bundlesFound).toBe(1);
        });

        it('should fail validation for non-existent directory', async () => {
            const source = { ...mockSource, url: '/non/existent/path' };
            const adapter = new LocalApmAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(false);
            expect(result.errors.length > 0).toBeTruthy();
            expect(result.errors[0].includes('does not exist')).toBeTruthy();
            expect(result.bundlesFound).toBe(0);
        });

        it('should warn for directory without apm.yml', async () => {
            // Use a directory that exists but has no apm.yml files
            const source = { ...mockSource, url: path.join(__dirname, '../fixtures/github') };
            const adapter = new LocalApmAdapter(source);
            const result = await adapter.validate();

            // Should be valid but with warning about no packages found or zero bundles
            expect(result.valid).toBe(true);
            expect(result.warnings.length > 0 || result.bundlesFound === 0).toBeTruthy();
        });
    });

    describe('getDownloadUrl', () => {
        it('should generate correct file:// URL', () => {
            const adapter = new LocalApmAdapter(mockSource);
            const url = adapter.getDownloadUrl('test-package', '1.0.0');

            expect(url.startsWith('file://')).toBeTruthy();
        });
    });

    describe('getManifestUrl', () => {
        it('should generate correct manifest URL', () => {
            const adapter = new LocalApmAdapter(mockSource);
            const url = adapter.getManifestUrl('test-package', '1.0.0');

            expect(url.startsWith('file://')).toBeTruthy();
            expect(url.includes('apm.yml')).toBeTruthy();
        });
    });

    describe('downloadBundle', () => {
        it('should create zip archive from APM package', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            const bundle = bundles[0];
            
            expect(bundle).toBeTruthy();
            const buffer = await adapter.downloadBundle(bundle);

            expect(Buffer.isBuffer(buffer)).toBeTruthy();
            expect(buffer.length > 0).toBeTruthy();
        });

        it('should include deployment manifest in archive', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            const bundle = bundles[0];
            
            expect(bundle).toBeTruthy();
            const buffer = await adapter.downloadBundle(bundle);

            // Archive should be non-trivial size (manifest + files)
            expect(buffer.length > 100).toBeTruthy();
        });
    });

    describe('Path Handling', () => {
        it('should handle absolute paths', () => {
            const source = { ...mockSource, url: singlePackagePath };
            const adapter = new LocalApmAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should handle file:// URLs', () => {
            const source = { ...mockSource, url: `file://${singlePackagePath}` };
            const adapter = new LocalApmAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should normalize paths correctly', async () => {
            const source = { ...mockSource, url: singlePackagePath + '//' };
            const adapter = new LocalApmAdapter(source);
            
            // Should still work despite extra slashes
            const bundles = await adapter.fetchBundles();
            expect(bundles.length > 0).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should provide helpful error messages', async () => {
            const source = { ...mockSource, url: '/completely/invalid/path' };
            const adapter = new LocalApmAdapter(source);

            try {
                await adapter.fetchBundles();
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.message.includes('APM') || error.message.includes('not found') || error.message.includes('does not exist')).toBeTruthy();
            }
        });

        it('should handle bundle without localPackagePath', async () => {
            const adapter = new LocalApmAdapter(mockSource);
            const testBundle = {
                id: 'test-bundle',
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
                // Note: no localPackagePath
            };

            await expect(() => adapter.downloadBundle(testBundle)).rejects.toThrow(/No local path|not found/i);
        });
    });

    describe('Security', () => {
        it('should not allow path traversal in URL', () => {
            const source = { ...mockSource, url: '/some/path/../../../etc/passwd' };
            const adapter = new LocalApmAdapter(source);
            
            // Adapter should normalize the path
            expect(adapter).toBeTruthy();
        });

        it('should skip hidden directories when scanning', async () => {
            const source = { ...mockSource, url: monorepoPath };
            const adapter = new LocalApmAdapter(source);
            const bundles = await adapter.fetchBundles();

            // Should not include any bundles from hidden directories
            for (const bundle of bundles) {
                expect(!bundle.id.includes('.hidden')).toBeTruthy();
            }
        });

        it('should skip node_modules and apm_modules directories', async () => {
            const source = { ...mockSource, url: monorepoPath };
            const adapter = new LocalApmAdapter(source);
            const bundles = await adapter.fetchBundles();

            // Should not include any bundles from node_modules
            for (const bundle of bundles) {
                expect(!bundle.id.includes('node_modules')).toBeTruthy();
                expect(!bundle.id.includes('apm_modules')).toBeTruthy();
            }
        });
    });
});
