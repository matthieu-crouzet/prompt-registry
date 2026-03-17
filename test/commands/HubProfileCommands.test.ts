/**
 * HubProfileCommands Unit Tests
 * Tests for hub profile command logic and data transformations
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubManager } from '../../src/services/HubManager';
import { HubConfig } from '../../src/types/hub';

describe('HubProfileCommands - Logic Tests', () => {
    let storage: HubStorage;
    let hubManager: HubManager;
    let tempDir: string;

    const createSampleHub = (hubId: string, profileCount: number): HubConfig => ({
        version: '1.0.0',
        metadata: {
            name: `Test Hub ${hubId}`,
            description: `Test hub with ${profileCount} profiles`,
            maintainer: 'Test',
            updatedAt: new Date().toISOString()
        },
        sources: [],
        profiles: Array.from({ length: profileCount }, (_, i) => ({
            id: `profile-${i + 1}`,
            name: `Profile ${i + 1}`,
            description: `Test profile ${i + 1}`,
            bundles: [
                {
                    id: `bundle-${i + 1}`,
                    version: '1.0.0',
                    source: 'test-source',
                    required: i % 2 === 0
                }
            ],
            icon: '📦',
            active: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }))
    });

    beforeEach(() => {
        tempDir = path.join(__dirname, '../../test-temp-hub-profile-commands');
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

    describe('Profile Data Retrieval', () => {
        it('should retrieve all profiles from multiple hubs', async () => {
            await storage.saveHub('hub-1', createSampleHub('1', 2), { type: 'github', location: 'test/hub1' });
            await storage.saveHub('hub-2', createSampleHub('2', 3), { type: 'github', location: 'test/hub2' });

            const profiles = await hubManager.listAllHubProfiles();

            expect(profiles.length).toBe(5);
            expect(profiles.filter(p => p.hubId === 'hub-1').length).toBe(2);
            expect(profiles.filter(p => p.hubId === 'hub-2').length).toBe(3);
        });

        it('should include hub metadata with profiles', async () => {
            await storage.saveHub('test-hub', createSampleHub('test', 1), { type: 'github', location: 'test/hub' });

            const profiles = await hubManager.listAllHubProfiles();

            expect(profiles.length).toBe(1);
            expect(profiles[0].hubId).toBe('test-hub');
            expect(profiles[0].hubName).toBe('Test Hub test');
        });

        it('should return empty array when no hubs exist', async () => {
            const profiles = await hubManager.listAllHubProfiles();
            expect(profiles.length).toBe(0);
        });

        it('should handle hubs without profiles', async () => {
            const emptyHub: HubConfig = {
                version: '1.0.0',
                metadata: {
                    name: 'Empty Hub',
                    description: 'No profiles',
                    maintainer: 'Test',
                    updatedAt: new Date().toISOString()
                },
                sources: [],
                profiles: []
            };

            await storage.saveHub('empty-hub', emptyHub, { type: 'github', location: 'test/empty' });
            const profiles = await hubManager.listAllHubProfiles();

            expect(profiles.length).toBe(0);
        });
    });

    describe('Profile Grouping Logic', () => {
        it('should group profiles by hub correctly', async () => {
            await storage.saveHub('hub-a', createSampleHub('A', 2), { type: 'github', location: 'test/a' });
            await storage.saveHub('hub-b', createSampleHub('B', 2), { type: 'github', location: 'test/b' });

            const profiles = await hubManager.listAllHubProfiles();

            // Group by hubId
            const grouped = new Map<string, typeof profiles>();
            for (const profile of profiles) {
                if (!grouped.has(profile.hubId)) {
                    grouped.set(profile.hubId, []);
                }
                grouped.get(profile.hubId)!.push(profile);
            }

            expect(grouped.size).toBe(2);
            expect(grouped.get('hub-a')?.length).toBe(2);
            expect(grouped.get('hub-b')?.length).toBe(2);
        });

        it('should maintain profile order within hub', async () => {
            await storage.saveHub('ordered-hub', createSampleHub('ordered', 5), { type: 'github', location: 'test/ordered' });

            const profiles = await hubManager.listAllHubProfiles();

            expect(profiles.length).toBe(5);
            for (let i = 0; i < 5; i++) {
                expect(profiles[i].id).toBe(`profile-${i + 1}`);
            }
        });
    });

    describe('Profile Detail Access', () => {
        it('should retrieve specific profile with all details', async () => {
            await storage.saveHub('detail-hub', createSampleHub('detail', 3), { type: 'github', location: 'test/detail' });

            const profile = await hubManager.getHubProfile('detail-hub', 'profile-2');

            expect(profile.id).toBe('profile-2');
            expect(profile.name).toBe('Profile 2');
            expect(profile.bundles.length > 0).toBeTruthy();
            expect(profile.bundles[0].id).toBe('bundle-2');
        });

        it('should include bundle metadata in profile', async () => {
            await storage.saveHub('bundle-hub', createSampleHub('bundle', 1), { type: 'github', location: 'test/bundle' });

            const profile = await hubManager.getHubProfile('bundle-hub', 'profile-1');

            expect(profile.bundles.length).toBe(1);
            expect(profile.bundles[0].id).toBeTruthy();
            expect(profile.bundles[0].version).toBeTruthy();
            expect(profile.bundles[0].source).toBeTruthy();
            expect(typeof profile.bundles[0].required).toBe('boolean');
        });

        it('should handle profile with no bundles', async () => {
            const noBundlesHub: HubConfig = {
                version: '1.0.0',
                metadata: {
                    name: 'No Bundles Hub',
                    description: 'Profile without bundles',
                    maintainer: 'Test',
                    updatedAt: new Date().toISOString()
                },
                sources: [],
                profiles: [{
                    id: 'empty-profile',
                    name: 'Empty Profile',
                    description: 'No bundles',
                    bundles: [],
                    icon: '',
                    active: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }]
            };

            await storage.saveHub('no-bundles', noBundlesHub, { type: 'github', location: 'test/nobundles' });
            const profile = await hubManager.getHubProfile('no-bundles', 'empty-profile');

            expect(profile.bundles.length).toBe(0);
        });
    });

    describe('Profile Filtering and Search', () => {
        it('should filter profiles by hub', async () => {
            await storage.saveHub('hub-1', createSampleHub('1', 3), { type: 'github', location: 'test/1' });
            await storage.saveHub('hub-2', createSampleHub('2', 2), { type: 'github', location: 'test/2' });

            const hub1Profiles = await hubManager.listProfilesFromHub('hub-1');
            const hub2Profiles = await hubManager.listProfilesFromHub('hub-2');

            expect(hub1Profiles.length).toBe(3);
            expect(hub2Profiles.length).toBe(2);
        });

        it('should find profiles with specific characteristics', async () => {
            await storage.saveHub('test-hub', createSampleHub('test', 4), { type: 'github', location: 'test/hub' });

            const profiles = await hubManager.listProfilesFromHub('test-hub');

            // Find profiles with required bundles (created with i % 2 === 0)
            const withRequired = profiles.filter(p => 
                p.bundles.some(b => b.required)
            );

            expect(withRequired.length).toBe(2); // profiles 1 and 3 (0-indexed 0 and 2)
        });
    });

    describe('Hub List Access', () => {
        it('should retrieve hub list for browsing', async () => {
            await storage.saveHub('hub-1', createSampleHub('1', 1), { type: 'github', location: 'test/1' });
            await storage.saveHub('hub-2', createSampleHub('2', 1), { type: 'url', location: 'https://test.com' });

            const hubs = await hubManager.listHubs();

            expect(hubs.length).toBe(2);
            expect(hubs.every(h => h.id && h.name && h.description)).toBeTruthy();
        });

        it('should include reference information in hub list', async () => {
            await storage.saveHub('test-hub', createSampleHub('test', 1), { type: 'local', location: '/path/to/hub' });

            const hubs = await hubManager.listHubs();

            expect(hubs.length).toBe(1);
            expect(hubs[0].reference.type).toBe('local');
            expect(hubs[0].reference.location).toBe('/path/to/hub');
        });
    });

    describe('Profile Metadata Validation', () => {
        it('should have all required profile fields', async () => {
            await storage.saveHub('valid-hub', createSampleHub('valid', 1), { type: 'github', location: 'test/valid' });

            const profile = await hubManager.getHubProfile('valid-hub', 'profile-1');

            expect(profile.id).toBeTruthy();
            expect(profile.name).toBeTruthy();
            expect(profile.description).toBeTruthy();
            expect(Array.isArray(profile.bundles)).toBeTruthy();
            expect(typeof profile.active).toBe('boolean');
        });

        it('should preserve profile icons', async () => {
            await storage.saveHub('icon-hub', createSampleHub('icon', 1), { type: 'github', location: 'test/icon' });

            const profile = await hubManager.getHubProfile('icon-hub', 'profile-1');

            expect(profile.icon).toBe('📦');
        });

        it('should include timestamps in profiles', async () => {
            await storage.saveHub('time-hub', createSampleHub('time', 1), { type: 'github', location: 'test/time' });

            const profile = await hubManager.getHubProfile('time-hub', 'profile-1');

            expect(profile.createdAt).toBeTruthy();
            expect(profile.updatedAt).toBeTruthy();
        });
    });

    describe('Error Handling', () => {
        it('should handle non-existent hub gracefully', async () => {
            await expect(hubManager.listProfilesFromHub('non-existent')).rejects.toThrow(/Hub not found/);
        });

        it('should handle non-existent profile gracefully', async () => {
            await storage.saveHub('test-hub', createSampleHub('test', 1), { type: 'github', location: 'test/hub' });

            await expect(hubManager.getHubProfile('test-hub', 'non-existent')).rejects.toThrow(/Profile not found/);
        });
    });
});
