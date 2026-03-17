/**
 * Unit tests for MigrationRegistry
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { MigrationRegistry } from '../../src/services/MigrationRegistry';

describe('MigrationRegistry', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let globalStateData: Map<string, any>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        globalStateData = new Map();

        mockContext = {
            globalState: {
                get: (key: string, defaultValue?: any) => globalStateData.get(key) ?? defaultValue,
                update: async (key: string, value: any) => {
                    globalStateData.set(key, value);
                },
                keys: () => Array.from(globalStateData.keys()),
                setKeysForSync: sandbox.stub()
            } as any,
            globalStorageUri: vscode.Uri.file('/mock/storage'),
            extensionPath: '/mock/extension',
            extensionUri: vscode.Uri.file('/mock/extension'),
            subscriptions: [],
            extensionMode: 1 as any
        } as any as vscode.ExtensionContext;

        MigrationRegistry.resetInstance();
    });

    afterEach(() => {
        sandbox.restore();
        MigrationRegistry.resetInstance();
    });

    describe('getInstance()', () => {
        it('should return singleton instance', () => {
            const instance1 = MigrationRegistry.getInstance(mockContext);
            const instance2 = MigrationRegistry.getInstance();

            expect(instance1).toBe(instance2);
        });

        it('should throw error when context is missing on first call', () => {
            expect(() => MigrationRegistry.getInstance()).toThrow(/MigrationRegistry requires context on first call/);
        });

        it('should create new instance after reset', () => {
            const instance1 = MigrationRegistry.getInstance(mockContext);
            MigrationRegistry.resetInstance();
            const instance2 = MigrationRegistry.getInstance(mockContext);

            expect(instance1).not.toBe(instance2);
        });
    });

    describe('isMigrationComplete()', () => {
        it('should return false for unknown migration', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            expect(await registry.isMigrationComplete('unknown')).toBe(false);
        });

        it('should return true after markMigrationComplete', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await registry.markMigrationComplete('test-migration');

            expect(await registry.isMigrationComplete('test-migration')).toBe(true);
        });

        it('should return false for skipped migration', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await registry.markMigrationSkipped('test-migration', 'not needed');

            expect(await registry.isMigrationComplete('test-migration')).toBe(false);
        });
    });

    describe('markMigrationComplete()', () => {
        it('should persist completion with timestamp', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await registry.markMigrationComplete('test-migration', 'migrated 5 sources');

            const state = await registry.getMigrationState();
            expect(state['test-migration'].status).toBe('completed');
            expect(state['test-migration'].completedAt).toBeTruthy();
            expect(state['test-migration'].details).toBe('migrated 5 sources');
        });
    });

    describe('markMigrationSkipped()', () => {
        it('should persist skip with reason', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await registry.markMigrationSkipped('test-migration', 'no sources to migrate');

            const state = await registry.getMigrationState();
            expect(state['test-migration'].status).toBe('skipped');
            expect(state['test-migration'].details).toBe('no sources to migrate');
        });
    });

    describe('runMigration()', () => {
        it('should execute migration function on first run', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);
            let executed = false;

            await registry.runMigration('test-migration', async () => {
                executed = true;
            });

            expect(executed).toBe(true);
            expect(await registry.isMigrationComplete('test-migration')).toBe(true);
        });

        it('should not execute migration function if already completed', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await registry.markMigrationComplete('test-migration');

            let executed = false;
            await registry.runMigration('test-migration', async () => {
                executed = true;
            });

            expect(executed).toBe(false);
        });

        it('should not execute migration function if already skipped', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await registry.markMigrationSkipped('test-migration');

            let executed = false;
            await registry.runMigration('test-migration', async () => {
                executed = true;
            });

            expect(executed).toBe(false);
        });

        it('should propagate errors from migration function', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await expect(() => registry.runMigration('test-migration', async () => {
                    throw new Error('migration failed');
                })).rejects.toThrow(/migration failed/);

            // Migration should not be marked as complete on failure
            expect(await registry.isMigrationComplete('test-migration')).toBe(false);
        });
    });

    describe('getMigrationState()', () => {
        it('should return empty object when no migrations exist', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            const state = await registry.getMigrationState();

            expect(state).toEqual({});
        });

        it('should return all migration records', async () => {
            const registry = MigrationRegistry.getInstance(mockContext);

            await registry.markMigrationComplete('migration-1');
            await registry.markMigrationSkipped('migration-2');

            const state = await registry.getMigrationState();
            expect(Object.keys(state).length).toBe(2);
            expect(state['migration-1'].status).toBe('completed');
            expect(state['migration-2'].status).toBe('skipped');
        });
    });
});
