import { HubSyncHistory, SyncHistoryEntry } from '../../src/commands/HubSyncHistory';
import { HubManager } from '../../src/services/HubManager';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubProfileBundle } from '../../src/types/hub';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

describe('Hub Sync History', () => {
    let storage: HubStorage;
    let hubManager: HubManager;
    let syncHistory: HubSyncHistory;
    let testDir: string;

    beforeEach(async () => {
        const globalStorageUri = vscode.Uri.file(path.join(__dirname, '../../test-workspace', '.test-storage'));
        testDir = globalStorageUri.fsPath;

        // Clean up test directory
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
        fs.mkdirSync(testDir, { recursive: true });

        storage = new HubStorage(testDir);
        hubManager = new HubManager(storage, {} as any, process.cwd(), undefined, undefined);
        syncHistory = new HubSyncHistory(hubManager);
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    async function createTestHub(hubId: string) {
        const hubConfig = {
            version: '1.0.0',
            metadata: {
                name: 'Test Hub',
                description: 'Test hub for sync history',
                maintainer: 'test@example.com',
                updatedAt: new Date().toISOString()
            },
            sources: [
                {
                    id: 'test-source',
                    name: 'Test Source',
                    type: 'github' as const,
                    url: 'github:test/repo',
                    enabled: true,
                    priority: 1,
                    metadata: { description: 'Test source' }
                }
            ],
            profiles: [
                {
                    id: 'test-profile',
                    name: 'Test Profile',
                    description: 'Test profile',
                    icon: 'test-icon',
                    active: false,
                    createdAt: new Date().toISOString(),
                    bundles: [
                        {
                            id: 'bundle-1',
                            version: '1.0.0',
                            source: 'test-source',
                            required: false
                        }
                    ],
                    updatedAt: new Date().toISOString()
                }
            ]
        };

        const reference = {
            type: 'github' as const,
            location: 'github:test/hub-repo',
            branch: 'main'
        };

        await storage.saveHub(hubId, hubConfig, reference);
    }

    describe('Record Sync Operation', () => {
        it('should record successful sync operation', async () => {
            const changes = {
                added: [],
                updated: [],
                removed: [],
                metadataChanged: false
            };
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            await syncHistory.recordSync('test-hub', 'test-profile', changes, previousState, 'success');

            const history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(1);
            expect(history[0].hubId).toBe('test-hub');
            expect(history[0].profileId).toBe('test-profile');
            expect(history[0].status).toBe('success');
            expect(history[0].changes.added.length).toBe(0);
            expect(history[0].changes.updated.length).toBe(0);
            expect(history[0].changes.removed.length).toBe(0);
        });

        it('should record sync with bundle additions', async () => {
            const changes = {
                added: [{ id: 'bundle-2', version: '1.0.0', source: 'test-source', required: false }],
                updated: [],
                removed: [],
                metadataChanged: false
            };
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            await syncHistory.recordSync('test-hub', 'test-profile', changes, previousState, 'success');

            const history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(1);
            expect(history[0].changes.added.length).toBe(1);
            expect(history[0].changes.added[0].id).toBe('bundle-2');
            expect(history[0].changes.added[0].version).toBe('1.0.0');
        });

        it('should record sync with bundle updates', async () => {
            const changes = {
                added: [],
                updated: [{ id: 'bundle-1', oldVersion: '1.0.0', newVersion: '2.0.0' }],
                removed: [],
                metadataChanged: false
            };
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            await syncHistory.recordSync('test-hub', 'test-profile', changes, previousState, 'success');

            const history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(1);
            expect(history[0].changes.updated.length).toBe(1);
            expect(history[0].changes.updated[0].id).toBe('bundle-1');
            expect(history[0].changes.updated[0].oldVersion).toBe('1.0.0');
            expect(history[0].changes.updated[0].newVersion).toBe('2.0.0');
        });

        it('should record sync with bundle removals', async () => {
            const changes = {
                added: [],
                updated: [],
                removed: ['bundle-1'],
                metadataChanged: false
            };
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            await syncHistory.recordSync('test-hub', 'test-profile', changes, previousState, 'success');

            const history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(1);
            expect(history[0].changes.removed.length).toBe(1);
            expect(history[0].changes.removed[0]).toBe('bundle-1');
        });

        it('should record metadata changes in sync', async () => {
            const changes = {
                added: [],
                updated: [],
                removed: [],
                metadataChanged: true
            };
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            await syncHistory.recordSync('test-hub', 'test-profile', changes, previousState, 'success');

            const history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(1);
            expect(history[0].changes.metadataChanged).toBe(true);
        });
    });

    describe('Get Sync History', () => {
        it('should return empty array for profile with no sync history', async () => {
            const history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(0);
        });

        it('should return sync history in chronological order', async () => {
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            // First sync
            await syncHistory.recordSync(
                'test-hub',
                'test-profile',
                {
                    added: [{ id: 'bundle-2', version: '1.0.0', source: 'test-source', required: false }],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState,
                'success'
            );

            await new Promise(resolve => setTimeout(resolve, 10));

            // Second sync
            await syncHistory.recordSync(
                'test-hub',
                'test-profile',
                {
                    added: [{ id: 'bundle-3', version: '1.0.0', source: 'test-source', required: false }],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState,
                'success'
            );

            const history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(2);
            // Most recent first
            expect(new Date(history[0].timestamp) >= new Date(history[1].timestamp)).toBeTruthy();
            expect(history[0].changes.added[0].id).toBe('bundle-3');
            expect(history[1].changes.added[0].id).toBe('bundle-2');
        });

        it('should limit history to specified count', async () => {
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            // Create 5 sync operations
            for (let i = 0; i < 5; i++) {
                await syncHistory.recordSync(
                    'test-hub',
                    'test-profile',
                    {
                        added: [{ id: `bundle-${i + 2}`, version: '1.0.0', source: 'test-source', required: false }],
                        updated: [],
                        removed: [],
                        metadataChanged: false
                    },
                    previousState,
                    'success'
                );
                await new Promise(resolve => setTimeout(resolve, 5));
            }

            const history = await syncHistory.getHistory('test-hub', 'test-profile', 3);
            expect(history.length).toBe(3);
        });
    });

    describe('Format History Entry', () => {
        it('should format history entry with all change types', async () => {
            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [{ id: 'bundle-2', version: '1.0.0', source: 'test-source', required: false }],
                    updated: [{ id: 'bundle-1', oldVersion: '1.0.0', newVersion: '2.0.0' }],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [],
                    activatedAt: new Date().toISOString()
                }
            };

            const formatted = syncHistory.formatHistoryEntry(entry);

            expect(formatted.includes('bundle-1 — Updated (1.0.0 → 2.0.0)')).toBeTruthy();
            expect(formatted.includes('bundle-2 (1.0.0) — Added [NEW]')).toBeTruthy();
        });

        it('should format history entry with timestamp', async () => {
            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [],
                    activatedAt: new Date().toISOString()
                }
            };

            const formatted = syncHistory.formatHistoryEntry(entry);

            expect(formatted.includes('Synced at:')).toBeTruthy();
            expect(formatted.includes(new Date(entry.timestamp).toLocaleString())).toBeTruthy();
        });

        it('should format history entry with status', async () => {
            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [],
                    activatedAt: new Date().toISOString()
                }
            };

            const formatted = syncHistory.formatHistoryEntry(entry);

            expect(formatted.includes('Status: success')).toBeTruthy();
        });
    });

    describe('Create History QuickPick Items', () => {
        it('should create QuickPick items for history entries', async () => {
            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [{ id: 'bundle-2', version: '1.0.0', source: 'test-source', required: false }],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [],
                    activatedAt: new Date().toISOString()
                }
            };

            const items = syncHistory.createHistoryQuickPickItems([entry]);

            expect(items.length).toBe(1);
            expect(items[0].label.includes('1 change')).toBeTruthy();
            expect(items[0].entry).toBe(entry);
        });

        it('should include change summary in QuickPick description', async () => {
            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [{ id: 'bundle-2', version: '1.0.0', source: 'test-source', required: false }],
                    updated: [{ id: 'bundle-1', oldVersion: '1.0.0', newVersion: '2.0.0' }],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [],
                    activatedAt: new Date().toISOString()
                }
            };

            const items = syncHistory.createHistoryQuickPickItems([entry]);

            expect(items[0].description?.includes('1 added')).toBeTruthy();
            expect(items[0].description?.includes('1 updated')).toBeTruthy();
        });

        it('should format timestamps in QuickPick items', async () => {
            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [],
                    activatedAt: new Date().toISOString()
                }
            };

            const items = syncHistory.createHistoryQuickPickItems([entry]);

            // Should include formatted date
            expect(items[0].label.match(/\d{4}-\d{2}-\d{2}/)).toBeTruthy();
        });
    });

    describe('Rollback to History Entry', () => {
        it('should rollback profile to previous state', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [
                        { id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false },
                        { id: 'bundle-2', version: '1.0.0', source: 'test-source', required: false }
                    ],
                    activatedAt: new Date().toISOString()
                }
            };

            await syncHistory.rollbackToEntry('test-hub', 'test-profile', entry, { installBundles: false });

            const state = await storage.getProfileActivationState('test-hub', 'test-profile');
            expect(state).toBeTruthy();
            expect(state.syncedBundles.length).toBe(2);
            expect(state.syncedBundles.includes('bundle-1')).toBeTruthy();
            expect(state.syncedBundles.includes('bundle-2')).toBeTruthy();
        });

        it('should record rollback as new history entry', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                    activatedAt: new Date().toISOString()
                }
            };

            const historyBefore = await syncHistory.getHistory('test-hub', 'test-profile');
            await syncHistory.rollbackToEntry('test-hub', 'test-profile', entry, { installBundles: false });

            const historyAfter = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(historyAfter.length).toBe(historyBefore.length + 1);
            expect(historyAfter[0].status).toBe('rollback');
        });

        it('should throw error when rolling back non-active profile', async () => {
            await createTestHub('test-hub');

            const entry: SyncHistoryEntry = {
                hubId: 'test-hub',
                profileId: 'test-profile',
                timestamp: new Date().toISOString(),
                status: 'success',
                changes: {
                    added: [],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState: {
                    bundles: [],
                    activatedAt: new Date().toISOString()
                }
            };

            await expect(async () => await syncHistory.rollbackToEntry('test-hub', 'test-profile', entry, { installBundles: false })).rejects.toThrow(/Profile test-profile is not active in hub test-hub/);
        });
    });

    describe('Clear History', () => {
        it('should clear all history for a profile', async () => {
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            // Create some history
            for (let i = 0; i < 3; i++) {
                await syncHistory.recordSync(
                    'test-hub',
                    'test-profile',
                    {
                        added: [{ id: `bundle-${i + 2}`, version: '1.0.0', source: 'test-source', required: false }],
                        updated: [],
                        removed: [],
                        metadataChanged: false
                    },
                    previousState,
                    'success'
                );
            }

            let history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(3);

            await syncHistory.clearHistory('test-hub', 'test-profile');

            history = await syncHistory.getHistory('test-hub', 'test-profile');
            expect(history.length).toBe(0);
        });

        it('should clear history only for specified profile', async () => {
            const previousState = {
                bundles: [{ id: 'bundle-1', version: '1.0.0', source: 'test-source', required: false }],
                activatedAt: new Date().toISOString()
            };

            // Create history for profile 1
            await syncHistory.recordSync(
                'test-hub',
                'test-profile',
                {
                    added: [{ id: 'bundle-2', version: '1.0.0', source: 'test-source', required: false }],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState,
                'success'
            );

            // Create history for profile 2
            await syncHistory.recordSync(
                'test-hub',
                'test-profile-2',
                {
                    added: [{ id: 'bundle-3', version: '1.0.0', source: 'test-source', required: false }],
                    updated: [],
                    removed: [],
                    metadataChanged: false
                },
                previousState,
                'success'
            );

            // Clear history for first profile only
            await syncHistory.clearHistory('test-hub', 'test-profile');

            const history1 = await syncHistory.getHistory('test-hub', 'test-profile');
            const history2 = await syncHistory.getHistory('test-hub', 'test-profile-2');

            expect(history1.length).toBe(0);
            expect(history2.length).toBe(1);
        });
    });
});
