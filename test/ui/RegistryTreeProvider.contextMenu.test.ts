/**
 * Tests for RegistryTreeProvider Context Menu Bug Fix
 * 
 * Bug: getContextValueWithScope appends scope suffix to context values
 * (e.g., 'installed_bundle_auto_disabled_user') but package.json expects
 * base values without scope suffix (e.g., 'installed_bundle_auto_disabled').
 * 
 * This causes right-click context menu items to never appear because the
 * 'when' conditions in package.json don't match the actual context values.
 * 
 * These tests verify the BEHAVIOR:
 * - Context menu items should appear for installed bundles
 * - Context values must match package.json 'when' clauses
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { RegistryTreeProvider, TreeItemType, RegistryTreeItem } from '../../src/ui/RegistryTreeProvider';
import { RegistryManager } from '../../src/services/RegistryManager';
import { HubManager } from '../../src/services/HubManager';
import { setupTreeProviderMocks, isValidContextValue } from '../helpers/uiTestHelpers';

describe('RegistryTreeProvider - Context Menu Bug', () => {
    let provider: RegistryTreeProvider;
    let registryManagerStub: sinon.SinonStubbedInstance<RegistryManager>;
    let hubManagerStub: sinon.SinonStubbedInstance<HubManager>;
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        registryManagerStub = sandbox.createStubInstance(RegistryManager);
        hubManagerStub = sandbox.createStubInstance(HubManager);
        
        // Use shared helper for consistent mock setup
        setupTreeProviderMocks(registryManagerStub, hubManagerStub, sandbox);

        provider = new RegistryTreeProvider(registryManagerStub as any, hubManagerStub as any);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('Right-click menu should appear for installed bundles', () => {
        it('user scope bundle should have valid context value for menu', async () => {
            const userBundle = {
                bundleId: 'user-bundle',
                version: '1.0.0',
                installedAt: new Date().toISOString(),
                scope: 'user' as const,
                installPath: '/user/path',
                manifest: {} as any
            };

            registryManagerStub.listInstalledBundles.resolves([userBundle]);
            registryManagerStub.getBundleDetails.withArgs('user-bundle').resolves({
                id: 'user-bundle',
                name: 'User Bundle',
                version: '1.0.0',
                description: 'User bundle',
                author: 'Author',
                sourceId: 'source1',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '1MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest',
                downloadUrl: 'https://example.com/download'
            });

            const installedRoot = new RegistryTreeItem(
                'Installed Bundles',
                TreeItemType.INSTALLED_ROOT,
                undefined,
                vscode.TreeItemCollapsibleState.Expanded
            );

            const items = await provider.getChildren(installedRoot);
            expect(items.length).toBe(1);
            
            const item = items[0];
            
            // THE KEY ASSERTION: Context value must match package.json 'when' clauses
            // Otherwise the right-click menu won't appear
            expect(isValidContextValue(item.contextValue as string), `Context value '${item.contextValue}' is not recognized by package.json. ` +
                `Menu items won't appear. Context value must match one of the valid patterns.`).toBeTruthy();
        });

        it('repository scope bundle should have valid context value for menu', async () => {
            const repoBundle = {
                bundleId: 'repo-bundle',
                version: '1.0.0',
                installedAt: new Date().toISOString(),
                scope: 'repository' as const,
                commitMode: 'commit' as const,
                installPath: '/repo/path',
                manifest: {} as any
            };

            registryManagerStub.listInstalledBundles.resolves([repoBundle]);
            registryManagerStub.getBundleDetails.withArgs('repo-bundle').resolves({
                id: 'repo-bundle',
                name: 'Repository Bundle',
                version: '1.0.0',
                description: 'Repository bundle',
                author: 'Author',
                sourceId: 'source1',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '1MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest',
                downloadUrl: 'https://example.com/download'
            });

            const installedRoot = new RegistryTreeItem(
                'Installed Bundles',
                TreeItemType.INSTALLED_ROOT,
                undefined,
                vscode.TreeItemCollapsibleState.Expanded
            );

            const items = await provider.getChildren(installedRoot);
            expect(items.length).toBe(1);
            
            const item = items[0];
            
            // THE KEY ASSERTION: Context value must match package.json 'when' clauses
            expect(isValidContextValue(item.contextValue as string), `Context value '${item.contextValue}' is not recognized by package.json. ` +
                `Menu items won't appear. Context value must match one of the valid patterns.`).toBeTruthy();
        });

        it('repository local-only bundle should have valid context value for menu', async () => {
            const repoBundle = {
                bundleId: 'repo-bundle-local',
                version: '1.0.0',
                installedAt: new Date().toISOString(),
                scope: 'repository' as const,
                commitMode: 'local-only' as const,
                installPath: '/repo/path',
                manifest: {} as any
            };

            registryManagerStub.listInstalledBundles.resolves([repoBundle]);
            registryManagerStub.getBundleDetails.withArgs('repo-bundle-local').resolves({
                id: 'repo-bundle-local',
                name: 'Repository Bundle Local',
                version: '1.0.0',
                description: 'Repository bundle local only',
                author: 'Author',
                sourceId: 'source1',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '1MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest',
                downloadUrl: 'https://example.com/download'
            });

            const installedRoot = new RegistryTreeItem(
                'Installed Bundles',
                TreeItemType.INSTALLED_ROOT,
                undefined,
                vscode.TreeItemCollapsibleState.Expanded
            );

            const items = await provider.getChildren(installedRoot);
            expect(items.length).toBe(1);
            
            const item = items[0];
            
            // THE KEY ASSERTION: Context value must match package.json 'when' clauses
            expect(isValidContextValue(item.contextValue as string), `Context value '${item.contextValue}' is not recognized by package.json. ` +
                `Menu items won't appear. Context value must match one of the valid patterns.`).toBeTruthy();
        });
    });

    describe('Scope information should still be accessible for commands', () => {
        it('uninstall command should be able to determine bundle scope', async () => {
            const userBundle = {
                bundleId: 'user-bundle',
                version: '1.0.0',
                installedAt: new Date().toISOString(),
                scope: 'user' as const,
                installPath: '/user/path',
                manifest: {} as any
            };

            registryManagerStub.listInstalledBundles.resolves([userBundle]);
            registryManagerStub.getBundleDetails.withArgs('user-bundle').resolves({
                id: 'user-bundle',
                name: 'User Bundle',
                version: '1.0.0',
                description: 'User bundle',
                author: 'Author',
                sourceId: 'source1',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '1MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest',
                downloadUrl: 'https://example.com/download'
            });

            const installedRoot = new RegistryTreeItem(
                'Installed Bundles',
                TreeItemType.INSTALLED_ROOT,
                undefined,
                vscode.TreeItemCollapsibleState.Expanded
            );

            const items = await provider.getChildren(installedRoot);
            const item = items[0];
            
            // Commands receive the tree item and need to access scope from item.data
            expect(item.data, 'Item should have data for command handlers').toBeTruthy();
            expect(item.data.scope, 'Scope should be accessible from data').toBe('user');
            expect(item.data.bundleId, 'Bundle ID should be accessible').toBe('user-bundle');
        });

        it('repository bundle should expose commitMode for commands', async () => {
            const repoBundle = {
                bundleId: 'repo-bundle',
                version: '1.0.0',
                installedAt: new Date().toISOString(),
                scope: 'repository' as const,
                commitMode: 'commit' as const,
                installPath: '/repo/path',
                manifest: {} as any
            };

            registryManagerStub.listInstalledBundles.resolves([repoBundle]);
            registryManagerStub.getBundleDetails.withArgs('repo-bundle').resolves({
                id: 'repo-bundle',
                name: 'Repository Bundle',
                version: '1.0.0',
                description: 'Repository bundle',
                author: 'Author',
                sourceId: 'source1',
                environments: [],
                tags: [],
                lastUpdated: new Date().toISOString(),
                size: '1MB',
                dependencies: [],
                license: 'MIT',
                manifestUrl: 'https://example.com/manifest',
                downloadUrl: 'https://example.com/download'
            });

            const installedRoot = new RegistryTreeItem(
                'Installed Bundles',
                TreeItemType.INSTALLED_ROOT,
                undefined,
                vscode.TreeItemCollapsibleState.Expanded
            );

            const items = await provider.getChildren(installedRoot);
            const item = items[0];
            
            // Commands need scope and commitMode for repository bundles
            expect(item.data.scope).toBe('repository');
            expect(item.data.commitMode).toBe('commit');
        });
    });
});
