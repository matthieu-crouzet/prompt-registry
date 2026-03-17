/**
 * HubManager Profile Methods Unit Tests
 * Tests for hub profile operations
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubManager } from '../../src/services/HubManager';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubConfig } from '../../src/types/hub';

describe('HubManager - Profile Methods', () => {
    let hubManager: HubManager;
    let storage: HubStorage;
    let tempDir: string;

    const sampleHubConfig: HubConfig = {
        version: '1.0.0',
        metadata: {
            name: 'Test Hub with Profiles',
            description: 'Hub for testing profile methods',
            maintainer: 'Test',
            updatedAt: new Date().toISOString()
        },
        sources: [],
        profiles: [
            {
                id: 'profile-1',
                name: 'Profile 1',
                description: 'First test profile',
                bundles: [
                    {
                        id: 'bundle-1',
                        version: '1.0.0',
                        source: 'test-source',
                        required: false
                    }
                ],
                icon: '',
                active: false,
                createdAt: '',
                updatedAt: ''
            },
            {
                id: 'profile-2',
                name: 'Profile 2',
                description: 'Second test profile',
                bundles: [
                    {
                        id: 'bundle-2',
                        version: '2.0.0',
                        source: 'test-source',
                        required: false
                    },
                    {
                        id: 'bundle-3',
                        version: '1.5.0',
                        source: 'test-source',
                        required: false
                    }
                ],
                icon: '',
                active: false,
                createdAt: '',
                updatedAt: ''
            }
        ]
    };

    beforeEach(() => {
        tempDir = path.join(__dirname, '../../test-temp-profiles');
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

    describe('listProfilesFromHub', () => {
        it('should return empty array for hub without profiles', async () => {
            const hubConfig: HubConfig = {
                version: '1.0.0',
                metadata: {
                    name: 'No Profiles Hub',
                    description: 'Hub without profiles',
                    maintainer: 'Test',
                    updatedAt: new Date().toISOString()
                },
                sources: [],
                profiles: []
            };

            await storage.saveHub('no-profiles', hubConfig, { type: 'github', location: 'test/no-profiles' });
            const profiles = await hubManager.listProfilesFromHub('no-profiles');

            expect(profiles.length).toBe(0);
        });

        it('should return all profiles from hub', async () => {
            await storage.saveHub('test-hub-profiles', sampleHubConfig, { type: 'github', location: 'test/repo' });
            const profiles = await hubManager.listProfilesFromHub('test-hub-profiles');

            expect(profiles.length).toBe(2);
            expect(profiles[0].id).toBe('profile-1');
            expect(profiles[0].name).toBe('Profile 1');
            expect(profiles[1].id).toBe('profile-2');
            expect(profiles[1].name).toBe('Profile 2');
        });

        it('should throw error for non-existent hub', async () => {
            await expect(hubManager.listProfilesFromHub('non-existent')).rejects.toThrow(/Hub not found/);
        });
    });

    describe('getHubProfile', () => {
        it('should return specific profile from hub', async () => {
            await storage.saveHub('test-hub-profiles', sampleHubConfig, { type: 'github', location: 'test/repo' });
            const profile = await hubManager.getHubProfile('test-hub-profiles', 'profile-2');

            expect(profile.id).toBe('profile-2');
            expect(profile.name).toBe('Profile 2');
            expect(profile.bundles.length).toBe(2);
        });

        it('should throw error for non-existent hub', async () => {
            await expect(hubManager.getHubProfile('non-existent', 'profile-1')).rejects.toThrow(/Hub not found/);
        });

        it('should throw error for non-existent profile', async () => {
            await storage.saveHub('test-hub-profiles', sampleHubConfig, { type: 'github', location: 'test/repo' });
            await expect(hubManager.getHubProfile('test-hub-profiles', 'non-existent')).rejects.toThrow(/Profile not found/);
        });
    });

    describe('listAllHubProfiles', () => {
        it('should return empty array when no hubs exist', async () => {
            const profiles = await hubManager.listAllHubProfiles();
            expect(profiles.length).toBe(0);
        });

        it('should return profiles from single hub', async () => {
            await storage.saveHub('test-hub-profiles', sampleHubConfig, { type: 'github', location: 'test/repo' });
            const profiles = await hubManager.listAllHubProfiles();

            expect(profiles.length).toBe(2);
            expect(profiles.every(p => p.hubId === 'test-hub-profiles')).toBeTruthy();
        });

        it('should return profiles from multiple hubs', async () => {
            await storage.saveHub('test-hub-profiles', sampleHubConfig, { type: 'github', location: 'test/repo' });

            const anotherConfig: HubConfig = {
                version: '1.0.0',
                metadata: {
                    name: 'Another Hub',
                    description: 'Another test hub',
                    maintainer: 'Test',
                    updatedAt: new Date().toISOString()
                },
                sources: [],
                profiles: [
                    {
                        id: 'profile-3',
                        name: 'Profile 3',
                        description: 'Third profile',
                        bundles: [],
                        icon: '',
                        active: false,
                        createdAt: '',
                        updatedAt: ''
                    }
                ]
            };

            await storage.saveHub('another-hub', anotherConfig, { type: 'github', location: 'test/another' });
            const profiles = await hubManager.listAllHubProfiles();

            expect(profiles.length).toBe(3);
        });

        it('should include hub information with profiles', async () => {
            await storage.saveHub('test-hub-profiles', sampleHubConfig, { type: 'github', location: 'test/repo' });
            const profiles = await hubManager.listAllHubProfiles();

            expect(profiles[0].hubId).toBeTruthy();
            expect(profiles[0].hubName).toBeTruthy();
        });
    });
});
