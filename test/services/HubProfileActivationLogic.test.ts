/**
 * Hub Profile Activation Logic Tests
 * Tests for activating hub profiles and syncing bundles
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubManager } from '../../src/services/HubManager';
import { HubConfig } from '../../src/types/hub';

describe('Hub Profile Activation Logic', () => {
    let storage: HubStorage;
    let hubManager: HubManager;
    let tempDir: string;

    const createTestHub = (): HubConfig => ({
        version: '1.0.0',
        metadata: {
            name: 'Test Hub',
            description: 'Test hub for activation',
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
                id: 'test-profile',
                name: 'Test Profile',
                description: 'Profile for testing',
                bundles: [
                    {
                        id: 'bundle-1',
                        version: '1.0.0',
                        source: 'test-source',
                        required: true
                    },
                    {
                        id: 'bundle-2',
                        version: '1.0.0',
                        source: 'test-source',
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
                name: 'Second Profile',
                description: 'Another profile',
                bundles: [
                    {
                        id: 'bundle-3',
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
        tempDir = path.join(__dirname, '../../test-temp-hub-activation-logic');
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

    describe('Profile Activation', () => {
        it('should activate profile and create activation state', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            // Mock bundle installation (we'll test actual installation separately)
            const result = await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            expect(result.success).toBeTruthy();
            expect(result.profileId).toBe('test-profile');

            // Check activation state was created
            const state = await storage.getProfileActivationState('test-hub', 'test-profile');
            expect(state).toBeTruthy();
            expect(state.hubId).toBe('test-hub');
            expect(state.profileId).toBe('test-profile');
        });

        it('should mark profile as active in hub config', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            const updated = await storage.loadHub('test-hub');
            const profile = updated.config.profiles.find(p => p.id === 'test-profile');
            expect(profile?.active).toBe(true);
        });

        it('should track bundle IDs in activation state', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            const state = await storage.getProfileActivationState('test-hub', 'test-profile');
            expect(state).toBeTruthy();
            // Should track the bundle IDs even if not installed
            expect(Array.isArray(state.syncedBundles)).toBeTruthy();
        });

        it('should return failure for non-existent profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'non-existent', {
                installBundles: false
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error.includes('Profile not found')).toBeTruthy();
        });

        it('should return failure for non-existent hub', async () => {
            const result = await hubManager.activateProfile('non-existent', 'test-profile', {
                installBundles: false
            });

            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
            expect(result.error.includes('Hub not found')).toBeTruthy();
        });
    });

    describe('Multiple Profile Activation', () => {
        it('should allow only one active profile per hub', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            // Activate first profile
            await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            // Activate second profile should deactivate first
            await hubManager.activateProfile('test-hub', 'profile-2', {
                installBundles: false
            });

            // Check that only profile-2 is active
            const updated = await storage.loadHub('test-hub');
            const profile1 = updated.config.profiles.find(p => p.id === 'test-profile');
            const profile2 = updated.config.profiles.find(p => p.id === 'profile-2');

            expect(profile1?.active).toBe(false);
            expect(profile2?.active).toBe(true);

            // Check activation states
            const state1 = await storage.getProfileActivationState('test-hub', 'test-profile');
            const state2 = await storage.getProfileActivationState('test-hub', 'profile-2');

            expect(state1).toBe(null);
            expect(state2).toBeTruthy();
        });

        it('should allow multiple profiles from different hubs', async () => {
            const hub1 = createTestHub();
            const hub2 = createTestHub();
            await storage.saveHub('hub-1', hub1, { type: 'github', location: 'test/repo1' });
            await storage.saveHub('hub-2', hub2, { type: 'github', location: 'test/repo2' });

            await hubManager.activateProfile('hub-1', 'test-profile', {
                installBundles: false
            });
            await hubManager.activateProfile('hub-2', 'test-profile', {
                installBundles: false
            });

            const states = await storage.listActiveProfiles();
            expect(states.length).toBe(2);
        });
    });

    describe('Activation Options', () => {
        it('should respect installBundles option', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result1 = await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            expect(result1.success).toBeTruthy();
            // When installBundles is false, bundles should not be installed
        });

        it('should handle activation with bundle resolution', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            expect(result.success).toBeTruthy();
            expect(result.resolvedBundles).toBeTruthy();
            expect(result.resolvedBundles.length).toBe(2);
        });
    });

    describe('Activation State Management', () => {
        it('should include activation timestamp', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const beforeActivation = new Date();
            await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            const state = await storage.getProfileActivationState('test-hub', 'test-profile');
            expect(state).toBeTruthy();

            const activatedAt = new Date(state.activatedAt);
            expect(activatedAt >= beforeActivation).toBeTruthy();
        });

        it('should list all synced bundle IDs', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            const state = await storage.getProfileActivationState('test-hub', 'test-profile');
            expect(state).toBeTruthy();
            expect(Array.isArray(state.syncedBundles)).toBeTruthy();
        });
    });

    describe('Activation Result', () => {
        it('should return activation result with profile info', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            expect(result.success).toBeTruthy();
            expect(result.hubId).toBe('test-hub');
            expect(result.profileId).toBe('test-profile');
            expect(result.resolvedBundles).toBeTruthy();
        });

        it('should include resolved bundles in result', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            expect(result.resolvedBundles).toBeTruthy();
            expect(result.resolvedBundles.length).toBe(2);
            expect(result.resolvedBundles[0].bundle).toBeTruthy();
            // URL is no longer populated by resolveProfileBundles
        });
    });

    describe('Error Recovery', () => {
        it('should cleanup on activation failure', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            // Try to activate with invalid hub that should fail
            const result = await hubManager.activateProfile('non-existent-hub', 'test-profile', {
                installBundles: false
            });

            expect(result.success).toBe(false);

            // Verify no activation state was created
            const state = await storage.getProfileActivationState('non-existent-hub', 'test-profile');
            expect(state).toBe(null);
        });

        it('should handle profile with no bundles', async () => {
            const hub = createTestHub();
            hub.profiles[0].bundles = [];
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            expect(result.success).toBeTruthy();
            expect(result.resolvedBundles.length).toBe(0);
        });
    });

    describe('Required Bundles', () => {
        it('should track required vs optional bundles', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await hubManager.activateProfile('test-hub', 'test-profile', {
                installBundles: false
            });

            const required = result.resolvedBundles.filter(b => b.bundle.required);
            const optional = result.resolvedBundles.filter(b => !b.bundle.required);

            expect(required.length).toBe(1);
            expect(optional.length).toBe(1);
        });
    });
});
