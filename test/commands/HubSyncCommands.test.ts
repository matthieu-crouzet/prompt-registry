/**
 * Test Suite: Hub Sync Commands
 * 
 * Tests VS Code commands for manual profile synchronization.
 * Covers checkForUpdates, viewChanges, syncProfile commands.
 */

import * as path from 'path';
import * as fs from 'fs';
import { HubSyncCommands } from '../../src/commands/HubSyncCommands';
import { HubManager } from '../../src/services/HubManager';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubConfig } from '../../src/types/hub';

describe('Hub Sync Commands', () => {
    let storage: HubStorage;
    let hubManager: HubManager;
    let commands: HubSyncCommands;
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
                id: 'test-profile',
                name: 'Test Profile',
                description: 'Test profile',
                icon: '📦',
                bundles: [
                    {
                        id: 'bundle-1',
                        version: '1.0.0',
                        source: 'test-source',
                        required: true
                    }
                ],
                active: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ]
    });

    beforeEach(() => {
        tempDir = path.join(__dirname, '../../test-temp-hub-sync-commands');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        storage = new HubStorage(tempDir);
        hubManager = new HubManager(storage, {} as any, process.cwd(), undefined, undefined);
        commands = new HubSyncCommands(hubManager);
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Check For Updates', () => {
        it('should check for updates on active profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            await new Promise(resolve => setTimeout(resolve, 10));

            // Update profile
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const result = await commands.checkForUpdates('test-hub', 'test-profile');
            expect(result.hasUpdates).toBeTruthy();
            expect(result.changes).toBeTruthy();
        });

        it('should return no updates when profile unchanged', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            const result = await commands.checkForUpdates('test-hub', 'test-profile');
            expect(result.hasUpdates).toBe(false);
        });

        it('should handle non-active profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            const result = await commands.checkForUpdates('test-hub', 'test-profile');
            expect(result.hasUpdates).toBe(false);
            expect(result.message).toBe('Profile is not active');
        });
    });

    describe('View Changes', () => {
        it('should display changes for active profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            await new Promise(resolve => setTimeout(resolve, 10));

            // Update profile
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const result = await commands.viewChanges('test-hub', 'test-profile');
            expect(result).toBeTruthy();
            expect(result.summary).toBeTruthy();
            expect(result.summary.includes('bundle-2')).toBeTruthy();
            expect(result.summary.includes('Added')).toBeTruthy();
        });

        it('should return null for profile with no changes', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            const result = await commands.viewChanges('test-hub', 'test-profile');
            expect(result).toBe(null);
        });
    });

    describe('Sync Profile', () => {
        it('should sync profile and update activation state', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            await new Promise(resolve => setTimeout(resolve, 10));

            // Update profile
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            await storage.saveHub('test-hub', updated.config, updated.reference);

            // Verify changes exist before sync
            const changesBefore = await hubManager.hasProfileChanges('test-hub', 'test-profile');
            expect(changesBefore).toBeTruthy();

            // Sync
            await commands.syncProfile('test-hub', 'test-profile');

            // Verify changes are gone after sync
            const changesAfter = await hubManager.hasProfileChanges('test-hub', 'test-profile');
            expect(changesAfter).toBe(false);
        });

        it('should handle sync for non-active profile', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });

            await expect(async () => await commands.syncProfile('test-hub', 'test-profile')).rejects.toThrow(/not active|not activated/i);
        });
    });

    describe('Review And Sync', () => {
        it('should provide review dialog for changes', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            await new Promise(resolve => setTimeout(resolve, 10));

            // Update profile
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const result = await commands.reviewAndSync('test-hub', 'test-profile');
            expect(result).toBeTruthy();
            expect(result.dialog).toBeTruthy();
            expect(result.dialog.title).toBeTruthy();
            expect(result.dialog.options).toBeTruthy();
            expect(result.dialog.options.length).toBe(3); // Sync, Review, Cancel
        });

        it('should return null when no changes to review', async () => {
            const hub = createTestHub();
            await storage.saveHub('test-hub', hub, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            const result = await commands.reviewAndSync('test-hub', 'test-profile');
            expect(result).toBe(null);
        });
    });

    describe('Check All Hubs For Updates', () => {
        it('should check all hubs for updates', async () => {
            const hub1 = createTestHub();
            await storage.saveHub('hub-1', hub1, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('hub-1', 'test-profile', { installBundles: false });

            const hub2 = createTestHub();
            hub2.profiles[0].id = 'profile-2';
            await storage.saveHub('hub-2', hub2, { type: 'github', location: 'test/repo' });
            await hubManager.activateProfile('hub-2', 'profile-2', { installBundles: false });

            await new Promise(resolve => setTimeout(resolve, 10));

            // Update hub-1 profile
            const updated = await storage.loadHub('hub-1');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            await storage.saveHub('hub-1', updated.config, updated.reference);

            const results = await commands.checkAllHubsForUpdates();
            // Only hub-2 is active (single active profile enforcement deactivated hub-1)
            expect(results.length).toBe(1);
            
            const hub2Result = results.find(r => r.hubId === 'hub-2');
            expect(hub2Result).toBeTruthy();
            expect(hub2Result.hasUpdates).toBe(false);
        });

        it('should return empty array when no active profiles', async () => {
            const results = await commands.checkAllHubsForUpdates();
            expect(results.length).toBe(0);
        });
    });

    describe('Command Registration', () => {
        it('should register all sync commands', () => {
            const registeredCommands = commands.getRegisteredCommands();
            expect(registeredCommands.includes('promptRegistry.hub.checkForUpdates')).toBeTruthy();
            expect(registeredCommands.includes('promptRegistry.hub.viewChanges')).toBeTruthy();
            expect(registeredCommands.includes('promptRegistry.hub.syncProfile')).toBeTruthy();
            expect(registeredCommands.includes('promptRegistry.hub.reviewAndSync')).toBeTruthy();
            expect(registeredCommands.includes('promptRegistry.hub.checkAllForUpdates')).toBeTruthy();
        });
    });
});
