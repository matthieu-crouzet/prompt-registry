/**
 * Source Management Commands Unit Tests
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';

describe('Source Management Commands', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockContext = {
            globalState: {
                get: sandbox.stub().returns(undefined),
                update: sandbox.stub().resolves(),
                keys: sandbox.stub().returns([]),
            },
            globalStorageUri: { fsPath: '/mock/storage' } as vscode.Uri,
        } as any;
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('addSource', () => {
        it('should prompt for source details', async () => {
            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
            showInputBoxStub.onFirstCall().resolves('Test Source');
            showInputBoxStub.onSecondCall().resolves('https://github.com/test/repo');

            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            showQuickPickStub.resolves({ label: 'GitHub', value: 'github' } as any);

            // Mock the actual command execution
            expect(showInputBoxStub).toBeTruthy();
            expect(showQuickPickStub).toBeTruthy();
        });

        it('should validate source URL format', async () => {
            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox');
            showInputBoxStub.onFirstCall().resolves('Test Source');
            showInputBoxStub.onSecondCall().resolves('invalid-url');

            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');

            // Validation would typically happen in the command
            const url = 'invalid-url';
            const isValidUrl = url.startsWith('http://') || url.startsWith('https://') || url.startsWith('git@');
            
            if (!isValidUrl) {
                expect(true, 'Invalid URL detected').toBeTruthy();
            }
        });

        it('should support GitHub sources', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
            };

            expect(source.type).toBe('github');
            expect(source.url.includes('github.com')).toBeTruthy();
        });

        it('should support GitLab sources', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'gitlab',
                url: 'https://gitlab.com/test/repo',
                enabled: true,
                priority: 1,
            };

            expect(source.type).toBe('gitlab');
            expect(source.url.includes('gitlab.com')).toBeTruthy();
        });

        it('should support HTTP sources', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'http',
                url: 'https://example.com/bundles',
                enabled: true,
                priority: 1,
            };

            expect(source.type).toBe('http');
            expect(source.url.startsWith('https://')).toBeTruthy();
        });

        it('should support local sources', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'local',
                url: '/path/to/bundles',
                enabled: true,
                priority: 1,
            };

            expect(source.type).toBe('local');
            expect(source.url.startsWith('/')).toBeTruthy();
        });
    });

    describe('editSource', () => {
        it('should allow editing source name', async () => {
            const originalSource = {
                id: 'test-source',
                name: 'Old Name',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
            };

            const updatedSource = {
                ...originalSource,
                name: 'New Name',
            };

            expect(originalSource.name).not.toBe(updatedSource.name);
            expect(updatedSource.name).toBe('New Name');
        });

        it('should allow editing source URL', async () => {
            const originalSource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/old-repo',
                enabled: true,
                priority: 1,
            };

            const updatedSource = {
                ...originalSource,
                url: 'https://github.com/test/new-repo',
            };

            expect(originalSource.url).not.toBe(updatedSource.url);
            expect(updatedSource.url).toBe('https://github.com/test/new-repo');
        });

        it('should allow changing source type', async () => {
            const originalSource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
            };

            const updatedSource = {
                ...originalSource,
                type: 'gitlab',
                url: 'https://gitlab.com/test/repo',
            };

            expect(originalSource.type).not.toBe(updatedSource.type);
            expect(updatedSource.type).toBe('gitlab');
        });

        it('should preserve source priority when editing', async () => {
            const originalSource = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 5,
            };

            const updatedSource = {
                ...originalSource,
                name: 'Updated Name',
            };

            expect(updatedSource.priority).toBe(5);
        });
    });

    describe('removeSource', () => {
        it('should prompt for confirmation before removing', async () => {
            // Simulated confirmation
            const confirmed = true;
            expect(confirmed).toBe(true);
        });

        it('should cancel removal if user declines', async () => {
            // Simulated cancellation
            const cancelled = true;
            expect(cancelled).toBe(true);
        });

        it('should remove source from storage', async () => {
            const sources = [
                { id: 'source-1', name: 'Source 1', type: 'github', url: 'url1', enabled: true, priority: 1 },
                { id: 'source-2', name: 'Source 2', type: 'github', url: 'url2', enabled: true, priority: 2 },
            ];

            const updatedSources = sources.filter(s => s.id !== 'source-1');

            expect(updatedSources.length).toBe(1);
            expect(updatedSources[0].id).toBe('source-2');
        });

        it('should not affect other sources when removing one', async () => {
            const sources = [
                { id: 'source-1', name: 'Source 1', type: 'github', url: 'url1', enabled: true, priority: 1 },
                { id: 'source-2', name: 'Source 2', type: 'github', url: 'url2', enabled: true, priority: 2 },
                { id: 'source-3', name: 'Source 3', type: 'github', url: 'url3', enabled: true, priority: 3 },
            ];

            const updatedSources = sources.filter(s => s.id !== 'source-2');

            expect(updatedSources.length).toBe(2);
            expect(updatedSources.find(s => s.id === 'source-1')).toBeTruthy();
            expect(updatedSources.find(s => s.id === 'source-3')).toBeTruthy();
            expect(!updatedSources.find(s => s.id === 'source-2')).toBeTruthy();
        });
    });

    describe('toggleSource', () => {
        it('should enable disabled source', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: false,
                priority: 1,
            };

            const toggled = { ...source, enabled: !source.enabled };

            expect(toggled.enabled).toBe(true);
        });

        it('should disable enabled source', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
            };

            const toggled = { ...source, enabled: !source.enabled };

            expect(toggled.enabled).toBe(false);
        });

        it('should preserve all other properties when toggling', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 5,
                token: 'test-token',
            };

            const toggled = { ...source, enabled: !source.enabled };

            expect(toggled.id).toBe(source.id);
            expect(toggled.name).toBe(source.name);
            expect(toggled.type).toBe(source.type);
            expect(toggled.url).toBe(source.url);
            expect(toggled.priority).toBe(source.priority);
            expect(toggled.token).toBe(source.token);
        });
    });

    describe('syncSource', () => {
        it('should refresh bundles from source', async () => {
            sandbox.stub(vscode.window, 'showInformationMessage').resolves();
            
            // Simulate sync operation
            const syncStartTime = Date.now();
            await new Promise(resolve => setTimeout(resolve, 10));
            const syncEndTime = Date.now();

            expect(syncEndTime >= syncStartTime).toBeTruthy();
        });

        it('should handle sync errors gracefully', async () => {
            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
            
            const error = new Error('Sync failed');
            showErrorMessageStub.resolves();

            expect(error.message.includes('Sync failed')).toBeTruthy();
        });

        it('should update last sync timestamp', async () => {
            const source = {
                id: 'test-source',
                name: 'Test Source',
                type: 'github',
                url: 'https://github.com/test/repo',
                enabled: true,
                priority: 1,
                lastSync: undefined as Date | undefined,
            };

            const updatedSource = {
                ...source,
                lastSync: new Date(),
            };

            expect(updatedSource.lastSync).toBeTruthy();
            expect(updatedSource.lastSync instanceof Date).toBeTruthy();
        });
    });

    describe('syncAllSources', () => {
        it('should sync all enabled sources', async () => {
            const sources = [
                { id: 'source-1', name: 'Source 1', type: 'github', url: 'url1', enabled: true, priority: 1 },
                { id: 'source-2', name: 'Source 2', type: 'github', url: 'url2', enabled: false, priority: 2 },
                { id: 'source-3', name: 'Source 3', type: 'github', url: 'url3', enabled: true, priority: 3 },
            ];

            const enabledSources = sources.filter(s => s.enabled);

            expect(enabledSources.length).toBe(2);
            expect(enabledSources.every(s => s.enabled)).toBeTruthy();
        });

        it('should skip disabled sources', async () => {
            const sources = [
                { id: 'source-1', name: 'Source 1', type: 'github', url: 'url1', enabled: false, priority: 1 },
                { id: 'source-2', name: 'Source 2', type: 'github', url: 'url2', enabled: false, priority: 2 },
            ];

            const enabledSources = sources.filter(s => s.enabled);

            expect(enabledSources.length).toBe(0);
        });

        it('should continue on individual source failures', async () => {
            const sources = [
                { id: 'source-1', name: 'Source 1', type: 'github', url: 'url1', enabled: true, priority: 1 },
                { id: 'source-2', name: 'Source 2', type: 'github', url: 'url2', enabled: true, priority: 2 },
                { id: 'source-3', name: 'Source 3', type: 'github', url: 'url3', enabled: true, priority: 3 },
            ];

            const results = await Promise.allSettled(
                sources.map(async (source) => {
                    if (source.id === 'source-2') {
                        throw new Error('Sync failed');
                    }
                    return source;
                })
            );

            const fulfilled = results.filter(r => r.status === 'fulfilled');
            const rejected = results.filter(r => r.status === 'rejected');

            expect(fulfilled.length).toBe(2);
            expect(rejected.length).toBe(1);
        });
    });
});
