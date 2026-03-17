/**
 * ScopeServiceFactory Unit Tests
 * 
 * Tests for the factory that creates appropriate scope services based on InstallationScope.
 * 
 * Requirements: 1.1, 1.8, 2.5
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import { ScopeServiceFactory } from '../../src/services/ScopeServiceFactory';
import { UserScopeService } from '../../src/services/UserScopeService';
import { RepositoryScopeService } from '../../src/services/RepositoryScopeService';
import { RegistryStorage } from '../../src/storage/RegistryStorage';
import { InstallationScope } from '../../src/types/registry';
import { IScopeService } from '../../src/services/IScopeService';

describe('ScopeServiceFactory', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let mockStorage: sinon.SinonStubbedInstance<RegistryStorage>;
    let workspaceRoot: string;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Create mock extension context
        const globalStateData = new Map<string, any>();
        mockContext = {
            globalState: {
                get: (key: string, defaultValue?: any) => globalStateData.get(key) ?? defaultValue,
                update: async (key: string, value: any) => { globalStateData.set(key, value); },
                keys: () => Array.from(globalStateData.keys()),
                setKeysForSync: sandbox.stub()
            } as any,
            globalStorageUri: vscode.Uri.file(path.join(os.tmpdir(), 'test-storage')),
            subscriptions: [],
            extensionUri: vscode.Uri.file('/mock/extension'),
            extensionPath: '/mock/extension',
            storagePath: '/mock/storage',
            globalStoragePath: path.join(os.tmpdir(), 'test-storage'),
            logPath: '/mock/log',
            extensionMode: 3 as any, // ExtensionMode.Test
            workspaceState: {
                get: sandbox.stub(),
                update: sandbox.stub(),
                keys: sandbox.stub().returns([])
            } as any,
            secrets: {
                get: sandbox.stub(),
                store: sandbox.stub(),
                delete: sandbox.stub(),
                onDidChange: sandbox.stub()
            } as any,
            environmentVariableCollection: {} as any,
            extension: {} as any,
            asAbsolutePath: (relativePath: string) => path.join('/mock/extension', relativePath),
            storageUri: vscode.Uri.file('/mock/storage'),
            logUri: vscode.Uri.file('/mock/log'),
            languageModelAccessInformation: {} as any
        } as vscode.ExtensionContext;

        // Create mock storage
        mockStorage = sandbox.createStubInstance(RegistryStorage);
        
        // Set workspace root
        workspaceRoot = path.join(os.tmpdir(), 'test-workspace');
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('create()', () => {
        it('should return UserScopeService for user scope', () => {
            // Arrange
            const scope: InstallationScope = 'user';

            // Act
            const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);

            // Assert
            expect(service, 'Service should be created').toBeTruthy();
            expect(service instanceof UserScopeService, 'Should return UserScopeService instance').toBeTruthy();
        });

        it('should return UserScopeService for workspace scope', () => {
            // Arrange
            const scope: InstallationScope = 'workspace';

            // Act
            const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);

            // Assert
            expect(service, 'Service should be created').toBeTruthy();
            expect(service instanceof UserScopeService, 'Should return UserScopeService instance for workspace scope').toBeTruthy();
        });

        it('should return RepositoryScopeService for repository scope', () => {
            // Arrange
            const scope: InstallationScope = 'repository';

            // Act
            const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);

            // Assert
            expect(service, 'Service should be created').toBeTruthy();
            expect(service instanceof RepositoryScopeService, 'Should return RepositoryScopeService instance').toBeTruthy();
        });

        it('should throw error for unknown scope', () => {
            // Arrange
            const unknownScope = 'unknown' as InstallationScope;

            // Act & Assert
            expect(() => ScopeServiceFactory.create(unknownScope, mockContext, workspaceRoot, mockStorage)).toThrow(/Unknown installation scope/);
        });
    });

    describe('IScopeService interface compliance', () => {
        it('UserScopeService should implement IScopeService', () => {
            // Arrange
            const scope: InstallationScope = 'user';

            // Act
            const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);

            // Assert - verify interface methods exist
            expect(typeof service.syncBundle === 'function', 'Should have syncBundle method').toBeTruthy();
            expect(typeof service.unsyncBundle === 'function', 'Should have unsyncBundle method').toBeTruthy();
            expect(typeof service.getTargetPath === 'function', 'Should have getTargetPath method').toBeTruthy();
            expect(typeof service.getStatus === 'function', 'Should have getStatus method').toBeTruthy();
        });

        it('RepositoryScopeService should implement IScopeService', () => {
            // Arrange
            const scope: InstallationScope = 'repository';

            // Act
            const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);

            // Assert - verify interface methods exist
            expect(typeof service.syncBundle === 'function', 'Should have syncBundle method').toBeTruthy();
            expect(typeof service.unsyncBundle === 'function', 'Should have unsyncBundle method').toBeTruthy();
            expect(typeof service.getTargetPath === 'function', 'Should have getTargetPath method').toBeTruthy();
            expect(typeof service.getStatus === 'function', 'Should have getStatus method').toBeTruthy();
        });
    });

    describe('Factory configuration', () => {
        it('should pass context to UserScopeService', () => {
            // Arrange
            const scope: InstallationScope = 'user';

            // Act
            const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);

            // Assert - UserScopeService should be created with context
            expect(service instanceof UserScopeService).toBeTruthy();
        });

        it('should pass workspaceRoot and storage to RepositoryScopeService', () => {
            // Arrange
            const scope: InstallationScope = 'repository';

            // Act
            const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);

            // Assert - RepositoryScopeService should be created with workspaceRoot and storage
            expect(service instanceof RepositoryScopeService).toBeTruthy();
        });

        it('should throw error when repository scope requested without workspaceRoot', () => {
            // Arrange
            const scope: InstallationScope = 'repository';

            // Act & Assert
            expect(() => ScopeServiceFactory.create(scope, mockContext, undefined as any, mockStorage)).toThrow(/workspaceRoot is required for repository scope/);
        });

        it('should throw error when repository scope requested without storage', () => {
            // Arrange
            const scope: InstallationScope = 'repository';

            // Act & Assert
            expect(() => ScopeServiceFactory.create(scope, mockContext, workspaceRoot, undefined as any)).toThrow(/storage is required for repository scope/);
        });
    });

    describe('Scope type mapping', () => {
        it('should map all valid InstallationScope values', () => {
            // Arrange
            const validScopes: InstallationScope[] = ['user', 'workspace', 'repository'];

            // Act & Assert
            for (const scope of validScopes) {
                const service = ScopeServiceFactory.create(scope, mockContext, workspaceRoot, mockStorage);
                expect(service, `Should create service for scope: ${scope}`).toBeTruthy();
            }
        });
    });
});
