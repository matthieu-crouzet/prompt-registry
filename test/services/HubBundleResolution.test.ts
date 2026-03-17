/**
 * Hub Bundle Resolution Tests
 * Tests for resolving bundle references to downloadable sources
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubManager } from '../../src/services/HubManager';
import { HubConfig } from '../../src/types/hub';

describe('Hub Bundle Resolution', () => {
    let storage: HubStorage;
    let hubManager: HubManager;
    let tempDir: string;

    const createHubWithSources = (): HubConfig => ({
        version: '1.0.0',
        metadata: {
            name: 'Test Hub',
            description: 'Test hub with sources',
            maintainer: 'Test',
            updatedAt: new Date().toISOString()
        },
        sources: [
            {
                id: 'github-source',
                name: 'GitHub Source',
                type: 'github',
                url: 'github:test/repo',
                enabled: true,
                priority: 1,
                metadata: {
                    description: 'GitHub bundle source'
                }
            },
            {
                id: 'url-source',
                name: 'URL Source',
                type: 'http',
                url: 'https://example.com/bundles',
                enabled: true,
                priority: 2,
                metadata: {
                    description: 'Direct URL source'
                }
            }
        ],
        profiles: [
            {
                id: 'test-profile',
                name: 'Test Profile',
                description: 'Profile with bundles',
                bundles: [
                    {
                        id: 'bundle-1',
                        version: '1.0.0',
                        source: 'github-source',
                        required: true
                    },
                    {
                        id: 'bundle-2',
                        version: '2.0.0',
                        source: 'url-source',
                        required: false
                    },
                    {
                        id: 'bundle-3',
                        version: 'latest',
                        source: 'github-source',
                        required: true
                    }
                ],
                icon: '📦',
                active: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    });

    beforeEach(() => {
        tempDir = path.join(__dirname, '../../test-temp-hub-bundle-resolution');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        storage = new HubStorage(tempDir);
        hubManager = new HubManager(storage, {} as any, process.cwd(), undefined, undefined);
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Source Resolution', () => {
        it('should resolve source by ID', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const source = await hubManager.resolveSource('test-hub', 'github-source');

            expect(source).toBeTruthy();
            expect(source.id).toBe('github-source');
            expect(source.type).toBe('github');
            expect(source.url).toBe('github:test/repo');
        });

        it('should throw error for non-existent source', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            await expect(hubManager.resolveSource('test-hub', 'non-existent')).rejects.toThrow(/Source not found/);
        });

        it('should handle disabled sources', async () => {
            const hub = createHubWithSources();
            hub.sources[0].enabled = false;
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const source = await hubManager.resolveSource('test-hub', 'github-source');
            expect(source.enabled).toBe(false);
        });
    });

    describe('Bundle URL Resolution', () => {
        it('should resolve GitHub bundle URL', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const url = await hubManager.resolveBundleUrl('test-hub', {
                id: 'bundle-1',
                version: '1.0.0',
                source: 'github-source',
                required: true
            });

            expect(url).toBeTruthy();
            expect(url.includes('bundle-1')).toBeTruthy();
        });

        it('should resolve URL source bundle URL', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const url = await hubManager.resolveBundleUrl('test-hub', {
                id: 'bundle-2',
                version: '2.0.0',
                source: 'url-source',
                required: false
            });

            expect(url).toBeTruthy();
            expect(url.includes('bundle-2')).toBeTruthy();
        });

        it('should handle latest version', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const url = await hubManager.resolveBundleUrl('test-hub', {
                id: 'bundle-3',
                version: 'latest',
                source: 'github-source',
                required: true
            });

            expect(url).toBeTruthy();
            // Latest should resolve to a valid URL
        });

        it('should throw error for invalid source in bundle', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            await expect(hubManager.resolveBundleUrl('test-hub', {
                    id: 'bundle-x',
                    version: '1.0.0',
                    source: 'non-existent-source',
                    required: true
                })).rejects.toThrow(/Source not found/);
        });
    });

    describe('Profile Bundle Resolution', () => {
        it('should resolve all bundles in profile', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const resolved = await hubManager.resolveProfileBundles('test-hub', 'test-profile');

            expect(resolved.length).toBe(3);
            // URL is no longer populated by resolveProfileBundles
            expect(resolved.every(b => b.bundle)).toBeTruthy();
        });

        it('should include bundle metadata in resolution', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const resolved = await hubManager.resolveProfileBundles('test-hub', 'test-profile');

            const bundle1 = resolved.find(r => r.bundle.id === 'bundle-1');
            expect(bundle1).toBeTruthy();
            expect(bundle1.bundle.version).toBe('1.0.0');
            expect(bundle1.bundle.required).toBe(true);
            expect(bundle1.bundle.source).toBe('github-source');
        });

        it('should handle profile with no bundles', async () => {
            const hub = createHubWithSources();
            hub.profiles[0].bundles = [];
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const resolved = await hubManager.resolveProfileBundles('test-hub', 'test-profile');

            expect(resolved.length).toBe(0);
        });

        it('should throw error for non-existent profile', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            await expect(hubManager.resolveProfileBundles('test-hub', 'non-existent')).rejects.toThrow(/Profile not found/);
        });
    });

    describe('Required vs Optional Bundles', () => {
        it('should identify required bundles', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const resolved = await hubManager.resolveProfileBundles('test-hub', 'test-profile');
            const required = resolved.filter(r => r.bundle.required);

            expect(required.length).toBe(2);
            expect(required.some(r => r.bundle.id === 'bundle-1')).toBeTruthy();
            expect(required.some(r => r.bundle.id === 'bundle-3')).toBeTruthy();
        });

        it('should identify optional bundles', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const resolved = await hubManager.resolveProfileBundles('test-hub', 'test-profile');
            const optional = resolved.filter(r => !r.bundle.required);

            expect(optional.length).toBe(1);
            expect(optional[0].bundle.id).toBe('bundle-2');
        });
    });

    describe('Source Priority', () => {
        it('should include source priority in resolution', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const resolved = await hubManager.resolveProfileBundles('test-hub', 'test-profile');

            // Check that source priority is accessible
            const bundle1 = resolved.find(r => r.bundle.id === 'bundle-1');
            expect(bundle1).toBeTruthy();
            
            const source1 = await hubManager.resolveSource('test-hub', bundle1.bundle.source);
            expect(source1.priority).toBe(1);
        });

        it('should handle multiple sources with different priorities', async () => {
            const hub = createHubWithSources();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            const source1 = await hubManager.resolveSource('test-hub', 'github-source');
            const source2 = await hubManager.resolveSource('test-hub', 'url-source');

            expect(source1.priority).toBe(1);
            expect(source2.priority).toBe(2);
            expect(source2.priority > source1.priority).toBeTruthy();
        });
    });

    describe('Bundle Resolution Error Handling', () => {
        it('should handle disabled source gracefully', async () => {
            const hub = createHubWithSources();
            hub.sources[0].enabled = false;
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            // Should still resolve but mark source as disabled
            const source = await hubManager.resolveSource('test-hub', 'github-source');
            expect(source.enabled).toBe(false);
        });

        it('should resolve bundles even with missing source reference', async () => {
            const hub = createHubWithSources();
            hub.profiles[0].bundles[0].source = 'missing-source';
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/hub' });

            // resolveProfileBundles no longer validates sources - that happens during installation
            const resolved = await hubManager.resolveProfileBundles('test-hub', 'test-profile');
            expect(resolved.length > 0).toBeTruthy();
            expect(resolved[0].bundle.source).toBe('missing-source');
        });
    });
});
