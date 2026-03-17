/**
 * Hub Profile Activation Commands Tests
 * Integration tests for profile activation UI commands
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubManager } from '../../src/services/HubManager';
import { HubConfig } from '../../src/types/hub';

describe('Hub Profile Activation Commands - Integration', () => {
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
                        required: false
                    }
                ],
                icon: '🎨',
                active: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    });

    beforeEach(() => {
        tempDir = path.join(__dirname, '../../test-temp-hub-activation-commands');
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

    describe('Hub Manager Integration for Activation Commands', () => {
        it('should list hubs for hub picker', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const hubs = await hubManager.listHubs();

            expect(hubs.length).toBe(1);
            expect(hubs[0].name).toBe('Test Hub');
            expect(hubs[0].description).toBe('Test hub');
        });

        it('should list profiles from hub for profile picker', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const profiles = await hubManager.listProfilesFromHub('test-hub');

            expect(profiles.length).toBe(2);
            expect(profiles[0].name).toBe('Profile 1');
            expect(profiles[1].name).toBe('Profile 2');
        });

        it('should get active profile to mark in picker', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const active = await hubManager.getActiveProfile('test-hub');

            expect(active).toBeTruthy();
            expect(active.profileId).toBe('profile-1');
        });

        it('should activate profile from command flow', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            expect(result.success).toBeTruthy();
            expect(result.profileId).toBe('profile-1');

            const active = await hubManager.getActiveProfile('test-hub');
            expect(active).toBeTruthy();
            expect(active.profileId).toBe('profile-1');
        });

        it('should handle activation of non-existent profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'non-existent', { installBundles: false });

            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });
    });

    describe('Deactivation Command Integration', () => {
        it('should list active profiles for deactivation picker', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const activeProfiles = await hubManager.listAllActiveProfiles();

            expect(activeProfiles.length).toBe(1);
            expect(activeProfiles[0].profileId).toBe('profile-1');
        });

        it('should get hub details for active profile display', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const hubDetails = await hubManager.getHub('test-hub');
            const profile = await hubManager.getHubProfile('test-hub', 'profile-1');

            expect(hubDetails).toBeTruthy();
            expect(hubDetails.config.metadata.name).toBe('Test Hub');
            expect(profile.name).toBe('Profile 1');
        });

        it('should deactivate profile from command flow', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const result = await hubManager.deactivateProfile('test-hub', 'profile-1');

            expect(result.success).toBeTruthy();
            expect(result.profileId).toBe('profile-1');

            const active = await hubManager.getActiveProfile('test-hub');
            expect(active).toBe(null);
        });

        it('should return empty list when no profiles active', async () => {
            const activeProfiles = await hubManager.listAllActiveProfiles();
            expect(activeProfiles.length).toBe(0);
        });
    });

    describe('Show Active Profiles Command Integration', () => {
        it('should list only one active profile (enforces single active profile globally)', async () => {
            const hub1 = createTestHub();
            const hub2 = createTestHub();
            await storage.saveHub('hub-1', hub1, { type: 'github', location: 'test/repo1' });
            await storage.saveHub('hub-2', hub2, { type: 'github', location: 'test/repo2' });
            
            await hubManager.activateProfile('hub-1', 'profile-1', { installBundles: false });
            await hubManager.activateProfile('hub-2', 'profile-2', { installBundles: false });

            const activeProfiles = await hubManager.listAllActiveProfiles();

            // Only the last activated profile should be active (single active profile enforcement)
            expect(activeProfiles.length).toBe(1);
            expect(activeProfiles[0].hubId).toBe('hub-2');
            expect(activeProfiles[0].profileId).toBe('profile-2');
        });

        it('should include activation timestamps in active profiles', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            
            const beforeActivation = new Date().getTime();
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            const afterActivation = new Date().getTime();

            const activeProfiles = await hubManager.listAllActiveProfiles();
            
            expect(activeProfiles.length).toBe(1);
            const activatedAt = new Date(activeProfiles[0].activatedAt).getTime();
            expect(activatedAt >= beforeActivation && activatedAt <= afterActivation).toBeTruthy();
        });

        it('should include synced bundle IDs in active profiles', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });

            const activeProfiles = await hubManager.listAllActiveProfiles();
            
            expect(activeProfiles.length).toBe(1);
            expect(Array.isArray(activeProfiles[0].syncedBundles)).toBeTruthy();
            expect(activeProfiles[0].syncedBundles.length).toBe(1);
            expect(activeProfiles[0].syncedBundles[0]).toBe('bundle-1');
        });
    });

    describe('Profile Switching Integration', () => {
        it('should switch between profiles in same hub', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            let active = await hubManager.getActiveProfile('test-hub');
            expect(active?.profileId).toBe('profile-1');

            await hubManager.activateProfile('test-hub', 'profile-2', { installBundles: false });
            active = await hubManager.getActiveProfile('test-hub');
            expect(active?.profileId).toBe('profile-2');
        });

        it('should track different bundle sets when switching', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            
            await hubManager.activateProfile('test-hub', 'profile-1', { installBundles: false });
            let active = await hubManager.getActiveProfile('test-hub');
            expect(active).toBeTruthy();
            expect(active.syncedBundles).toEqual(['bundle-1']);

            await hubManager.activateProfile('test-hub', 'profile-2', { installBundles: false });
            active = await hubManager.getActiveProfile('test-hub');
            expect(active).toBeTruthy();
            expect(active.syncedBundles).toEqual(['bundle-2']);
        });
    });
});
