/**
 * LocalAdapter Unit Tests
 */

import * as path from 'path';
import { LocalAdapter } from '../../src/adapters/LocalAdapter';
import { RegistrySource } from '../../src/types/registry';

describe('LocalAdapter', () => {
    const fixturesPath = path.join(__dirname, '../fixtures/local-library');
    
    const mockSource: RegistrySource = {
        id: 'test-local',
        name: 'Test Local',
        type: 'local',
        url: fixturesPath,
        enabled: true,
        priority: 1,
    };

    describe('Constructor and Validation', () => {
        it('should accept valid local path', () => {
            const adapter = new LocalAdapter(mockSource);
            expect(adapter.type).toBe('local');
        });

        it('should accept file:// URL', () => {
            const source = { ...mockSource, url: `file://${fixturesPath}` };
            const adapter = new LocalAdapter(source);
            expect(adapter).toBeTruthy();
        });

        it('should throw error for invalid path format', () => {
            const source = { ...mockSource, url: 'http://invalid.com/path' };
            expect(() => new LocalAdapter(source)).toThrow(/Invalid local path/);
        });
    });

    describe('fetchMetadata', () => {
        it('should fetch local registry metadata', async () => {
            const adapter = new LocalAdapter(mockSource);
            const metadata = await adapter.fetchMetadata();

            expect(metadata).toBeTruthy();
            expect(typeof metadata.name).toBe('string');
            expect(typeof metadata.description).toBe('string');
            expect(typeof metadata.bundleCount).toBe('number');
            expect(metadata.bundleCount >= 0).toBeTruthy();
        });

        it('should report correct bundle count', async () => {
            const adapter = new LocalAdapter(mockSource);
            const metadata = await adapter.fetchMetadata();

            // We have 9 bundles in fixtures
            expect(metadata.bundleCount).toBe(9);
        });

        it('should throw error for non-existent directory', async () => {
            const source = { ...mockSource, url: '/non/existent/path' };
            const adapter = new LocalAdapter(source);

            await expect(() => adapter.fetchMetadata()).rejects.toThrow(/Directory does not exist/);
        });
    });

    describe('fetchBundles', () => {
        it('should discover all bundles with manifests', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            expect(Array.isArray(bundles)).toBeTruthy();
            expect(bundles.length).toBe(9);

            // Check bundle IDs
            const bundleIds = bundles.map(b => b.id).sort();
            expect(bundleIds).toEqual([
                'accessibility-bundle',
                'backend-bundle',
                'devops-bundle',
                'example-bundle',
                'example-bundle',
                'security-bundle',
                'testing-bundle',
                'testing-bundle',
                'web-dev-bundle'
            ]);
        });

        it('should parse YAML manifests correctly', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            const exampleBundle = bundles.find(b => b.id === 'example-bundle');
            expect(exampleBundle).toBeTruthy();
            expect(exampleBundle.name).toBe('Example Prompt Bundle');
            expect(exampleBundle.version).toBe('1.0.0');
            expect(exampleBundle.author).toBe('Prompt Registry Team');
            expect(Array.isArray(exampleBundle.tags)).toBeTruthy();
            expect(exampleBundle.tags.includes('example')).toBeTruthy();
        });

        it('should include all bundle metadata', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            for (const bundle of bundles) {
                expect(bundle.id).toBeTruthy();
                expect(bundle.name).toBeTruthy();
                expect(bundle.version).toBeTruthy();
                expect(bundle.description).toBeTruthy();
                expect(bundle.author).toBeTruthy();
                expect(bundle.sourceId).toBe('test-local');
                expect(Array.isArray(bundle.environments)).toBeTruthy();
                expect(Array.isArray(bundle.tags)).toBeTruthy();
                expect(bundle.lastUpdated).toBeTruthy();
                expect(bundle.downloadUrl).toBeTruthy();
                expect(bundle.manifestUrl).toBeTruthy();
            }
        });

        it('should handle file:// URLs in download/manifest URLs', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            for (const bundle of bundles) {
                expect(bundle.downloadUrl.startsWith('file://')).toBeTruthy();
                expect(bundle.manifestUrl.startsWith('file://')).toBeTruthy();
            }
        });

        it('should skip directories without manifests', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();

            // Only bundles with deployment-manifest.yml should be included
            // README.md and other files should be ignored
            expect(bundles.every(b => b.id)).toBeTruthy();
        });
    });

    describe('validate', () => {
        it('should validate accessible local directory', async () => {
            const adapter = new LocalAdapter(mockSource);
            const result = await adapter.validate();

            expect(result.valid).toBe(true);
            expect(Array.isArray(result.warnings)).toBeTruthy();
        });

        it('should fail validation for non-existent directory', async () => {
            const source = { ...mockSource, url: '/non/existent/path' };
            const adapter = new LocalAdapter(source);
            const result = await adapter.validate();

            expect(result.valid).toBe(false);
            expect(Array.isArray(result.errors)).toBeTruthy();
            expect(result.errors.length > 0).toBeTruthy();
        });
    });

    describe('getDownloadUrl', () => {
        it('should generate correct file:// URL for bundle', () => {
            const adapter = new LocalAdapter(mockSource);
            const url = adapter.getDownloadUrl('example-bundle', '1.0.0');

            expect(url.startsWith('file://')).toBeTruthy();
            expect(url.includes('example-bundle')).toBeTruthy();
        });
    });

    describe('getManifestUrl', () => {
        it('should generate correct manifest URL', () => {
            const adapter = new LocalAdapter(mockSource);
            const url = adapter.getManifestUrl('example-bundle', '1.0.0');

            expect(url.startsWith('file://')).toBeTruthy();
            expect(url.includes('example-bundle')).toBeTruthy();
            expect(url.includes('deployment-manifest.yml')).toBeTruthy();
        });
    });

    describe('Diagnostics', () => {
        it('should log directory scanning details', async () => {
            const adapter = new LocalAdapter(mockSource);
            
            // Capture console output
            const logs: string[] = [];
            const originalLog = console.log;
            console.log = (...args: any[]) => {
                logs.push(args.join(' '));
                originalLog(...args);
            };

            try {
                await adapter.fetchBundles();
                
                // Check diagnostic logs were generated
                expect(logs.some(log => log.includes('[LocalAdapter] Scanning directory'))).toBeTruthy();
                expect(logs.some(log => log.includes('[LocalAdapter] Found') && log.includes('entries'))).toBeTruthy();
                expect(logs.some(log => log.includes('[LocalAdapter] Discovered') && log.includes('valid bundles'))).toBeTruthy();
            } finally {
                console.log = originalLog;
            }
        });
    });

    describe('downloadBundle', () => {
        it('should read a valid local file and return correct Buffer', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            
            // Get the first bundle
            const bundle = bundles[0];
            expect(bundle, 'Should have at least one bundle').toBeTruthy();
            
            // Download the bundle
            const buffer = await adapter.downloadBundle(bundle);
            
            // Verify buffer is not empty
            expect(buffer.length > 0, 'Buffer should not be empty').toBeTruthy();
            
            // Verify it's a valid ZIP file by checking magic number
            // ZIP files start with 'PK' (0x50 0x4B)
            expect(buffer[0], 'First byte should be 0x50 (P)').toBe(0x50);
            expect(buffer[1], 'Second byte should be 0x4B (K)').toBe(0x4B);
        });

        it('should throw error for file not found', async () => {
            const adapter = new LocalAdapter(mockSource);
            
            // Create a bundle with non-existent path
            const nonExistentBundle = {
                id: 'non-existent',
                name: 'Non-existent Bundle',
                version: '1.0.0',
                description: 'Test',
                author: 'Test',
                sourceId: 'test-local',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '0 B',
                dependencies: [],
                license: 'MIT',
                downloadUrl: 'file:///non/existent/path',
                manifestUrl: 'file:///non/existent/path/deployment-manifest.yml',
            };
            
            await expect(() => adapter.downloadBundle(nonExistentBundle)).rejects.toThrow(/Bundle directory not found/, 'Should throw error for non-existent directory');
        });

        it('should throw error for permission denied', async ({ skip }: any) => {
            // Skip this test on Windows as permission handling is different
            if (process.platform === 'win32') {
                skip();
                return;
            }

            const adapter = new LocalAdapter(mockSource);
            
            // Create a bundle pointing to a restricted directory
            // /root is typically not accessible to regular users on Unix systems
            const restrictedBundle = {
                id: 'restricted',
                name: 'Restricted Bundle',
                version: '1.0.0',
                description: 'Test',
                author: 'Test',
                sourceId: 'test-local',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '0 B',
                dependencies: [],
                license: 'MIT',
                downloadUrl: 'file:///root/restricted',
                manifestUrl: 'file:///root/restricted/deployment-manifest.yml',
            };
            
            await expect(() => adapter.downloadBundle(restrictedBundle)).rejects.toThrow(/Permission denied|Bundle directory not found/, 'Should throw error for permission denied');
        });

        it('should handle binary file handling (ZIP files)', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            
            // Get a bundle
            const bundle = bundles.find(b => b.id === 'example-bundle');
            expect(bundle, 'Should find example-bundle').toBeTruthy();
            
            // Download the bundle
            const buffer = await adapter.downloadBundle(bundle);
            
            // Verify it's a valid ZIP file
            expect(buffer.length > 0, 'Buffer should not be empty').toBeTruthy();
            expect(buffer[0], 'Should start with ZIP magic number (P)').toBe(0x50);
            expect(buffer[1], 'Should start with ZIP magic number (K)').toBe(0x4B);
            
            // Verify we can extract it using adm-zip
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(buffer);
            const entries = zip.getEntries();
            
            // Should have at least the deployment-manifest.yml
            expect(entries.length > 0, 'ZIP should contain files').toBeTruthy();
            
            // Check for deployment-manifest.yml
            const manifestEntry = entries.find((e: any) => e.entryName === 'deployment-manifest.yml');
            expect(manifestEntry, 'ZIP should contain deployment-manifest.yml').toBeTruthy();
        });

        it('should handle file:// URL format', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            
            // Get a bundle (should have file:// URL)
            const bundle = bundles[0];
            expect(bundle.downloadUrl.startsWith('file://'), 'Bundle URL should start with file://').toBeTruthy();
            
            // Download should work with file:// URL
            const buffer = await adapter.downloadBundle(bundle);
            expect(buffer.length > 0, 'Should successfully download from file:// URL').toBeTruthy();
        });

        it('should preserve binary data integrity', async () => {
            const adapter = new LocalAdapter(mockSource);
            const bundles = await adapter.fetchBundles();
            
            const bundle = bundles[0];
            
            // Download twice
            const buffer1 = await adapter.downloadBundle(bundle);
            const buffer2 = await adapter.downloadBundle(bundle);
            
            // Both downloads should produce identical buffers
            expect(buffer1.length, 'Buffer lengths should match').toBe(buffer2.length);
            expect(buffer1.equals(buffer2), 'Buffers should be byte-for-byte identical').toBeTruthy();
        });
    });
});
