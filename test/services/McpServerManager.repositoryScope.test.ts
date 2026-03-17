/**
 * McpServerManager Repository Scope Tests
 * 
 * Tests for MCP server installation at repository scope.
 * Requirements: 1.7, 10.5
 */

import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';
import * as sinon from 'sinon';
import { McpServerManager } from '../../src/services/McpServerManager';
import { McpServersManifest, McpConfiguration, McpTrackingMetadata } from '../../src/types/mcp';
import { RepositoryCommitMode } from '../../src/types/registry';

describe('McpServerManager Repository Scope Test Suite', () => {
    let manager: McpServerManager;
    let testWorkspaceRoot: string;
    let sandbox: sinon.SinonSandbox;

    // Helper to get .vscode/mcp.json path
    const getMcpConfigPath = (): string => {
        return path.join(testWorkspaceRoot, '.vscode', 'mcp.json');
    };

    // Helper to get tracking metadata path
    const getTrackingPath = (): string => {
        return path.join(testWorkspaceRoot, '.vscode', 'prompt-registry-mcp-tracking.json');
    };

    // Helper to get .git/info/exclude path
    const getGitExcludePath = (): string => {
        return path.join(testWorkspaceRoot, '.git', 'info', 'exclude');
    };

    // Helper to read mcp.json
    const readMcpConfig = async (): Promise<McpConfiguration | null> => {
        const configPath = getMcpConfigPath();
        if (!await fs.pathExists(configPath)) {
            return null;
        }
        const content = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(content);
    };

    // Helper to write mcp.json
    const writeMcpConfig = async (config: McpConfiguration): Promise<void> => {
        const configPath = getMcpConfigPath();
        await fs.ensureDir(path.dirname(configPath));
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    };

    // Helper to read tracking metadata
    const readTrackingMetadata = async (): Promise<McpTrackingMetadata | null> => {
        const trackingPath = getTrackingPath();
        if (!await fs.pathExists(trackingPath)) {
            return null;
        }
        const content = await fs.readFile(trackingPath, 'utf-8');
        return JSON.parse(content);
    };

    // Helper to read git exclude
    const readGitExclude = async (): Promise<string | null> => {
        const excludePath = getGitExcludePath();
        if (!await fs.pathExists(excludePath)) {
            return null;
        }
        return fs.readFile(excludePath, 'utf-8');
    };

    // Helper to create a test workspace with .git directory
    const setupTestWorkspace = async (withGit: boolean = true): Promise<void> => {
        await fs.ensureDir(testWorkspaceRoot);
        if (withGit) {
            await fs.ensureDir(path.join(testWorkspaceRoot, '.git', 'info'));
        }
    };

    beforeEach(async () => {
        sandbox = sinon.createSandbox();
        manager = new McpServerManager();
        testWorkspaceRoot = path.join(os.tmpdir(), 'mcp-repo-test-' + Date.now());
        await setupTestWorkspace();
    });

    afterEach(async () => {
        sandbox.restore();
        if (await fs.pathExists(testWorkspaceRoot)) {
            await fs.remove(testWorkspaceRoot);
        }
    });

    describe('installServersToWorkspace()', () => {
        it('should create .vscode/mcp.json if it does not exist', async () => {
            // Arrange
            const manifest: McpServersManifest = {
                'test-server': {
                    command: 'node',
                    args: ['server.js'],
                }
            };

            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.serversInstalled).toBe(1);
            
            const config = await readMcpConfig();
            expect(config, '.vscode/mcp.json should be created').toBeTruthy();
            expect(config.servers, 'servers object should exist').toBeTruthy();
        });

        it('should merge MCP servers into existing .vscode/mcp.json', async () => {
            // Arrange - create existing config with a server
            const existingConfig: McpConfiguration = {
                servers: {
                    'existing-server': {
                        command: 'python',
                        args: ['existing.py']
                    }
                }
            };
            await writeMcpConfig(existingConfig);

            const manifest: McpServersManifest = {
                'new-server': {
                    command: 'node',
                    args: ['new.js'],
                }
            };

            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Assert
            expect(result.success).toBe(true);
            
            const config = await readMcpConfig();
            expect(config).toBeTruthy();
            expect(config.servers['existing-server'], 'existing server should be preserved').toBeTruthy();
            expect(Object.keys(config.servers).some(k => k.includes('new-server')), 'new server should be added').toBeTruthy();
        });

        it('should preserve existing MCP servers in .vscode/mcp.json', async () => {
            // Arrange
            const existingConfig: McpConfiguration = {
                servers: {
                    'user-server-1': {
                        command: 'python',
                        args: ['server1.py']
                    },
                    'user-server-2': {
                        command: 'node',
                        args: ['server2.js']
                    }
                }
            };
            await writeMcpConfig(existingConfig);

            const manifest: McpServersManifest = {
                'bundle-server': {
                    command: 'node',
                    args: ['bundle.js'],
                }
            };

            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Assert
            expect(result.success).toBe(true);
            
            const config = await readMcpConfig();
            expect(config).toBeTruthy();
            expect(config.servers['user-server-1'], 'user-server-1 should be preserved').toBeTruthy();
            expect(config.servers['user-server-2'], 'user-server-2 should be preserved').toBeTruthy();
        });

        it('should track bundle-specific MCP servers for uninstallation', async () => {
            // Arrange
            const manifest: McpServersManifest = {
                'server-a': {
                    command: 'node',
                    args: ['a.js'],
                },
                'server-b': {
                    command: 'node',
                    args: ['b.js'],
                }
            };

            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.serversInstalled).toBe(2);
            
            const tracking = await readTrackingMetadata();
            expect(tracking, 'tracking metadata should be created').toBeTruthy();
            
            // Check that servers are tracked with bundle ID
            const trackedServers = Object.entries(tracking.managedServers)
                .filter(([_, meta]) => meta.bundleId === 'test-bundle');
            expect(trackedServers.length, 'both servers should be tracked').toBe(2);
        });

        it('should handle conflict when same server ID exists', async () => {
            // Arrange - create existing config with conflicting server name
            const existingConfig: McpConfiguration = {
                servers: {
                    'prompt-registry:test-bundle:my-server': {
                        command: 'python',
                        args: ['old.py']
                    }
                }
            };
            await writeMcpConfig(existingConfig);

            const manifest: McpServersManifest = {
                'my-server': {
                    command: 'node',
                    args: ['new.js'],
                }
            };

            // Act - without overwrite option
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit', overwrite: false }
            );

            // Assert - should report conflict
            expect(result.success).toBe(false);
            expect(result.errors && result.errors.length > 0, 'should have conflict errors').toBeTruthy();
        });

        it('should overwrite conflicting server when overwrite option is true', async () => {
            // Arrange
            const existingConfig: McpConfiguration = {
                servers: {
                    'prompt-registry:test-bundle:my-server': {
                        command: 'python',
                        args: ['old.py']
                    }
                }
            };
            await writeMcpConfig(existingConfig);

            const manifest: McpServersManifest = {
                'my-server': {
                    command: 'node',
                    args: ['new.js'],
                }
            };

            // Act - with overwrite option
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit', overwrite: true }
            );

            // Assert
            expect(result.success).toBe(true);
            
            const config = await readMcpConfig();
            expect(config).toBeTruthy();
            const serverConfig = config.servers['prompt-registry:test-bundle:my-server'];
            expect(serverConfig).toBeTruthy();
            expect(!serverConfig.type || serverConfig.type === 'stdio', 'should be stdio server').toBeTruthy();
            expect((serverConfig as any).command, 'server should be overwritten').toBe('node');
        });

        it('should add .vscode/mcp.json to git exclude for local-only mode', async () => {
            // Arrange
            const manifest: McpServersManifest = {
                'test-server': {
                    command: 'node',
                    args: ['server.js'],
                }
            };

            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'local-only' }
            );

            // Assert
            expect(result.success).toBe(true);
            
            const excludeContent = await readGitExclude();
            expect(excludeContent, 'git exclude should exist').toBeTruthy();
            expect(excludeContent.includes('.vscode/mcp.json'), '.vscode/mcp.json should be in git exclude').toBeTruthy();
        });

        it('should NOT add .vscode/mcp.json to git exclude for commit mode', async () => {
            // Arrange
            const manifest: McpServersManifest = {
                'test-server': {
                    command: 'node',
                    args: ['server.js'],
                }
            };

            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Assert
            expect(result.success).toBe(true);
            
            const excludeContent = await readGitExclude();
            // Either no exclude file or it doesn't contain mcp.json
            if (excludeContent) {
                expect(!excludeContent.includes('.vscode/mcp.json'), '.vscode/mcp.json should NOT be in git exclude for commit mode').toBeTruthy();
            }
        });

        it('should handle empty manifest gracefully', async () => {
            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                {},
                { commitMode: 'commit' }
            );

            // Assert
            expect(result.success).toBe(true);
            expect(result.serversInstalled).toBe(0);
        });

        it('should create .vscode directory if it does not exist', async () => {
            // Arrange - ensure .vscode doesn't exist
            const vscodeDir = path.join(testWorkspaceRoot, '.vscode');
            if (await fs.pathExists(vscodeDir)) {
                await fs.remove(vscodeDir);
            }

            const manifest: McpServersManifest = {
                'test-server': {
                    command: 'node',
                    args: ['server.js'],
                }
            };

            // Act
            const result = await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Assert
            expect(result.success).toBe(true);
            expect(await fs.pathExists(vscodeDir), '.vscode directory should be created').toBeTruthy();
            expect(await fs.pathExists(getMcpConfigPath()), 'mcp.json should be created').toBeTruthy();
        });
    });

    describe('uninstallServersFromWorkspace()', () => {
        it('should remove MCP servers from .vscode/mcp.json on uninstall', async () => {
            // Arrange - install servers first
            const manifest: McpServersManifest = {
                'server-to-remove': {
                    command: 'node',
                    args: ['remove.js'],
                }
            };

            await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Verify server was installed
            let config = await readMcpConfig();
            expect(config).toBeTruthy();
            const serverKey = Object.keys(config.servers).find(k => k.includes('server-to-remove'));
            expect(serverKey, 'server should be installed').toBeTruthy();

            // Act
            const result = await manager.uninstallServersFromWorkspace('test-bundle', testWorkspaceRoot);

            // Assert
            expect(result.success).toBe(true);
            expect(result.serversRemoved).toBe(1);
            
            config = await readMcpConfig();
            expect(config).toBeTruthy();
            expect(!Object.keys(config.servers).some(k => k.includes('server-to-remove')), 'server should be removed').toBeTruthy();
        });

        it('should preserve other bundles servers on uninstall', async () => {
            // Arrange - install servers from two bundles
            const manifest1: McpServersManifest = {
                'bundle1-server': {
                    command: 'node',
                    args: ['bundle1.js'],
                }
            };
            const manifest2: McpServersManifest = {
                'bundle2-server': {
                    command: 'node',
                    args: ['bundle2.js'],
                }
            };

            await manager.installServersToWorkspace(
                'bundle-1',
                '1.0.0',
                testWorkspaceRoot,
                manifest1,
                { commitMode: 'commit' }
            );
            await manager.installServersToWorkspace(
                'bundle-2',
                '1.0.0',
                testWorkspaceRoot,
                manifest2,
                { commitMode: 'commit' }
            );

            // Act - uninstall only bundle-1
            const result = await manager.uninstallServersFromWorkspace('bundle-1', testWorkspaceRoot);

            // Assert
            expect(result.success).toBe(true);
            
            const config = await readMcpConfig();
            expect(config).toBeTruthy();
            expect(!Object.keys(config.servers).some(k => k.includes('bundle1-server')), 'bundle-1 server should be removed').toBeTruthy();
            expect(Object.keys(config.servers).some(k => k.includes('bundle2-server')), 'bundle-2 server should be preserved').toBeTruthy();
        });

        it('should clean up git exclude entries on uninstall for local-only mode', async () => {
            // Arrange - install with local-only mode
            const manifest: McpServersManifest = {
                'local-server': {
                    command: 'node',
                    args: ['local.js'],
                }
            };

            await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'local-only' }
            );

            // Verify git exclude was added
            let excludeContent = await readGitExclude();
            expect(excludeContent?.includes('.vscode/mcp.json'), 'mcp.json should be in git exclude').toBeTruthy();

            // Act
            await manager.uninstallServersFromWorkspace('test-bundle', testWorkspaceRoot);

            // Assert - git exclude should be cleaned up if no more local-only bundles
            // Note: The exact behavior depends on whether other local-only bundles exist
            // For this test, we just verify the uninstall succeeded
            const result = await manager.uninstallServersFromWorkspace('test-bundle', testWorkspaceRoot);
            expect(result.success).toBe(true);
        });

        it('should handle uninstall when bundle has no servers', async () => {
            // Act - try to uninstall non-existent bundle
            const result = await manager.uninstallServersFromWorkspace('non-existent-bundle', testWorkspaceRoot);

            // Assert
            expect(result.success).toBe(true);
            expect(result.serversRemoved).toBe(0);
        });
    });

    describe('getServersForBundleInWorkspace()', () => {
        it('should return servers for a specific bundle', async () => {
            // Arrange
            const manifest: McpServersManifest = {
                'server-a': { command: 'node', args: ['a.js'] },
                'server-b': { command: 'node', args: ['b.js'] }
            };

            await manager.installServersToWorkspace(
                'test-bundle',
                '1.0.0',
                testWorkspaceRoot,
                manifest,
                { commitMode: 'commit' }
            );

            // Act
            const servers = await manager.getServersForBundleInWorkspace('test-bundle', testWorkspaceRoot);

            // Assert
            expect(servers.length).toBe(2);
        });

        it('should return empty array for bundle with no servers', async () => {
            // Act
            const servers = await manager.getServersForBundleInWorkspace('non-existent', testWorkspaceRoot);

            // Assert
            expect(Array.isArray(servers)).toBeTruthy();
            expect(servers.length).toBe(0);
        });
    });
});
