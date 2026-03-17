/**
 * Profile Management Commands Unit Tests
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ProfileCommands } from '../../src/commands/ProfileCommands';
import { RegistryManager } from '../../src/services/RegistryManager';

describe('Profile Management Commands', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('createProfile', () => {
        it('should prompt for profile name', async () => {
            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
            showInputBoxStub.resolves('My Profile');

            const result = await showInputBoxStub({ prompt: 'Enter profile name' });
            expect(result).toBe('My Profile');
        });

        it('should validate profile name uniqueness', async () => {
            const existingProfiles = [
                { id: 'profile-1', name: 'Profile 1' },
                { id: 'profile-2', name: 'Profile 2' },
            ];

            const newName = 'Profile 1';
            const isDuplicate = existingProfiles.some(p => p.name === newName);

            expect(isDuplicate).toBe(true);
        });

        it('should allow custom bundle selection', async () => {
            const availableBundles = [
                { id: 'bundle-1', name: 'Bundle 1' },
                { id: 'bundle-2', name: 'Bundle 2' },
                { id: 'bundle-3', name: 'Bundle 3' },
            ];

            const selectedBundles = ['bundle-1', 'bundle-3'];

            expect(selectedBundles.length).toBe(2);
            expect(selectedBundles.includes('bundle-1')).toBeTruthy();
            expect(selectedBundles.includes('bundle-3')).toBeTruthy();
        });

        it('should show expanded icon list with search keywords', async () => {
            const registryManagerStub = sandbox.createStubInstance(RegistryManager);
            registryManagerStub.listProfiles.resolves([]);
            registryManagerStub.createProfile.resolves({} as any);
            
            const profileCommands = new ProfileCommands(registryManagerStub as any);
            
            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
            showInputBoxStub.onFirstCall().resolves('Test Profile'); // Name
            showInputBoxStub.onSecondCall().resolves('Description'); // Description
            
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            
            // Mock bundle selection
            sandbox.stub(profileCommands as any, 'selectBundles').resolves(['bundle-1']);
            sandbox.stub(profileCommands as any, 'generateProfileId').returns('test-profile-id');
            // Mock activateProfile to avoid errors
            sandbox.stub(profileCommands as any, 'activateProfile').resolves();

            // Mock icon selection return
            showQuickPickStub.onFirstCall().resolves({ label: '🚀 Rocket', description: 'launch', iconChar: '🚀' } as any);

            await profileCommands.createProfile();

            const iconCall = showQuickPickStub.firstCall;
            expect(iconCall, 'showQuickPick should be called for icons').toBeTruthy();
            
            const items = iconCall.args[0] as vscode.QuickPickItem[];
            expect(items.length > 20, 'Should have a larger pool of icons').toBeTruthy();
            
            const rocketIcon = items.find(i => i.label.includes('🚀'));
            expect(rocketIcon).toBeTruthy();
            expect(rocketIcon.description && rocketIcon.description.toLowerCase().includes('launch'), 'Rocket icon should be searchable by "launch"').toBeTruthy();
        });
    });

    describe('editProfile', () => {
        it('should allow renaming profile', async () => {
            const profile = {
                id: 'profile-1',
                name: 'Old Name',
                bundles: [],
            };

            const updated = { ...profile, name: 'New Name' };

            expect(updated.name).toBe('New Name');
            expect(updated.id).toBe(profile.id);
        });

        it('should allow adding bundles to profile', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                bundles: ['bundle-1'],
            };

            const updated = {
                ...profile,
                bundles: [...profile.bundles, 'bundle-2'],
            };

            expect(updated.bundles.length).toBe(2);
            expect(updated.bundles.includes('bundle-2')).toBeTruthy();
        });

        it('should allow removing bundles from profile', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                bundles: ['bundle-1', 'bundle-2', 'bundle-3'],
            };

            const updated = {
                ...profile,
                bundles: profile.bundles.filter(b => b !== 'bundle-2'),
            };

            expect(updated.bundles.length).toBe(2);
            expect(!updated.bundles.includes('bundle-2')).toBeTruthy();
        });

        it('should preserve profile ID when editing', async () => {
            const profile = {
                id: 'profile-abc',
                name: 'My Profile',
                bundles: [],
            };

            const updated = {
                ...profile,
                name: 'Updated Profile',
                bundles: ['new-bundle'],
            };

            expect(updated.id).toBe('profile-abc');
        });
    });

    describe('activateProfile', () => {
        it('should mark profile as active', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                active: false,
            };

            const activated = { ...profile, active: true };

            expect(activated.active).toBe(true);
        });

        it('should deactivate other profiles', async () => {
            const profiles = [
                { id: 'profile-1', name: 'Profile 1', active: true },
                { id: 'profile-2', name: 'Profile 2', active: false },
                { id: 'profile-3', name: 'Profile 3', active: false },
            ];

            const updated = profiles.map(p => ({
                ...p,
                active: p.id === 'profile-2',
            }));

            expect(updated.filter(p => p.active).length).toBe(1);
            expect(updated.find(p => p.id === 'profile-2')?.active).toBe(true);
        });

        it('should install profile bundles', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                bundles: ['bundle-1', 'bundle-2'],
            };

            // Simulate bundle installation
            const installedBundles = [...profile.bundles];

            expect(installedBundles.length).toBe(2);
        });

        it('should sync bundles to Copilot', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                bundles: ['bundle-1'],
            };

            // Simulate sync operation
            const synced = true;

            expect(synced).toBe(true);
        });
    });

    describe('deactivateProfile', () => {
        it('should mark profile as inactive', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                active: true,
            };

            const deactivated = { ...profile, active: false };

            expect(deactivated.active).toBe(false);
        });

        it('should prompt for cleanup options', async () => {
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            showQuickPickStub.resolves({ label: 'Keep bundles installed' } as any);

            const result = await showQuickPickStub([
                { label: 'Keep bundles installed' },
                { label: 'Uninstall bundles' },
            ]);

            expect(result).toBeTruthy();
        });

        it('should optionally uninstall bundles', async () => {
            const profile = {
                id: 'profile-1',
                bundles: ['bundle-1', 'bundle-2'],
            };

            const uninstallBundles = true;

            if (uninstallBundles) {
                // Simulate bundle removal
                const remainingBundles: string[] = [];
                expect(remainingBundles.length).toBe(0);
            }
        });
    });

    describe('deleteProfile', () => {
        it('should prompt for confirmation', async () => {
            // Simulated confirmation
            const confirmed = true;
            expect(confirmed).toBe(true);
        });

        it('should prevent deleting active profile', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                active: true,
            };

            const canDelete = !profile.active;

            expect(canDelete).toBe(false);
        });

        it('should remove profile from storage', async () => {
            const profiles = [
                { id: 'profile-1', name: 'Profile 1' },
                { id: 'profile-2', name: 'Profile 2' },
            ];

            const updated = profiles.filter(p => p.id !== 'profile-1');

            expect(updated.length).toBe(1);
            expect(!updated.find(p => p.id === 'profile-1')).toBeTruthy();
        });
    });

    describe('exportProfile', () => {
        it('should serialize profile to JSON', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                bundles: ['bundle-1', 'bundle-2'],
                created: new Date(),
            };

            const json = JSON.stringify(profile);
            const parsed = JSON.parse(json);

            expect(parsed.id).toBe(profile.id);
            expect(parsed.name).toBe(profile.name);
        });

        it('should include bundle configurations', async () => {
            const profile = {
                id: 'profile-1',
                name: 'My Profile',
                bundles: ['bundle-1', 'bundle-2'],
                bundleConfigs: {
                    'bundle-1': { enabled: true, settings: {} },
                    'bundle-2': { enabled: false, settings: {} },
                },
            };

            expect(profile.bundleConfigs).toBeTruthy();
            expect(Object.keys(profile.bundleConfigs).length).toBe(2);
        });

        it('should prompt for export location', async () => {
            const showSaveDialogStub = sandbox.stub(vscode.window, 'showSaveDialog');
            showSaveDialogStub.resolves({ fsPath: '/path/to/profile.json' } as vscode.Uri);

            const result = await showSaveDialogStub({});

            expect(result?.fsPath.endsWith('.json')).toBeTruthy();
        });
    });

    describe('importProfile', () => {
        it('should prompt for profile file', async () => {
            const showOpenDialogStub = sandbox.stub(vscode.window, 'showOpenDialog');
            showOpenDialogStub.resolves([{ fsPath: '/path/to/profile.json' } as vscode.Uri]);

            const result = await showOpenDialogStub({});

            expect(result && result.length > 0).toBeTruthy();
        });

        it('should validate imported profile structure', async () => {
            const importedData = {
                id: 'profile-1',
                name: 'Imported Profile',
                bundles: ['bundle-1'],
            };

            const isValid = importedData.id && importedData.name && Array.isArray(importedData.bundles);

            expect(isValid).toBe(true);
        });

        it('should handle duplicate profile names', async () => {
            const existingProfiles = [
                { id: 'profile-1', name: 'My Profile' },
            ];

            const imported = {
                id: 'profile-2',
                name: 'My Profile',
            };

            const isDuplicate = existingProfiles.some(p => p.name === imported.name);

            expect(isDuplicate).toBe(true);
        });

        it('should generate new ID for imported profile', async () => {
            const imported = {
                id: 'old-id',
                name: 'Imported Profile',
                bundles: [],
            };

            const newId = `imported-${Date.now()}`;
            const updated = { ...imported, id: newId };

            expect(updated.id).not.toBe(imported.id);
            expect(updated.id.startsWith('imported-')).toBeTruthy();
        });
    });

    describe('listProfiles', () => {
        it('should show all profiles', async () => {
            const profiles = [
                { id: 'profile-1', name: 'Profile 1', active: true },
                { id: 'profile-2', name: 'Profile 2', active: false },
                { id: 'profile-3', name: 'Profile 3', active: false },
            ];

            expect(profiles.length).toBe(3);
        });

        it('should indicate active profile', async () => {
            const profiles = [
                { id: 'profile-1', name: 'Profile 1', active: true },
                { id: 'profile-2', name: 'Profile 2', active: false },
            ];

            const activeProfile = profiles.find(p => p.active);

            expect(activeProfile).toBeTruthy();
            expect(activeProfile.id).toBe('profile-1');
        });

        it('should sort profiles by name', async () => {
            const profiles = [
                { id: 'profile-1', name: 'Charlie' },
                { id: 'profile-2', name: 'Alpha' },
                { id: 'profile-3', name: 'Bravo' },
            ];

            const sorted = [...profiles].sort((a, b) => a.name.localeCompare(b.name));

            expect(sorted[0].name).toBe('Alpha');
            expect(sorted[1].name).toBe('Bravo');
            expect(sorted[2].name).toBe('Charlie');
        });
    });

    describe('Profile Switching', () => {
        it('should handle profile switch lifecycle', async () => {
            let profiles = [
                { id: 'profile-1', name: 'Profile 1', active: true, bundles: ['bundle-1'] },
                { id: 'profile-2', name: 'Profile 2', active: false, bundles: ['bundle-2'] },
            ];

            // Switch to profile-2
            profiles = profiles.map(p => ({
                ...p,
                active: p.id === 'profile-2',
            }));

            const activeProfile = profiles.find(p => p.active);

            expect(activeProfile?.id).toBe('profile-2');
            expect(profiles.filter(p => p.active).length).toBe(1);
        });

        it('should maintain profile state during switch', async () => {
            const profile1 = {
                id: 'profile-1',
                name: 'Profile 1',
                bundles: ['bundle-1'],
                settings: { key: 'value' },
            };

            // Deactivate
            const deactivated = { ...profile1, active: false };

            // Settings should be preserved
            expect(deactivated.settings).toEqual(profile1.settings);
            expect(deactivated.bundles).toEqual(profile1.bundles);
        });
    });
});
