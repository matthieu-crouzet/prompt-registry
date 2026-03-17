/**
 * Hub Manual Sync Detection Tests
 * Tests for detecting profile changes and conflicts
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubManager } from '../../src/services/HubManager';
import { HubConfig, HubProfile } from '../../src/types/hub';

describe('Hub Manual Sync Detection', () => {
    let storage: HubStorage;
    let hubManager: HubManager;
    let tempDir: string;

    const createTestHub = (): HubConfig => ({
        version: '1.0.0',
        metadata: {
            name: 'Test Hub',
            description: 'Test hub',
            maintainer: 'Test',
            updatedAt: new Date().toISOString()
        },
        sources: [
            {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'github:test/repo',
                enabled: true,
                priority: 1,
                metadata: {
                    description: 'Test source'
                }
            }
        ],
        profiles: [
            {
                id: 'profile-1',
                name: 'Profile 1',
                description: 'First profile',
                bundles: [
                    {
                        id: 'bundle-1',
                        version: '1.0.0',
                        source: 'test-source',
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
        tempDir = path.join(__dirname, '../../test-temp-hub-manual-sync');
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

    describe('Profile Change Detection', () => {
        it('should detect when active profile has changed in hub', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Modify the hub's profile
            // Add small delay to ensure updatedAt > activatedAt (timestamp precision issue)
            await new Promise(resolve => setTimeout(resolve, 10));
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].description = 'Updated description';
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const hasChanges = await hubManager.hasProfileChanges('test-hub', 'profile-1');
            expect(hasChanges).toBe(true);
        });

        it('should return false when profile has not changed', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const hasChanges = await hubManager.hasProfileChanges('test-hub', 'profile-1');
            expect(hasChanges).toBe(false);
        });

        it('should detect bundle additions', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Add a bundle
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const changes = await hubManager.getProfileChanges('test-hub', 'profile-1');
            expect(changes).toBeTruthy();
            expect(changes.bundlesAdded).toBeTruthy();
            expect(changes.bundlesAdded.length).toBe(1);
            expect(changes.bundlesAdded[0].id).toBe('bundle-2');
        });

        it('should detect bundle removals', async () => {
            const hub = createTestHub();
            hub.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Remove a bundle
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles = updated.config.profiles[0].bundles.filter(b => b.id !== 'bundle-2');
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const changes = await hubManager.getProfileChanges('test-hub', 'profile-1');
            expect(changes).toBeTruthy();
            expect(changes.bundlesRemoved).toBeTruthy();
            expect(changes.bundlesRemoved.length).toBe(1);
            expect(changes.bundlesRemoved[0]).toBe('bundle-2');
        });

        it('should detect bundle version changes', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Update bundle version
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles[0].version = '2.0.0';
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const changes = await hubManager.getProfileChanges('test-hub', 'profile-1');
            expect(changes).toBeTruthy();
            expect(changes.bundlesUpdated).toBeTruthy();
            expect(changes.bundlesUpdated.length).toBe(1);
            expect(changes.bundlesUpdated[0].id).toBe('bundle-1');
            expect(changes.bundlesUpdated[0].oldVersion).toBe('1.0.0');
            expect(changes.bundlesUpdated[0].newVersion).toBe('2.0.0');
        });

        it('should detect metadata changes', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            // Update metadata
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].name = 'Updated Name';
            updated.config.profiles[0].description = 'Updated Description';
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const changes = await hubManager.getProfileChanges('test-hub', 'profile-1');
            expect(changes).toBeTruthy();
            expect(changes.metadataChanged).toBeTruthy();
            expect(changes.metadataChanged.name).toBe(true);
            expect(changes.metadataChanged.description).toBe(true);
        });
    });

    describe('Last Sync Tracking', () => {
        it('should track last sync timestamp', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            
            const beforeSync = new Date().getTime();
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            const afterSync = new Date().getTime();

            const state = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(state).toBeTruthy();
            const syncTime = new Date(state.activatedAt).getTime();
            expect(syncTime >= beforeSync && syncTime <= afterSync).toBeTruthy();
        });

        it('should update last sync on profile sync', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const state1 = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(state1).toBeTruthy();
            const firstSync = new Date(state1.activatedAt).getTime();

            // Wait a bit and sync again
            await new Promise(resolve => setTimeout(resolve, 10));
            await hubManager.syncProfile('test-hub', 'profile-1');

            const state2 = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(state2).toBeTruthy();
            const secondSync = new Date(state2.activatedAt).getTime();

            expect(secondSync > firstSync).toBeTruthy();
        });

        it('should get time since last sync', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            await new Promise(resolve => setTimeout(resolve, 100));

            const timeSince = await hubManager.getTimeSinceLastSync('test-hub', 'profile-1');
            expect(timeSince).toBeTruthy();
            expect(timeSince >= 100).toBeTruthy();
        });

        it('should return null for time since last sync when not activated', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const timeSince = await hubManager.getTimeSinceLastSync('test-hub', 'profile-1');
            expect(timeSince).toBe(null);
        });
    });

    describe('Hub Update Detection', () => {
        it('should detect when hub config has been updated', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Update profile metadata
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const hasUpdates = await hubManager.hasHubUpdates('test-hub');
            expect(hasUpdates).toBe(true);
        });

        it('should return false when hub has not been updated', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const hasUpdates = await hubManager.hasHubUpdates('test-hub');
            expect(hasUpdates).toBe(false);
        });

        it('should list profiles with pending updates', async () => {
            const hub = createTestHub();
            hub.profiles.push({
                id: 'profile-2',
                name: 'Profile 2',
                description: 'Second profile',
                bundles: [],
                icon: '��',
                active: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Update profile-1 in hub
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].description = 'Updated';
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const profilesWithUpdates = await hubManager.getProfilesWithUpdates('test-hub');
            expect(profilesWithUpdates.length).toBe(1);
            expect(profilesWithUpdates[0].profileId).toBe('profile-1');
            expect(profilesWithUpdates[0].hasChanges).toBeTruthy();
        });

        it('should return empty list when no profiles have updates', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const profilesWithUpdates = await hubManager.getProfilesWithUpdates('test-hub');
            expect(profilesWithUpdates.length).toBe(0);
        });
    });

    describe('Change Summary', () => {
        it('should provide comprehensive change summary', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));

            // Make multiple changes
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].name = 'Updated Name';
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            updated.config.profiles[0].bundles[0].version = '2.0.0';
            updated.config.profiles[0].updatedAt = new Date(Date.now() + 1000).toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const changes = await hubManager.getProfileChanges('test-hub', 'profile-1');
            expect(changes).toBeTruthy();
            expect(changes.metadataChanged?.name).toBeTruthy();
            expect(changes.bundlesAdded?.length).toBe(1);
            expect(changes.bundlesUpdated?.length).toBe(1);
        });

        it('should return null when profile is not activated', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const changes = await hubManager.getProfileChanges('test-hub', 'profile-1');
            expect(changes).toBe(null);
        });
    });
});
