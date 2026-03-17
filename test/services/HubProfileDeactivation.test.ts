/**
 * Hub Profile Deactivation Tests
 * Tests for deactivating profiles and cleanup
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubManager } from '../../src/services/HubManager';
import { HubConfig } from '../../src/types/hub';

describe('Hub Profile Deactivation', () => {
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
            },
            {
                id: 'profile-2',
                name: 'Profile 2',
                description: 'Second profile',
                bundles: [
                    {
                        id: 'bundle-2',
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
        tempDir = path.join(__dirname, '../../test-temp-hub-deactivation');
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

    describe('Profile Deactivation', () => {
        it('should deactivate profile and remove activation state', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            // Activate profile first
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Deactivate
            const result = await hubManager.deactivateProfile('test-hub', 'profile-1');

            expect(result.success).toBeTruthy();
            expect(result.profileId).toBe('profile-1');

            // Verify activation state removed
            const state = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(state).toBe(null);
        });

        it('should mark profile as inactive in hub config', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            await hubManager.deactivateProfile('test-hub', 'profile-1');

            const updated = await storage.loadHub('test-hub');
            const profile = updated.config.profiles.find(p => p.id === 'profile-1');
            expect(profile?.active).toBe(false);
        });

        it('should handle deactivating non-active profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.deactivateProfile('test-hub', 'profile-1');

            // Should succeed even if profile wasn't active
            expect(result.success).toBeTruthy();
        });

        it('should return failure for non-existent profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.deactivateProfile('test-hub', 'non-existent');

            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });

        it('should return failure for non-existent hub', async () => {
            const result = await hubManager.deactivateProfile('non-existent', 'profile-1');

            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });

    describe('Profile Switching', () => {
        it('should switch from one profile to another', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            // Activate first profile
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            // Switch to second profile
            await hubManager.activateProfile('test-hub', 'profile-2', { installBundles: false });

            // Verify first is deactivated
            const state1 = await storage.getProfileActivationState('test-hub', 'profile-1');
            expect(state1).toBe(null);

            // Verify second is active
            const state2 = await storage.getProfileActivationState('test-hub', 'profile-2');
            expect(state2).toBeTruthy();

            const updated = await storage.loadHub('test-hub');
            const profile1 = updated.config.profiles.find(p => p.id === 'profile-1');
            const profile2 = updated.config.profiles.find(p => p.id === 'profile-2');

            expect(profile1?.active).toBe(false);
            expect(profile2?.active).toBe(true);
        });

        it('should track bundle changes when switching', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            const state1 = await storage.getProfileActivationState('test-hub', 'profile-1');

            await hubManager.activateProfile('test-hub', 'profile-2', { installBundles: false });
            const state2 = await storage.getProfileActivationState('test-hub', 'profile-2');

            // Different profiles should have different bundle lists
            expect(state1).toBeTruthy();
            expect(state2).toBeTruthy();
            expect(state1.syncedBundles).not.toEqual(state2.syncedBundles);
        });
    });

    describe('Get Active Profile', () => {
        it('should get currently active profile for hub', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const active = await hubManager.getActiveProfile('test-hub');

            expect(active).toBeTruthy();
            expect(active.profileId).toBe('profile-1');
            expect(active.hubId).toBe('test-hub');
        });

        it('should return null when no profile is active', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const active = await hubManager.getActiveProfile('test-hub');

            expect(active).toBe(null);
        });

        it('should return null for non-existent hub', async () => {
            const active = await hubManager.getActiveProfile('non-existent');
            expect(active).toBe(null);
        });
    });

    describe('List All Active Profiles', () => {
        it('should list all active profiles across all hubs', async () => {
            const hub1 = createTestHub();
            const hub2 = createTestHub();
            await storage.saveHub('hub-1', hub1, { type: 'github', location: 'test/repo1' });
            await storage.saveHub('hub-2', hub2, { type: 'github', location: 'test/repo2' });

            await hubManager.activateProfile('hub-1', 'profile-1', { installBundles: false });
            await hubManager.activateProfile('hub-2', 'profile-1', { installBundles: false });

            const active = await hubManager.listAllActiveProfiles();

            expect(active.length).toBe(2);
            expect(active.some(p => p.hubId === 'hub-1')).toBeTruthy();
            expect(active.some(p => p.hubId === 'hub-2')).toBeTruthy();
        });

        it('should return empty array when no profiles are active', async () => {
            const active = await hubManager.listAllActiveProfiles();
            expect(active.length).toBe(0);
        });

        it('should update list after deactivation', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            let active = await hubManager.listAllActiveProfiles();
            expect(active.length).toBe(1);

            await hubManager.deactivateProfile('test-hub', 'profile-1');
            active = await hubManager.listAllActiveProfiles();
            expect(active.length).toBe(0);
        });
    });

    describe('Deactivation Result', () => {
        it('should return deactivation result with profile info', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            const result = await hubManager.deactivateProfile('test-hub', 'profile-1');

            expect(result.success).toBeTruthy();
            expect(result.hubId).toBe('test-hub');
            expect(result.profileId).toBe('profile-1');
        });

        it('should include bundle IDs that were removed', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            const result = await hubManager.deactivateProfile('test-hub', 'profile-1');

            expect(result.success).toBeTruthy();
            expect(result.removedBundles).toBeTruthy();
            expect(Array.isArray(result.removedBundles)).toBeTruthy();
        });
    });
});
