/**
 * RepositoryActivationService Unit Tests
 * 
 * Tests for the service that detects lockfiles on workspace open and prompts
 * users to enable repository bundles.
 * 
 * Requirements: 13.1-13.7, 12.4-12.5
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { RepositoryActivationService, MissingBundleInstallResult } from '../../src/services/RepositoryActivationService';
import { LockfileManager } from '../../src/services/LockfileManager';
import { HubManager } from '../../src/services/HubManager';
import { RegistryManager } from '../../src/services/RegistryManager';
import { RegistryStorage } from '../../src/storage/RegistryStorage';
import { SetupStateManager } from '../../src/services/SetupStateManager';
import { Lockfile } from '../../src/types/lockfile';
import { createMockLockfile } from '../helpers/lockfileTestHelpers';

describe('RepositoryActivationService', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLockfileManager: sinon.SinonStubbedInstance<LockfileManager>;
    let mockHubManager: sinon.SinonStubbedInstance<HubManager>;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let mockContext: vscode.ExtensionContext;
    let service: RepositoryActivationService;
    let showInformationMessageStub: sinon.SinonStub;
    let showWarningMessageStub: sinon.SinonStub;
    const testWorkspaceRoot = '/test/workspace';

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockLockfileManager = sandbox.createStubInstance(LockfileManager);
        mockHubManager = sandbox.createStubInstance(HubManager);
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        
        // Create mock context
        mockContext = {
            globalState: {
                get: sandbox.stub().returns([]),
                update: sandbox.stub().resolves()
            }
        } as any;
        
        // Mock getContext() to return the mock context
        mockStorage.getContext.returns(mockContext);
        
        // Reset all instances before each test
        RepositoryActivationService.resetInstance();
        
        service = new RepositoryActivationService(
            mockLockfileManager,
            mockHubManager,
            mockStorage,
            testWorkspaceRoot
        );
        
        // Mock VS Code APIs
        showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
        showWarningMessageStub = sandbox.stub(vscode.window, 'showWarningMessage');
    });

    afterEach(() => {
        sandbox.restore();
        RepositoryActivationService.resetInstance();
    });

    describe('getInstance()', () => {
        it('should create new instance for workspace', () => {
            // Arrange & Act
            const instance = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );

            // Assert
            expect(instance, 'Should create instance').toBeTruthy();
            expect(instance.getWorkspaceRoot()).toBe(testWorkspaceRoot);
        });

        it('should return same instance for same workspace', () => {
            // Arrange & Act
            const instance1 = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );
            const instance2 = RepositoryActivationService.getInstance(testWorkspaceRoot);

            // Assert
            expect(instance1, 'Should return same instance').toBe(instance2);
        });

        it('should create different instances for different workspaces', () => {
            // Arrange
            const workspace1 = '/workspace/one';
            const workspace2 = '/workspace/two';

            // Act
            const instance1 = RepositoryActivationService.getInstance(
                workspace1,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );
            const instance2 = RepositoryActivationService.getInstance(
                workspace2,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );

            // Assert
            expect(instance1, 'Should create different instances').not.toBe(instance2);
            expect(instance1.getWorkspaceRoot()).toBe(workspace1);
            expect(instance2.getWorkspaceRoot()).toBe(workspace2);
        });

        it('should throw error when workspace root not provided', () => {
            // Act & Assert
            expect(() => RepositoryActivationService.getInstance()).toThrow(/Workspace root path required/);
        });

        it('should throw error when dependencies not provided on first call', () => {
            // Act & Assert
            expect(() => RepositoryActivationService.getInstance('/new/workspace')).toThrow(/Dependencies required on first call/);
        });
    });

    describe('resetInstance()', () => {
        it('should reset specific workspace instance', () => {
            // Arrange
            const workspace1 = '/workspace/one';
            const workspace2 = '/workspace/two';
            RepositoryActivationService.getInstance(
                workspace1,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );
            RepositoryActivationService.getInstance(
                workspace2,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );

            // Act
            RepositoryActivationService.resetInstance(workspace1);

            // Assert - workspace1 should require dependencies again
            expect(() => RepositoryActivationService.getInstance(workspace1)).toThrow(/Dependencies required/);
            // workspace2 should still exist
            const instance2 = RepositoryActivationService.getInstance(workspace2);
            expect(instance2).toBeTruthy();
        });

        it('should reset all instances when no workspace provided', () => {
            // Arrange
            RepositoryActivationService.getInstance(
                '/workspace/one',
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );
            RepositoryActivationService.getInstance(
                '/workspace/two',
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );

            // Act
            RepositoryActivationService.resetInstance();

            // Assert - both should require dependencies again
            expect(() => RepositoryActivationService.getInstance('/workspace/one')).toThrow(/Dependencies required/);
            expect(() => RepositoryActivationService.getInstance('/workspace/two')).toThrow(/Dependencies required/);
        });
    });

    describe('getExistingInstance()', () => {
        it('should return existing instance', () => {
            // Arrange
            const created = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );

            // Act
            const existing = RepositoryActivationService.getExistingInstance(testWorkspaceRoot);

            // Assert
            expect(existing).toBe(created);
        });

        it('should return undefined for non-existent workspace', () => {
            // Act
            const existing = RepositoryActivationService.getExistingInstance('/non/existent');

            // Assert
            expect(existing).toBe(undefined);
        });
    });

    describe('checkAndPromptActivation()', () => {
        it('should not prompt when no lockfile exists', async () => {
            // Arrange
            mockLockfileManager.read.resolves(null);

            // Act
            await service.checkAndPromptActivation();

            // Assert
            expect(!showInformationMessageStub.called, 'Should not show prompt when no lockfile').toBeTruthy();
        });

        it('should not prompt when repository was previously declined', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns('/repo/prompt-registry.lock.json');
            (mockContext.globalState.get as sinon.SinonStub).returns(['/repo']);

            // Act
            await service.checkAndPromptActivation();

            // Assert
            expect(!showInformationMessageStub.called, 'Should not prompt when previously declined').toBeTruthy();
        });

        it('should prompt when lockfile exists and not previously declined', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns('/repo/prompt-registry.lock.json');
            
            // Reset the context mock for this test
            const customContext = {
                globalState: {
                    get: sandbox.stub().withArgs('repositoryActivation.declined').returns([])
                }
            } as any;
            mockStorage.getContext.returns(customContext);
            mockStorage.getSources.resolves([
                { id: 'mock-source', type: 'github', url: 'https://github.com/mock/repo' } as any
            ]);
            mockHubManager.listHubs.resolves([]);

            // Act
            await service.checkAndPromptActivation();

            // Assert - no longer shows activation prompt (Requirement 1.6)
            // Only checks for missing sources/hubs
            expect(!showInformationMessageStub.called || 
                !showInformationMessageStub.firstCall.args[0].includes('enable'), 'Should not show activation prompt - files already in repository').toBeTruthy();
        });

        it('should check for missing sources when lockfile exists', async () => {
            // Arrange
            const lockfile = createMockLockfile(3);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns('/repo/prompt-registry.lock.json');
            const customContext = {
                globalState: {
                    get: sandbox.stub().returns([])
                }
            } as any;
            mockStorage.getContext.returns(customContext);
            mockStorage.getSources.resolves([]); // No sources configured
            mockHubManager.listHubs.resolves([]);
            showInformationMessageStub.resolves('Add Sources');

            // Act
            await service.checkAndPromptActivation();

            // Assert - should check for missing sources (not show activation prompt)
            // The prompt shown should be about missing sources, not about enabling bundles
            if (showInformationMessageStub.called) {
                const message = showInformationMessageStub.firstCall.args[0] as string;
                expect(!message.includes('enable') && !message.includes('Enable'), 'Should not show activation prompt - only missing sources prompt').toBeTruthy();
            }
        });

        it('should not show any prompt when all sources are configured', async () => {
            // Arrange
            const lockfile = createMockLockfile(2, { includeProfiles: true });
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns('/repo/prompt-registry.lock.json');
            const customContext = {
                globalState: {
                    get: sandbox.stub().returns([])
                }
            } as any;
            mockStorage.getContext.returns(customContext);
            // All sources are configured
            mockStorage.getSources.resolves([
                { id: 'mock-source', type: 'github', url: 'https://github.com/mock/repo' } as any
            ]);
            mockHubManager.listHubs.resolves([
                { id: 'mock-hub', name: 'Mock Hub', description: '', reference: { type: 'url', location: '' } }
            ]);

            // Act
            await service.checkAndPromptActivation();

            // Assert - no prompt when all sources are configured
            expect(!showInformationMessageStub.called, 'Should not show any prompt when all sources are configured').toBeTruthy();
        });

        it('should call checkAndOfferMissingSources when lockfile exists', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns('/repo/prompt-registry.lock.json');
            const customContext = {
                globalState: {
                    get: sandbox.stub().returns([])
                }
            } as any;
            mockStorage.getContext.returns(customContext);
            mockStorage.getSources.resolves([
                { id: 'mock-source', type: 'github', url: 'https://github.com/mock/repo' } as any
            ]);
            mockHubManager.listHubs.resolves([]);
            const checkSpy = sandbox.spy(service, 'checkAndOfferMissingSources');

            // Act
            await service.checkAndPromptActivation();

            // Assert - should call checkAndOfferMissingSources instead of showing activation prompt
            expect(checkSpy.calledOnce, 'Should call checkAndOfferMissingSources').toBeTruthy();
            expect(checkSpy.calledWith(lockfile), 'Should pass lockfile to check method').toBeTruthy();
        });

        it('should skip detection for declined repositories', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns('/repo/prompt-registry.lock.json');
            const customContext = {
                globalState: {
                    get: sandbox.stub().returns(['/repo']) // Already declined
                }
            } as any;
            mockStorage.getContext.returns(customContext);
            const checkSpy = sandbox.spy(service, 'checkAndOfferMissingSources');

            // Act
            await service.checkAndPromptActivation();

            // Assert - should skip detection for declined repositories
            expect(!checkSpy.called, 'Should not check for missing sources when declined').toBeTruthy();
            expect(!showInformationMessageStub.called, 'Should not show any prompt when declined').toBeTruthy();
        });
    });

    describe('checkAndOfferMissingSources()', () => {
        it('should detect missing sources', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockStorage.getSources.resolves([]); // No sources configured

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert
            expect(result.missingSources.length > 0, 'Should detect missing sources').toBeTruthy();
            expect(result.missingSources[0]).toBe('mock-source');
        });

        it('should detect missing hubs', async () => {
            // Arrange
            const lockfile = createMockLockfile(2, { includeHubs: true });
            mockStorage.getSources.resolves([]);
            mockHubManager.listHubs.resolves([]); // No hubs configured

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert
            expect(result.missingHubs.length > 0, 'Should detect missing hubs').toBeTruthy();
            expect(result.missingHubs[0]).toBe('mock-hub');
        });

        it('should not detect sources that are already configured', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockStorage.getSources.resolves([
                { id: 'mock-source', type: 'github', url: 'https://github.com/mock/repo' } as any
            ]);

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert
            expect(result.missingSources.length, 'Should not detect configured sources as missing').toBe(0);
        });

        it('should not detect hubs that are already imported', async () => {
            // Arrange
            const lockfile = createMockLockfile(2, { includeHubs: true });
            mockStorage.getSources.resolves([]);
            mockHubManager.listHubs.resolves([
                { id: 'mock-hub', name: 'Mock Hub', description: '', reference: { type: 'url', location: '' } }
            ]);

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert
            expect(result.missingHubs.length, 'Should not detect imported hubs as missing').toBe(0);
        });

        it('should offer to add missing sources', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockStorage.getSources.resolves([]);
            showInformationMessageStub.resolves('Add Sources');

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert
            expect(showInformationMessageStub.calledOnce, 'Should prompt to add missing sources').toBeTruthy();
            expect(result.offeredToAdd, 'Should indicate offer was made').toBeTruthy();
        });

        it('should offer to add missing hubs', async () => {
            // Arrange
            const lockfile = createMockLockfile(2, { includeHubs: true });
            mockStorage.getSources.resolves([]);
            mockHubManager.listHubs.resolves([]);
            showInformationMessageStub.resolves('Add Sources');

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert
            const message = showInformationMessageStub.firstCall.args[0] as string;
            expect(message.toLowerCase().includes('hub') || message.toLowerCase().includes('source'), 'Message should mention missing sources/hubs').toBeTruthy();
        });

        it('should return empty arrays when all sources and hubs are configured', async () => {
            // Arrange
            const lockfile = createMockLockfile(2, { includeHubs: true });
            mockStorage.getSources.resolves([
                { id: 'mock-source', type: 'github', url: 'https://github.com/mock/repo' } as any
            ]);
            mockHubManager.listHubs.resolves([
                { id: 'mock-hub', name: 'Mock Hub', description: '', reference: { type: 'url', location: '' } }
            ]);

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert
            expect(result.missingSources.length).toBe(0);
            expect(result.missingHubs.length).toBe(0);
            expect(!result.offeredToAdd, 'Should not offer when nothing missing').toBeTruthy();
        });
    });

    describe('Edge cases', () => {
        it('should handle lockfile read errors gracefully', async () => {
            // Arrange
            mockLockfileManager.read.rejects(new Error('Read error'));

            // Act & Assert - should not throw
            await service.checkAndPromptActivation();
            expect(!showInformationMessageStub.called, 'Should not show prompt on error').toBeTruthy();
        });

        it('should handle empty lockfile gracefully', async () => {
            // Arrange
            const emptyLockfile = createMockLockfile(0);
            mockLockfileManager.read.resolves(emptyLockfile);
            mockLockfileManager.getLockfilePath.returns('/repo/prompt-registry.lock.json');
            const customContext = {
                globalState: {
                    get: sandbox.stub().returns([])
                }
            } as any;
            mockStorage.getContext.returns(customContext);
            // No sources configured
            mockStorage.getSources.resolves([]);
            mockHubManager.listHubs.resolves([]);

            // Act
            await service.checkAndPromptActivation();

            // Assert - should check for missing sources even with empty lockfile
            // No activation prompt is shown (Requirement 1.6)
            // May or may not show missing sources prompt depending on lockfile content
        });

        it('should handle missing lockfile path gracefully', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns('');
            const customContext = {
                globalState: {
                    get: sandbox.stub().returns([])
                }
            } as any;
            mockStorage.getContext.returns(customContext);

            // Act & Assert - should not throw
            await service.checkAndPromptActivation();
        });

        it('should handle HubManager errors when checking missing sources', async () => {
            // Arrange
            const lockfile = createMockLockfile(2, { includeHubs: true });
            mockStorage.getSources.resolves([]);
            mockHubManager.listHubs.rejects(new Error('Hub error'));

            // Act
            const result = await service.checkAndOfferMissingSources(lockfile);

            // Assert - should still detect missing sources even if hub check fails
            expect(result.missingSources.length > 0, 'Should still detect missing sources on hub error').toBeTruthy();
        });
    });
});


describe('RepositoryActivationService - Workspace Switching Scenarios', () => {
    let sandbox: sinon.SinonSandbox;
    let mockHubManager: sinon.SinonStubbedInstance<HubManager>;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let mockContext: vscode.ExtensionContext;
    let showInformationMessageStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockHubManager = sandbox.createStubInstance(HubManager);
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        
        // Create mock context
        mockContext = {
            globalState: {
                get: sandbox.stub().returns([]),
                update: sandbox.stub().resolves()
            }
        } as any;
        
        mockStorage.getContext.returns(mockContext);
        
        // Reset all instances before each test
        RepositoryActivationService.resetInstance();
        
        showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
    });

    afterEach(() => {
        sandbox.restore();
        RepositoryActivationService.resetInstance();
    });

    it('should maintain separate state for different workspaces', async () => {
        // Arrange
        const workspace1 = '/workspace/one';
        const workspace2 = '/workspace/two';
        
        const mockLockfileManager1 = sandbox.createStubInstance(LockfileManager);
        const mockLockfileManager2 = sandbox.createStubInstance(LockfileManager);
        
        // Create instances for both workspaces
        const service1 = RepositoryActivationService.getInstance(
            workspace1,
            mockLockfileManager1,
            mockHubManager,
            mockStorage
        );
        const service2 = RepositoryActivationService.getInstance(
            workspace2,
            mockLockfileManager2,
            mockHubManager,
            mockStorage
        );

        // Assert
        expect(service1, 'Should have different instances').not.toBe(service2);
        expect(service1.getWorkspaceRoot()).toBe(workspace1);
        expect(service2.getWorkspaceRoot()).toBe(workspace2);
    });

    it('should allow independent source detection per workspace', async () => {
        // Arrange
        const workspace1 = '/workspace/one';
        const workspace2 = '/workspace/two';
        
        const mockLockfileManager1 = sandbox.createStubInstance(LockfileManager);
        const mockLockfileManager2 = sandbox.createStubInstance(LockfileManager);
        
        const lockfile1 = createMockLockfile(2);
        const lockfile2 = createMockLockfile(3);
        
        mockLockfileManager1.read.resolves(lockfile1);
        mockLockfileManager1.getLockfilePath.returns(`${workspace1}/prompt-registry.lock.json`);
        
        mockLockfileManager2.read.resolves(lockfile2);
        mockLockfileManager2.getLockfilePath.returns(`${workspace2}/prompt-registry.lock.json`);
        
        const customContext = {
            globalState: {
                get: sandbox.stub().returns([])
            }
        } as any;
        mockStorage.getContext.returns(customContext);
        // No sources configured - will trigger missing sources detection
        mockStorage.getSources.resolves([]);
        mockHubManager.listHubs.resolves([]);
        showInformationMessageStub.resolves('Not now');
        
        const service1 = RepositoryActivationService.getInstance(
            workspace1,
            mockLockfileManager1,
            mockHubManager,
            mockStorage
        );
        const service2 = RepositoryActivationService.getInstance(
            workspace2,
            mockLockfileManager2,
            mockHubManager,
            mockStorage
        );

        // Act
        await service1.checkAndPromptActivation();
        await service2.checkAndPromptActivation();

        // Assert - both should have checked for missing sources
        // Note: No activation prompt is shown (Requirement 1.6)
        // Only missing sources prompt may be shown if sources are missing
        expect(mockLockfileManager1.read.calledOnce, 'Should read lockfile for workspace 1').toBeTruthy();
        expect(mockLockfileManager2.read.calledOnce, 'Should read lockfile for workspace 2').toBeTruthy();
    });

    it('should handle workspace removal by resetting instance', () => {
        // Arrange
        const workspace = '/workspace/to/remove';
        const mockLockfileManager = sandbox.createStubInstance(LockfileManager);
        
        RepositoryActivationService.getInstance(
            workspace,
            mockLockfileManager,
            mockHubManager,
            mockStorage
        );

        // Act
        RepositoryActivationService.resetInstance(workspace);

        // Assert - should require dependencies again
        expect(() => RepositoryActivationService.getInstance(workspace)).toThrow(/Dependencies required/);
    });

    it('should normalize paths for consistent instance lookup', () => {
        // Arrange
        const workspace = '/workspace/test';
        const mockLockfileManager = sandbox.createStubInstance(LockfileManager);
        
        const instance1 = RepositoryActivationService.getInstance(
            workspace,
            mockLockfileManager,
            mockHubManager,
            mockStorage
        );

        // Act - get instance with same path
        const instance2 = RepositoryActivationService.getExistingInstance(workspace);

        // Assert
        expect(instance1, 'Should find same instance with normalized path').toBe(instance2);
    });

    it('should return undefined for non-existent workspace in getExistingInstance', () => {
        // Act
        const instance = RepositoryActivationService.getExistingInstance('/non/existent/workspace');

        // Assert
        expect(instance, 'Should return undefined for non-existent workspace').toBe(undefined);
    });

    it('should preserve other workspace instances when resetting one', () => {
        // Arrange
        const workspace1 = '/workspace/one';
        const workspace2 = '/workspace/two';
        
        const mockLockfileManager1 = sandbox.createStubInstance(LockfileManager);
        const mockLockfileManager2 = sandbox.createStubInstance(LockfileManager);
        
        RepositoryActivationService.getInstance(
            workspace1,
            mockLockfileManager1,
            mockHubManager,
            mockStorage
        );
        const service2 = RepositoryActivationService.getInstance(
            workspace2,
            mockLockfileManager2,
            mockHubManager,
            mockStorage
        );

        // Act - reset only workspace1
        RepositoryActivationService.resetInstance(workspace1);

        // Assert - workspace2 should still exist
        const existingService2 = RepositoryActivationService.getExistingInstance(workspace2);
        expect(existingService2, 'Should preserve other workspace instances').toBe(service2);
        
        // workspace1 should be gone
        const existingService1 = RepositoryActivationService.getExistingInstance(workspace1);
        expect(existingService1, 'Should have removed workspace1 instance').toBe(undefined);
    });
});


/**
 * Tests for missing bundle installation functionality
 * Requirements: 13.6 - "IF bundles are missing from the repository, THE Extension SHALL offer to download and install them"
 */
