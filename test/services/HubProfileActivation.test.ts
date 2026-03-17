/**
 * Hub Profile Activation State Tests
 * Tests for profile activation state management and persistence
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubConfig, ProfileActivationState } from '../../src/types/hub';

describe('Hub Profile Activation State', () => {
    let storage: HubStorage;
    let tempDir: string;

    const createSampleHub = (): HubConfig => ({
        version: '1.0.0',
        metadata: {
            name: 'Test Hub',
            description: 'Test hub for activation',
            maintainer: 'Test',
            updatedAt: new Date().toISOString()
        },
        sources: [
            {
                id: 'source-1',
                name: 'Test Source',
                type: 'github',
                url: 'test/repo',
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
                description: 'Test profile',
                bundles: [
                    {
                        id: 'bundle-1',
                        version: '1.0.0',
                        source: 'source-1',
                        required: true
                    },
                    {
                        id: 'bundle-2',
                        version: '1.0.0',
                        source: 'source-1',
                        required: false
                    }
                ],
                icon: '📦',
                active: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
            {
                id: 'profile-2',
                name: 'Profile 2',
                description: 'Second profile',
                bundles: [],
                icon: '📦',
                active: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    });

    beforeEach(() => {
        tempDir = path.join(__dirname, '../../test-temp-hub-activation');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        storage = new HubStorage(tempDir);
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Activation State Storage', () => {
        it('should save profile activation state', async () => {
            const state: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: ['bundle-1', 'bundle-2']
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state);

            const retrieved = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(retrieved, "Expected activation state to exist").toBeTruthy();
            expect(retrieved.hubId).toBe('test-hub');
            expect(retrieved.profileId).toBe('profile-1');
            expect(retrieved.syncedBundles.length).toBe(2);
        });

        it('should return null for non-existent activation state', async () => {
            const state = await storage.getProfileActivationState('non-existent', 'profile-1');
            expect(state).toBe(null);
        });

        it('should update existing activation state', async () => {
            const state1: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: ['bundle-1']
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state1);

            const state2: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: ['bundle-1', 'bundle-2']
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state2);

            const retrieved = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(retrieved, "Expected activation state to exist").toBeTruthy();
            expect(retrieved.syncedBundles.length).toBe(2);
        });

        it('should delete activation state', async () => {
            const state: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: []
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state);
            await storage.deleteProfileActivationState('test-hub', 'profile-1');

            const retrieved = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(retrieved).toBe(null);
        });
    });

    describe('Active Profile Tracking', () => {
        it('should list all active profiles', async () => {
            const state1: ProfileActivationState = {
                hubId: 'hub-1',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: []
            };

            const state2: ProfileActivationState = {
                hubId: 'hub-2',
                profileId: 'profile-2',
                activatedAt: new Date().toISOString(),
                syncedBundles: []
            };

            await storage.saveProfileActivationState('hub-1', 'profile-1', state1);
            await storage.saveProfileActivationState('hub-2', 'profile-2', state2);

            const active = await storage.listActiveProfiles();
            expect(active.length).toBe(2);
        });

        it('should return empty array when no profiles are active', async () => {
            const active = await storage.listActiveProfiles();
            expect(active.length).toBe(0);
        });

        it('should get active profile for specific hub', async () => {
            const state: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: []
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state);

            const active = await storage.getActiveProfileForHub('test-hub');
            expect(active?.profileId).toBe('profile-1');
        });

        it('should return null when hub has no active profile', async () => {
            const active = await storage.getActiveProfileForHub('test-hub');
            expect(active).toBe(null);
        });
    });

    describe('Profile Active Flag Sync', () => {
        it('should mark profile as active in hub config', async () => {
            const hub = createSampleHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await storage.setProfileActiveFlag('test-hub', 'profile-1', true);

            const updated = await storage.loadHub('test-hub');
            const profile = updated.config.profiles.find(p => p.id === 'profile-1');
            expect(profile?.active).toBe(true);
        });

        it('should mark profile as inactive in hub config', async () => {
            const hub = createSampleHub();
            hub.profiles[0].active = true;
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await storage.setProfileActiveFlag('test-hub', 'profile-1', false);

            const updated = await storage.loadHub('test-hub');
            const profile = updated.config.profiles.find(p => p.id === 'profile-1');
            expect(profile?.active).toBe(false);
        });

        it('should handle multiple profiles in same hub', async () => {
            const hub = createSampleHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await storage.setProfileActiveFlag('test-hub', 'profile-1', true);
            await storage.setProfileActiveFlag('test-hub', 'profile-2', false);

            const updated = await storage.loadHub('test-hub');
            const profile1 = updated.config.profiles.find(p => p.id === 'profile-1');
            const profile2 = updated.config.profiles.find(p => p.id === 'profile-2');
            expect(profile1?.active).toBe(true);
            expect(profile2?.active).toBe(false);
        });

        it('should throw error if profile not found', async () => {
            const hub = createSampleHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await expect(storage.setProfileActiveFlag('test-hub', 'non-existent', true)).rejects.toThrow(/Profile not found/);
        });
    });

    describe('Activation State Persistence', () => {
        it('should persist activation state across storage instances', async () => {
            const state: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: ['bundle-1']
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state);

            // Create new storage instance with same directory
            const storage2 = new HubStorage(tempDir);
            const retrieved = await storage2.getProfileActivationState('test-hub', 'profile-1');

            expect(retrieved, "Expected activation state to exist").toBeTruthy();

            expect(retrieved.hubId).toBe('test-hub');
            expect(retrieved.profileId).toBe('profile-1');
            expect(retrieved.syncedBundles.length).toBe(1);
        });

        it('should persist active flag across storage instances', async () => {
            const hub = createSampleHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await storage.setProfileActiveFlag('test-hub', 'profile-1', true);

            // Create new storage instance
            const storage2 = new HubStorage(tempDir);
            const updated = await storage2.loadHub('test-hub');
            const profile = updated.config.profiles.find(p => p.id === 'profile-1');

            expect(profile?.active).toBe(true);
        });
    });

    describe('Bundle Sync Tracking', () => {
        it('should track synced bundles in activation state', async () => {
            const state: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: ['bundle-1', 'bundle-2', 'bundle-3']
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state);

            const retrieved = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(retrieved, "Expected activation state to exist").toBeTruthy();
            expect(retrieved.syncedBundles).toEqual(['bundle-1', 'bundle-2', 'bundle-3']);
        });

        it('should handle empty synced bundles list', async () => {
            const state: ProfileActivationState = {
                hubId: 'test-hub',
                profileId: 'profile-1',
                activatedAt: new Date().toISOString(),
                syncedBundles: []
            };

            await storage.saveProfileActivationState('test-hub', 'profile-1', state);

            const retrieved = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(retrieved, "Expected activation state to exist").toBeTruthy();
            expect(retrieved.syncedBundles.length).toBe(0);
        });
    });
});
