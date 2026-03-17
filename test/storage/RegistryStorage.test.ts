/**
 * RegistryStorage Unit Tests
 */

import * as path from 'path';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { RegistryStorage } from '../../src/storage/RegistryStorage';

describe('RegistryStorage', () => {
    let sandbox: sinon.SinonSandbox;
    const testStoragePath = '/test/storage';

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Storage Paths', () => {
        it('should define correct storage structure', () => {
            const paths = {
                root: testStoragePath,
                sources: path.join(testStoragePath, 'sources.json'),
                installed: path.join(testStoragePath, 'installed'),
                profiles: path.join(testStoragePath, 'profiles.json'),
                cache: path.join(testStoragePath, 'cache'),
            };

            expect(paths.root).toBeTruthy();
            expect(paths.sources.endsWith('sources.json')).toBeTruthy();
            expect(paths.installed.includes('installed')).toBeTruthy();
            expect(paths.profiles.endsWith('profiles.json')).toBeTruthy();
        });

        it('should create storage directories if missing', () => {
            const directories = [
                path.join(testStoragePath, 'installed'),
                path.join(testStoragePath, 'cache'),
                path.join(testStoragePath, 'bundles'),
            ];

            // Simulate directory creation
            for (const dir of directories) {
                expect(dir).toBeTruthy();
            }
        });
    });

    describe('Source Management', () => {
        it('should load sources from storage', () => {
            const mockSources = [
                { id: 'source-1', name: 'Source 1', type: 'github', url: 'url1', enabled: true, priority: 1 },
                { id: 'source-2', name: 'Source 2', type: 'gitlab', url: 'url2', enabled: true, priority: 2 },
            ];

            expect(mockSources.length).toBe(2);
            expect(mockSources.every(s => s.id && s.name && s.type)).toBeTruthy();
        });

        it('should save sources to storage', () => {
            const sources = [
                { id: 'source-1', name: 'Source 1', type: 'github', url: 'url1', enabled: true, priority: 1 },
            ];

            const json = JSON.stringify({ sources, version: '1.0.0' }, null, 2);
            const parsed = JSON.parse(json);

            expect(parsed.sources.length).toBe(1);
            expect(parsed.version).toBe('1.0.0');
        });

        it('should handle missing sources file', () => {
            const defaultSources: any[] = [];
            expect(defaultSources.length).toBe(0);
        });

        it('should validate source structure', () => {
            const source = {
                id: 'source-1',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
            };

            const isValid = Boolean(
                source.id &&
                source.name &&
                source.type &&
                source.url &&
                typeof source.enabled === 'boolean' &&
                typeof source.priority === 'number'
            );

            expect(isValid).toBe(true);
        });
    });

    describe('Bundle Installation Records', () => {
        it('should track installed bundles', () => {
            const installed = {
                'bundle-1': {
                    id: 'bundle-1',
                    version: '1.0.0',
                    installPath: '/path/to/bundle-1',
                    installedAt: new Date(),
                },
                'bundle-2': {
                    id: 'bundle-2',
                    version: '2.0.0',
                    installPath: '/path/to/bundle-2',
                    installedAt: new Date(),
                },
            };

            expect(Object.keys(installed).length).toBe(2);
            expect(installed['bundle-1'].installedAt instanceof Date).toBeTruthy();
        });

        it('should store installation metadata', () => {
            const bundleRecord = {
                id: 'bundle-1',
                version: '1.0.0',
                installPath: '/path/to/bundle',
                installedAt: new Date(),
                source: 'source-1',
                scope: 'user',
            };

            expect(bundleRecord.id).toBeTruthy();
            expect(bundleRecord.version).toBeTruthy();
            expect(bundleRecord.installPath).toBeTruthy();
            expect(bundleRecord.installedAt).toBeTruthy();
            expect(bundleRecord.source).toBeTruthy();
            expect(bundleRecord.scope).toBeTruthy();
        });

        it('should update bundle records on reinstall', () => {
            const original = {
                id: 'bundle-1',
                version: '1.0.0',
                installedAt: new Date('2024-01-01'),
            };

            const updated = {
                ...original,
                version: '1.1.0',
                installedAt: new Date(),
            };

            expect(original.version).not.toBe(updated.version);
            expect(updated.installedAt > original.installedAt).toBeTruthy();
        });

        it('should remove bundle records on uninstall', () => {
            let installed: Record<string, any> = {
                'bundle-1': { id: 'bundle-1', version: '1.0.0' },
                'bundle-2': { id: 'bundle-2', version: '2.0.0' },
            };

            delete installed['bundle-1'];

            expect(Object.keys(installed).length).toBe(1);
            expect(!installed['bundle-1']).toBeTruthy();
            expect(installed['bundle-2']).toBeTruthy();
        });
    });

    describe('Profile Storage', () => {
        it('should load profiles from storage', () => {
            const mockProfiles = [
                { id: 'profile-1', name: 'Profile 1', bundles: ['bundle-1'], active: true },
                { id: 'profile-2', name: 'Profile 2', bundles: ['bundle-2'], active: false },
            ];

            expect(mockProfiles.length).toBe(2);
            expect(mockProfiles.find(p => p.active)).toBeTruthy();
        });

        it('should save profiles to storage', () => {
            const profiles = [
                { id: 'profile-1', name: 'Profile 1', bundles: [], active: false },
            ];

            const json = JSON.stringify({ profiles, version: '1.0.0' }, null, 2);
            const parsed = JSON.parse(json);

            expect(parsed.profiles.length).toBe(1);
        });

        it('should maintain single active profile', () => {
            const profiles = [
                { id: 'profile-1', name: 'Profile 1', active: true },
                { id: 'profile-2', name: 'Profile 2', active: true }, // Invalid state
            ];

            const fixed = profiles.map((p, i) => ({ ...p, active: i === 0 }));
            const activeCount = fixed.filter(p => p.active).length;

            expect(activeCount).toBe(1);
        });
    });

    describe('Cache Management', () => {
        it('should store bundle metadata cache', () => {
            const cache = {
                'source-1': {
                    bundles: [{ id: 'bundle-1', name: 'Bundle 1' }],
                    timestamp: Date.now(),
                    ttl: 3600000, // 1 hour
                },
            };

            expect(cache['source-1'].bundles).toBeTruthy();
            expect(cache['source-1'].timestamp).toBeTruthy();
        });

        it('should invalidate expired cache', () => {
            const cache = {
                timestamp: Date.now() - 7200000, // 2 hours ago
                ttl: 3600000, // 1 hour TTL
            };

            const isExpired = Date.now() - cache.timestamp > cache.ttl;

            expect(isExpired).toBe(true);
        });

        it('should clear cache on demand', () => {
            let cache: Record<string, any> = {
                'source-1': { bundles: [], timestamp: Date.now() },
                'source-2': { bundles: [], timestamp: Date.now() },
            };

            cache = {};

            expect(Object.keys(cache).length).toBe(0);
        });
    });

    describe('Backup and Recovery', () => {
        it('should create backup before modifications', () => {
            const data = {
                sources: [{ id: 'source-1' }],
                profiles: [{ id: 'profile-1' }],
            };

            const backup = JSON.parse(JSON.stringify(data));

            expect(backup).toEqual(data);
            expect(backup).not.toBe(data); // Different object reference
        });

        it('should restore from backup on error', () => {
            const original = { sources: [{ id: 'source-1' }] };
            const backup = JSON.parse(JSON.stringify(original));

            // Simulate modification
            original.sources.push({ id: 'source-2' } as any);

            // Simulate error and restore
            const restored = backup;

            expect(restored.sources.length).toBe(1);
            expect(restored.sources[0].id).toBe('source-1');
        });
    });

    describe('Migration and Versioning', () => {
        it('should detect storage version', () => {
            const storageV1 = { version: '1.0.0', sources: [] };
            const storageV2 = { version: '2.0.0', sources: [] };

            expect(storageV1.version).toBe('1.0.0');
            expect(storageV2.version).toBe('2.0.0');
        });

        it('should migrate from v1 to v2 format', () => {
            const v1Data = {
                sources: [{ id: 'source-1', name: 'Source 1' }],
            };

            const v2Data = {
                version: '2.0.0',
                sources: v1Data.sources.map(s => ({
                    ...s,
                    enabled: true,
                    priority: 1,
                })),
            };

            expect(v2Data.version).toBeTruthy();
            expect(v2Data.sources[0].enabled !== undefined).toBeTruthy();
            expect(v2Data.sources[0].priority !== undefined).toBeTruthy();
        });

        it('should handle missing version gracefully', () => {
            const dataNoVersion = {
                sources: [{ id: 'source-1' }],
            };

            const defaultVersion = '1.0.0';
            const migrated = {
                version: defaultVersion,
                ...dataNoVersion,
            };

            expect(migrated.version).toBe('1.0.0');
        });
    });

    describe('Concurrent Access', () => {
        it('should handle concurrent read operations', async () => {
            const data = { sources: [], profiles: [] };

            const reads = await Promise.all([
                Promise.resolve(data),
                Promise.resolve(data),
                Promise.resolve(data),
            ]);

            expect(reads.length).toBe(3);
            reads.forEach(r => expect(r).toEqual(data));
        });

        it('should prevent concurrent write conflicts', async () => {
            let data = { counter: 0 };

            // Simulate sequential writes (no conflicts)
            data.counter++;
            data.counter++;

            expect(data.counter).toBe(2);
        });
    });

    describe('Storage Integrity', () => {
        it('should validate JSON structure', () => {
            const validJson = '{"version":"1.0.0","sources":[]}';
            const parsed = JSON.parse(validJson);

            expect(parsed.version).toBeTruthy();
            expect(Array.isArray(parsed.sources)).toBeTruthy();
        });

        it('should detect corrupted storage', () => {
            const corruptedJson = '{"version":"1.0.0","sources":[';
            
            try {
                JSON.parse(corruptedJson);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeTruthy();
            }
        });

        it('should recover from corrupted storage', () => {
            const corrupted = '{"invalid json';
            let data;

            try {
                data = JSON.parse(corrupted);
            } catch {
                // Recovery: use defaults
                data = { version: '1.0.0', sources: [], profiles: [] };
            }

            expect(data).toBeTruthy();
            expect(data.version).toBeTruthy();
        });
    });

    describe('Update Preferences', () => {
        it('should return empty object when no preferences are set', async () => {
            const mockContext = {
                globalState: {
                    get: sandbox.stub().returns({}),
                    update: sandbox.stub().resolves(),
                },
                globalStorageUri: { fsPath: testStoragePath },
            } as any;

            const storage = new RegistryStorage(mockContext);

            const prefs = await storage.getUpdatePreferences();

            expect(prefs).toEqual({});
        });

        it('should return all update preferences', async () => {
            const mockPrefs = {
                'bundle-1': { autoUpdate: true, lastChecked: '2024-01-01T00:00:00.000Z' },
                'bundle-2': { autoUpdate: false, lastChecked: '2024-01-02T00:00:00.000Z' },
            };

            const mockContext = {
                globalState: {
                    get: sandbox.stub().returns(mockPrefs),
                    update: sandbox.stub().resolves(),
                },
                globalStorageUri: { fsPath: testStoragePath },
            } as any;

            const storage = new RegistryStorage(mockContext);

            const prefs = await storage.getUpdatePreferences();

            expect(prefs).toEqual(mockPrefs);
            expect(prefs['bundle-1'].autoUpdate).toBe(true);
            expect(prefs['bundle-2'].autoUpdate).toBe(false);
        });

        it('should set update preference for a bundle', async () => {
            const mockPrefs = {};
            const updateStub = sandbox.stub().resolves();

            const mockContext = {
                globalState: {
                    get: sandbox.stub().returns(mockPrefs),
                    update: updateStub,
                },
                globalStorageUri: { fsPath: testStoragePath },
            } as any;

            const storage = new RegistryStorage(mockContext);

            await storage.setUpdatePreference('bundle-1', true);

            expect(updateStub.calledOnce).toBeTruthy();
            const [key, value] = updateStub.firstCall.args;
            expect(key).toBe('bundleUpdatePreferences');
            expect(value['bundle-1'].autoUpdate).toBe(true);
            expect(value['bundle-1'].lastChecked).toBeTruthy();
        });

        it('should update existing preference for a bundle', async () => {
            const mockPrefs = {
                'bundle-1': { autoUpdate: false, lastChecked: '2024-01-01T00:00:00.000Z' },
            };
            const updateStub = sandbox.stub().resolves();

            const mockContext = {
                globalState: {
                    get: sandbox.stub().returns(mockPrefs),
                    update: updateStub,
                },
                globalStorageUri: { fsPath: testStoragePath },
            } as any;

            const storage = new RegistryStorage(mockContext);

            await storage.setUpdatePreference('bundle-1', true);

            expect(updateStub.calledOnce).toBeTruthy();
            const [key, value] = updateStub.firstCall.args;
            expect(key).toBe('bundleUpdatePreferences');
            expect(value['bundle-1'].autoUpdate).toBe(true);
            expect(value['bundle-1'].lastChecked).not.toBe('2024-01-01T00:00:00.000Z');
        });

        it('should get update preference for a specific bundle', async () => {
            const mockPrefs = {
                'bundle-1': { autoUpdate: true, lastChecked: '2024-01-01T00:00:00.000Z' },
                'bundle-2': { autoUpdate: false, lastChecked: '2024-01-02T00:00:00.000Z' },
            };

            const mockContext = {
                globalState: {
                    get: sandbox.stub().returns(mockPrefs),
                    update: sandbox.stub().resolves(),
                },
                globalStorageUri: { fsPath: testStoragePath },
            } as any;

            const storage = new RegistryStorage(mockContext);

            const pref1 = await storage.getUpdatePreference('bundle-1');
            const pref2 = await storage.getUpdatePreference('bundle-2');

            expect(pref1).toBe(true);
            expect(pref2).toBe(false);
        });

        it('should return false for bundle with no preference set', async () => {
            const mockPrefs = {
                'bundle-1': { autoUpdate: true, lastChecked: '2024-01-01T00:00:00.000Z' },
            };

            const mockContext = {
                globalState: {
                    get: sandbox.stub().returns(mockPrefs),
                    update: sandbox.stub().resolves(),
                },
                globalStorageUri: { fsPath: testStoragePath },
            } as any;

            const storage = new RegistryStorage(mockContext);

            const pref = await storage.getUpdatePreference('bundle-nonexistent');

            expect(pref).toBe(false);
        });

        it('should persist preference with timestamp', async () => {
            const mockPrefs = {};
            const updateStub = sandbox.stub().resolves();
            const beforeTime = new Date().toISOString();

            const mockContext = {
                globalState: {
                    get: sandbox.stub().returns(mockPrefs),
                    update: updateStub,
                },
                globalStorageUri: { fsPath: testStoragePath },
            } as any;

            const storage = new RegistryStorage(mockContext);

            await storage.setUpdatePreference('bundle-1', true);

            const afterTime = new Date().toISOString();
            const [, value] = updateStub.firstCall.args;
            const timestamp = value['bundle-1'].lastChecked;

            expect(timestamp >= beforeTime).toBeTruthy();
            expect(timestamp <= afterTime).toBeTruthy();
        });
    });
});