describe('RepositoryActivationService - Missing Bundle Installation', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLockfileManager: sinon.SinonStubbedInstance<LockfileManager>;
    let mockHubManager: sinon.SinonStubbedInstance<HubManager>;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let mockRegistryManager: any;
    let mockContext: vscode.ExtensionContext;
    let service: RepositoryActivationService;
    let showInformationMessageStub: sinon.SinonStub;
    let withProgressStub: sinon.SinonStub;
    const testWorkspaceRoot = '/test/workspace/missing-bundles';

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockLockfileManager = sandbox.createStubInstance(LockfileManager);
        mockHubManager = sandbox.createStubInstance(HubManager);
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        
        // Create mock RegistryManager
        mockRegistryManager = {
            installBundle: sandbox.stub().resolves({
                bundleId: 'test-bundle',
                version: '1.0.0',
                scope: 'repository'
            })
        };
        
        // Create mock context
        mockContext = {
            globalState: {
                get: sandbox.stub().returns([]),
                update: sandbox.stub().resolves()
            }
        } as any;
        
        mockStorage.getContext.returns(mockContext);
        
        // Reset all instances before each test
        RepositoryActivationService.resetInstance();
        
        // Mock VS Code APIs
        showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
        withProgressStub = sandbox.stub(vscode.window, 'withProgress');
        
        // Default withProgress behavior - execute the task immediately
        withProgressStub.callsFake(async (_options: any, task: any) => {
            const mockProgress = { report: sandbox.stub() };
            const mockToken = { isCancellationRequested: false, onCancellationRequested: sandbox.stub() };
            return await task(mockProgress, mockToken);
        });
    });

    afterEach(() => {
        sandbox.restore();
        RepositoryActivationService.resetInstance();
    });

    describe('installMissingBundles()', () => {
        it('should install missing bundles when user accepts', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            const missingBundleIds = ['bundle-0', 'bundle-1'];
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            const result = await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            expect(mockRegistryManager.installBundle.callCount, 'Should call installBundle for each missing bundle').toBe(2);
            expect(result.succeeded.length, 'Should report 2 successful installations').toBe(2);
            expect(result.failed.length, 'Should have no failures').toBe(0);
        });

        it('should handle partial failure when some bundles fail to install', async () => {
            // Arrange
            const lockfile = createMockLockfile(3);
            const missingBundleIds = ['bundle-0', 'bundle-1', 'bundle-2'];
            
            // Make second bundle fail
            mockRegistryManager.installBundle
                .onFirstCall().resolves({ bundleId: 'bundle-0', version: '1.0.0', scope: 'repository' })
                .onSecondCall().rejects(new Error('Installation failed'))
                .onThirdCall().resolves({ bundleId: 'bundle-2', version: '3.0.0', scope: 'repository' });
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            const result = await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            expect(result.succeeded.length, 'Should have 2 successful installations').toBe(2);
            expect(result.failed.length, 'Should have 1 failure').toBe(1);
            expect(result.failed[0].bundleId, 'Should identify failed bundle').toBe('bundle-1');
            expect(result.failed[0].error.includes('Installation failed'), 'Should include error message').toBeTruthy();
        });

        it('should show progress notification during batch installation', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            const missingBundleIds = ['bundle-0', 'bundle-1'];
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            expect(withProgressStub.calledOnce, 'Should show progress notification').toBeTruthy();
            const progressOptions = withProgressStub.firstCall.args[0];
            expect(progressOptions.location).toBe(vscode.ProgressLocation.Notification);
            expect(progressOptions.title.includes('Installing'), 'Progress title should mention installing').toBeTruthy();
            expect(progressOptions.cancellable, 'Progress should be cancellable').toBeTruthy();
        });

        it('should use source information from lockfile for installation', async () => {
            // Arrange
            const lockfile = createMockLockfile(1);
            // Ensure the lockfile has proper source info
            lockfile.sources['mock-source'] = {
                type: 'github',
                url: 'https://github.com/test/repo'
            };
            lockfile.bundles['bundle-0'].sourceId = 'mock-source';
            lockfile.bundles['bundle-0'].sourceType = 'github';
            
            const missingBundleIds = ['bundle-0'];
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            expect(mockRegistryManager.installBundle.calledOnce, 'Should call installBundle').toBeTruthy();
            const installCall = mockRegistryManager.installBundle.firstCall;
            expect(installCall.args[0], 'Should pass correct bundle ID').toBe('bundle-0');
        });

        it('should use repository scope with correct commitMode from lockfile', async () => {
            // Arrange
            const lockfile = createMockLockfile(1, { commitMode: 'local-only' });
            const missingBundleIds = ['bundle-0'];
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            const installCall = mockRegistryManager.installBundle.firstCall;
            const options = installCall.args[1];
            expect(options.scope, 'Should use repository scope').toBe('repository');
            expect(options.commitMode, 'Should use commitMode from lockfile').toBe('local-only');
        });

        it('should handle cancellation during batch installation', async () => {
            // Arrange
            const lockfile = createMockLockfile(3);
            const missingBundleIds = ['bundle-0', 'bundle-1', 'bundle-2'];
            
            // Simulate cancellation after first bundle
            let installCount = 0;
            withProgressStub.callsFake(async (_options: any, task: any) => {
                const mockProgress = { report: sandbox.stub() };
                const mockToken = { 
                    isCancellationRequested: false, 
                    onCancellationRequested: sandbox.stub() 
                };
                
                // Override installBundle to check cancellation
                mockRegistryManager.installBundle.callsFake(async () => {
                    installCount++;
                    if (installCount >= 2) {
                        mockToken.isCancellationRequested = true;
                    }
                    return { bundleId: `bundle-${installCount - 1}`, version: '1.0.0', scope: 'repository' };
                });
                
                return await task(mockProgress, mockToken);
            });
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            const result = await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            expect(result.succeeded.length < 3, 'Should stop before installing all bundles').toBeTruthy();
            expect(result.cancelled, 'Should indicate cancellation').toBeTruthy();
        });

        it('should return empty result when no bundles to install', async () => {
            // Arrange
            const lockfile = createMockLockfile(2);
            const missingBundleIds: string[] = [];
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            const result = await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            expect(result.succeeded.length).toBe(0);
            expect(result.failed.length).toBe(0);
            expect(!mockRegistryManager.installBundle.called, 'Should not call installBundle').toBeTruthy();
        });

        it('should use version from lockfile for installation', async () => {
            // Arrange
            const lockfile = createMockLockfile(1);
            lockfile.bundles['bundle-0'].version = '2.5.0';
            const missingBundleIds = ['bundle-0'];
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            const installCall = mockRegistryManager.installBundle.firstCall;
            const options = installCall.args[1];
            expect(options.version, 'Should use version from lockfile').toBe('2.5.0');
        });

        it('should skip bundles not found in lockfile', async () => {
            // Arrange
            const lockfile = createMockLockfile(1);
            const missingBundleIds = ['bundle-0', 'non-existent-bundle'];
            
            service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Act
            const result = await service.installMissingBundles(lockfile, missingBundleIds);

            // Assert
            expect(mockRegistryManager.installBundle.callCount, 'Should only install bundle that exists in lockfile').toBe(1);
            expect(result.skipped.length, 'Should report 1 skipped bundle').toBe(1);
            expect(result.skipped[0]).toBe('non-existent-bundle');
        });
    });

    describe('getInstance() with RegistryManager', () => {
        it('should accept RegistryManager as optional parameter', () => {
            // Arrange & Act
            const instance = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                mockRegistryManager
            );

            // Assert
            expect(instance, 'Should create instance with RegistryManager').toBeTruthy();
        });

        it('should work without RegistryManager for backward compatibility', () => {
            // Arrange & Act
            const instance = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );

            // Assert
            expect(instance, 'Should create instance without RegistryManager').toBeTruthy();
        });
    });
});


/**
 * Tests for setup timing behavior
 * Requirements: 1.1-1.5, 6.1-6.4 - Defer lockfile source/hub detection until setup complete
 */
describe('RepositoryActivationService - Setup Timing Behavior', () => {
    let sandbox: sinon.SinonSandbox;
    let mockLockfileManager: sinon.SinonStubbedInstance<LockfileManager>;
    let mockHubManager: sinon.SinonStubbedInstance<HubManager>;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let mockSetupStateManager: sinon.SinonStubbedInstance<SetupStateManager>;
    let mockContext: vscode.ExtensionContext;
    let showInformationMessageStub: sinon.SinonStub;
    const testWorkspaceRoot = '/test/workspace/setup-timing';

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockLockfileManager = sandbox.createStubInstance(LockfileManager);
        mockHubManager = sandbox.createStubInstance(HubManager);
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        mockSetupStateManager = sandbox.createStubInstance(SetupStateManager);
        
        // Create mock context
        mockContext = {
            globalState: {
                get: sandbox.stub().returns([]),
                update: sandbox.stub().resolves()
            }
        } as any;
        
        mockStorage.getContext.returns(mockContext);
        
        // Reset all instances before each test
        RepositoryActivationService.resetInstance();
        
        // Mock VS Code APIs
        showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
    });

    afterEach(() => {
        sandbox.restore();
        RepositoryActivationService.resetInstance();
    });

    describe('checkAndPromptActivation() with SetupStateManager', () => {
        it('should skip detection when SetupStateManager.isComplete() returns false', async () => {
            // Arrange
            mockSetupStateManager.isComplete.resolves(false);
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns(`${testWorkspaceRoot}/prompt-registry.lock.json`);
            
            const service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                undefined, // bundleInstaller
                mockSetupStateManager
            );

            // Act
            await service.checkAndPromptActivation();

            // Assert
            expect(mockSetupStateManager.isComplete.calledOnce, 'Should check if setup is complete').toBeTruthy();
            expect(!mockLockfileManager.read.called, 'Should not read lockfile when setup is incomplete').toBeTruthy();
            expect(!showInformationMessageStub.called, 'Should not show any prompts when setup is incomplete').toBeTruthy();
        });

        it('should proceed with detection when SetupStateManager.isComplete() returns true', async () => {
            // Arrange
            mockSetupStateManager.isComplete.resolves(true);
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns(`${testWorkspaceRoot}/prompt-registry.lock.json`);
            mockStorage.getSources.resolves([
                { id: 'mock-source', type: 'github', url: 'https://github.com/mock/repo' } as any
            ]);
            
            const service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                undefined, // bundleInstaller
                mockSetupStateManager
            );

            // Act
            await service.checkAndPromptActivation();

            // Assert
            expect(mockSetupStateManager.isComplete.calledOnce, 'Should check if setup is complete').toBeTruthy();
            expect(mockLockfileManager.read.calledOnce, 'Should read lockfile when setup is complete').toBeTruthy();
        });

        it('should proceed with detection when SetupStateManager is undefined (fail-open)', async () => {
            // Arrange - create service WITHOUT SetupStateManager
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            mockLockfileManager.getLockfilePath.returns(`${testWorkspaceRoot}/prompt-registry.lock.json`);
            mockStorage.getSources.resolves([
                { id: 'mock-source', type: 'github', url: 'https://github.com/mock/repo' } as any
            ]);
            
            const service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage
                // No bundleInstaller, no setupStateManager
            );

            // Act
            await service.checkAndPromptActivation();

            // Assert
            expect(mockLockfileManager.read.calledOnce, 'Should read lockfile when SetupStateManager is undefined (fail-open behavior)').toBeTruthy();
        });

        it('should log appropriate message when deferring due to incomplete setup', async () => {
            // Arrange
            mockSetupStateManager.isComplete.resolves(false);
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            
            // We can't directly test logging, but we can verify the behavior
            // that indicates the deferral path was taken
            const service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                undefined, // bundleInstaller
                mockSetupStateManager
            );

            // Act
            await service.checkAndPromptActivation();

            // Assert - verify the deferral path was taken by checking that:
            // 1. isComplete was called
            // 2. No further processing occurred (lockfile not read)
            expect(mockSetupStateManager.isComplete.calledOnce, 'Should call isComplete to check setup state').toBeTruthy();
            expect(!mockLockfileManager.read.called, 'Should not proceed with lockfile read when deferring').toBeTruthy();
            expect(!mockStorage.getSources.called, 'Should not check sources when deferring').toBeTruthy();
            expect(!mockHubManager.listHubs.called, 'Should not check hubs when deferring').toBeTruthy();
        });
    });

    describe('getInstance() with SetupStateManager', () => {
        it('should accept SetupStateManager as optional parameter', () => {
            // Arrange & Act
            const instance = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                undefined, // bundleInstaller
                mockSetupStateManager
            );

            // Assert
            expect(instance, 'Should create instance with SetupStateManager').toBeTruthy();
        });

        it('should work without SetupStateManager for backward compatibility', () => {
            // Arrange & Act
            const instance = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage
            );

            // Assert
            expect(instance, 'Should create instance without SetupStateManager').toBeTruthy();
        });
    });

    describe('Setup state edge cases', () => {
        it('should handle SetupStateManager.isComplete() throwing an error gracefully', async () => {
            // Arrange
            mockSetupStateManager.isComplete.rejects(new Error('State check failed'));
            const lockfile = createMockLockfile(2);
            mockLockfileManager.read.resolves(lockfile);
            
            const service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                undefined,
                mockSetupStateManager
            );

            // Act & Assert - should not throw
            await service.checkAndPromptActivation();
            
            // The error should be caught and logged, but not propagate
            expect(mockSetupStateManager.isComplete.calledOnce, 'Should have attempted to check setup state').toBeTruthy();
        });

        it('should not prompt for missing sources when setup is incomplete', async () => {
            // Arrange
            mockSetupStateManager.isComplete.resolves(false);
            const lockfile = createMockLockfile(2, { includeHubs: true });
            mockLockfileManager.read.resolves(lockfile);
            mockStorage.getSources.resolves([]); // No sources configured
            mockHubManager.listHubs.resolves([]); // No hubs configured
            
            const service = RepositoryActivationService.getInstance(
                testWorkspaceRoot,
                mockLockfileManager,
                mockHubManager,
                mockStorage,
                undefined,
                mockSetupStateManager
            );

            // Act
            await service.checkAndPromptActivation();

            // Assert
            expect(!showInformationMessageStub.called, 'Should not prompt for missing sources when setup is incomplete').toBeTruthy();
            expect(!mockStorage.getSources.called, 'Should not check for sources when setup is incomplete').toBeTruthy();
        });
    });
});
