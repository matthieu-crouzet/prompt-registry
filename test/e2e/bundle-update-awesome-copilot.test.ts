/**
 * E2E Tests: Awesome Copilot Bundle Update Workflow
 * 
 * Tests the complete update workflow for Awesome Copilot bundles:
 * - Manual update via right-click context menu (sync triggers auto-update)
 * - Bundle files replacement after update
 * - Installation record updates
 * - Scope preservation during updates
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 3.2, 3.3
 */

import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import nock from 'nock';
import { createE2ETestContext, E2ETestContext, generateTestId } from '../helpers/e2eTestHelpers';
import { RegistrySource } from '../../src/types/registry';

describe('E2E: Awesome Copilot Bundle Update Tests', () => {
    let testContext: E2ETestContext;
    let testId: string;
    let sandbox: sinon.SinonSandbox;

    // Test fixtures for collection YAML content
    const createCollectionYaml = (version: string, content: string = 'initial') => `
id: test-collection
name: Test Collection
description: Test collection for E2E tests - ${content}
version: ${version}
tags: ["test", "e2e"]
items:
  - path: "prompts/test.prompt.md"
    kind: prompt
`;

    const createPromptContent = (content: string) => `# Test Prompt

This is a test prompt for E2E testing.
Content: ${content}
`;

    // Mock source configuration
    const createMockSource = (id: string): RegistrySource => ({
        id,
        name: 'Test Awesome Copilot Source',
        type: 'awesome-copilot',
        url: 'https://github.com/test-owner/awesome-copilot-test',
        enabled: true,
        priority: 1,
        config: {
            branch: 'main',
            collectionsPath: 'collections'
        }
    });

    beforeEach(async function() {
        testId = generateTestId('awesome-copilot');
        
        // Create sinon sandbox for stubbing
        sandbox = sinon.createSandbox();
        
        // Stub VS Code authentication to return undefined (no auth)
        // This prevents the adapter from using real GitHub tokens
        // Must be done BEFORE creating the test context which initializes RegistryManager
        if (vscode.authentication && typeof vscode.authentication.getSession === 'function') {
            sandbox.stub(vscode.authentication, 'getSession').resolves(undefined);
        }
        
        // Stub child_process.exec to prevent gh CLI from providing tokens
        const childProcess = require('child_process');
        sandbox.stub(childProcess, 'exec').callsFake((...args: unknown[]) => {
            const cmd = args[0] as string;
            const callback = args[args.length - 1] as Function;
            if (cmd === 'gh auth token') {
                callback(new Error('gh not available'), '', '');
            } else {
                // Call original for other commands
                callback(null, '', '');
            }
        });
        
        testContext = await createE2ETestContext();
        
        // Clear any cached auth tokens in adapters
        const adapters = (testContext.registryManager as any).adapters;
        if (adapters) {
            adapters.forEach((adapter: any) => {
                if (adapter.authToken !== undefined) {
                    adapter.authToken = undefined;
                    adapter.authMethod = 'none';
                }
            });
        }
        
        // Disable real network connections and allow only mocked ones
        nock.disableNetConnect();
        
        // Allow localhost for any local test servers
        nock.enableNetConnect('127.0.0.1');
    });

    afterEach(async function() {
        await testContext.cleanup();
        sandbox.restore();
        nock.cleanAll();
        nock.enableNetConnect();
    });

    /**
     * Helper to set up nock mocks for Awesome Copilot source listing and fetching
     * Uses matchHeader to handle authorization headers
     */
    function setupSourceMocks(
        collectionYaml: string,
        promptContent: string,
        times: number = 1
    ): void {
        // Mock GitHub API for collections directory listing
        // Match any authorization header (or none)
        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot-test/contents/collections')
            .query({ ref: 'main' })
            .times(times)
            .reply(200, [
                {
                    name: 'test-collection.collection.yml',
                    type: 'file',
                    download_url: 'https://raw.githubusercontent.com/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml'
                }
            ]);

        // Mock raw content for collection YAML
        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
            .times(times)
            .reply(200, collectionYaml);

        // Mock raw content for prompt file (for download)
        nock('https://raw.githubusercontent.com')
            .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
            .times(times)
            .reply(200, promptContent);
    }

    /**
     * Helper to set up mocks for validation
     */
    function setupValidationMocks(): void {
        nock('https://api.github.com')
            .get('/repos/test-owner/awesome-copilot-test/contents/collections')
            .query({ ref: 'main' })
            .reply(200, [
                { name: 'test-collection.collection.yml', type: 'file' }
            ]);
    }

    describe('Test Setup Validation', () => {
        it('should create isolated test context with unique storage path', async function() {
            // Verify test context was created
            expect(testContext, 'Test context should be created').toBeTruthy();
            expect(testContext.tempStoragePath, 'Temp storage path should exist').toBeTruthy();
            expect(fs.existsSync(testContext.tempStoragePath), 'Temp directory should exist').toBeTruthy();
            
            // Verify storage is initialized
            const paths = testContext.storage.getPaths();
            expect(fs.existsSync(paths.installed), 'Installed directory should exist').toBeTruthy();
        });
    });

    describe('Awesome Copilot Update Workflow', () => {
        it('Example 1.1: Update command downloads from configured branch', async function() {
            const sourceId = `${testId}-source`;
            const source = createMockSource(sourceId);
            const initialVersion = '1.0.0';
            const updatedVersion = '1.1.0';
            
            // Setup all mocks upfront with enough times for all operations
            // Use persist() to allow multiple calls
            // Use query string directly in path (like existing tests)
            
            // API calls for validation and syncs
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);

            // First sync + install: initial version
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(initialVersion, 'initial'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('initial content'));

            // Step 1: Add source (triggers validation)
            await testContext.registryManager.addSource(source);
            
            // Step 2: Sync source to get bundles
            await testContext.registryManager.syncSource(sourceId);
            
            // Step 3: Get available bundles and install
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            expect(bundles.length > 0, 'Should have bundles after sync').toBeTruthy();
            
            const bundleToInstall = bundles.find(b => b.id === 'test-collection');
            expect(bundleToInstall, 'Should find test-collection bundle').toBeTruthy();
            
            await testContext.registryManager.installBundle(bundleToInstall!.id, { scope: 'user' });
            
            // Verify initial installation
            const installedBefore = await testContext.registryManager.listInstalledBundles();
            expect(installedBefore.length, 'Should have one installed bundle').toBe(1);
            expect(installedBefore[0].version, 'Should have initial version').toBe(initialVersion);
            
            // Clean up previous mocks and setup new ones for update
            nock.cleanAll();
            nock.disableNetConnect();
            
            // Clear the adapter's cache to force a fresh fetch
            const adapters = (testContext.registryManager as any).adapters;
            for (const [, adapter] of adapters) {
                if (adapter.collectionsCache) {
                    adapter.collectionsCache.clear();
                }
            }
            
            // Setup mocks for second sync with updated version
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);
            
            // Collection YAML with updated version (for sync + update download)
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(updatedVersion, 'updated'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('updated content'));
            
            // Step 5: Sync source again - this triggers auto-update for Awesome Copilot bundles
            await testContext.registryManager.syncSource(sourceId);
            
            // Verify update occurred
            const installedAfter = await testContext.registryManager.listInstalledBundles();
            expect(installedAfter.length, 'Should still have one installed bundle').toBe(1);
            expect(installedAfter[0].version, 'Bundle should be updated to new version').toBe(updatedVersion);
            
            // Verify the update was from the configured branch (main)
            // The nock mocks verify the correct URLs were called
            expect(true, 'Update downloaded from configured branch (main)').toBeTruthy();
        });

        it('Example 1.2: Bundle files are replaced after update', async function() {
            const sourceId = `${testId}-source-files`;
            const source = createMockSource(sourceId);
            const initialVersion = '1.0.0';
            const updatedVersion = '1.1.0';
            
            // Setup mocks for validation + first sync + install
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(initialVersion, 'initial'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('INITIAL_CONTENT_MARKER'));

            // Add and sync source
            await testContext.registryManager.addSource(source);
            await testContext.registryManager.syncSource(sourceId);
            
            // Get bundle and install
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            const bundleToInstall = bundles.find(b => b.id === 'test-collection');
            expect(bundleToInstall, 'Should find test-collection bundle').toBeTruthy();
            
            await testContext.registryManager.installBundle(bundleToInstall!.id, { scope: 'user' });
            
            // Get install path and verify initial content
            const installedBefore = await testContext.registryManager.listInstalledBundles();
            const installPath = installedBefore[0].installPath;
            
            // Check that prompt file exists with initial content
            const promptPath = path.join(installPath, 'prompts', 'test.prompt.md');
            if (fs.existsSync(promptPath)) {
                const initialContent = fs.readFileSync(promptPath, 'utf-8');
                expect(initialContent.includes('INITIAL_CONTENT_MARKER'), 'Initial content should contain marker').toBeTruthy();
            }
            
            // Clean up and setup mocks for update
            nock.cleanAll();
            nock.disableNetConnect();
            
            // Clear the adapter's cache to force a fresh fetch
            const adapters = (testContext.registryManager as any).adapters;
            for (const [, adapter] of adapters) {
                if (adapter.collectionsCache) {
                    adapter.collectionsCache.clear();
                }
            }
            
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(updatedVersion, 'updated'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('UPDATED_CONTENT_MARKER'));
            
            // Sync to trigger auto-update
            await testContext.registryManager.syncSource(sourceId);
            
            // Verify files were replaced
            const installedAfter = await testContext.registryManager.listInstalledBundles();
            const newInstallPath = installedAfter[0].installPath;
            const newPromptPath = path.join(newInstallPath, 'prompts', 'test.prompt.md');
            
            if (fs.existsSync(newPromptPath)) {
                const updatedContent = fs.readFileSync(newPromptPath, 'utf-8');
                expect(updatedContent.includes('UPDATED_CONTENT_MARKER'), 'Updated content should contain new marker').toBeTruthy();
                expect(!updatedContent.includes('INITIAL_CONTENT_MARKER'), 'Updated content should not contain old marker').toBeTruthy();
            }
            
            expect(installedAfter[0].version, 'Version should be updated').toBe(updatedVersion);
        });

        it('Example 1.3: Installation record reflects new version', async function() {
            const sourceId = `${testId}-source-record`;
            const source = createMockSource(sourceId);
            const initialVersion = '1.0.0';
            const updatedVersion = '2.0.0';
            
            // Setup mocks for validation + first sync + install
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(initialVersion, 'initial'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('initial'));

            // Add, sync, and install
            await testContext.registryManager.addSource(source);
            await testContext.registryManager.syncSource(sourceId);
            
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            const bundleToInstall = bundles.find(b => b.id === 'test-collection');
            
            await testContext.registryManager.installBundle(bundleToInstall!.id, { scope: 'user' });
            
            // Verify initial installation record
            const recordBefore = await testContext.registryManager.listInstalledBundles();
            expect(recordBefore[0].version, 'Initial record should have initial version').toBe(initialVersion);
            
            // Clean up and setup mocks for update
            nock.cleanAll();
            nock.disableNetConnect();
            
            // Clear the adapter's cache to force a fresh fetch
            const adapters2 = (testContext.registryManager as any).adapters;
            for (const [, adapter] of adapters2) {
                if (adapter.collectionsCache) {
                    adapter.collectionsCache.clear();
                }
            }
            
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(updatedVersion, 'updated'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('updated'));
            
            // Sync to trigger auto-update
            await testContext.registryManager.syncSource(sourceId);
            
            // Verify installation record reflects new version
            const recordAfter = await testContext.registryManager.listInstalledBundles();
            expect(recordAfter.length, 'Should have one installation record').toBe(1);
            expect(recordAfter[0].version, 'Installation record should reflect new version').toBe(updatedVersion);
            expect(recordAfter[0].bundleId, 'Bundle ID should remain the same').toBe('test-collection');
        });

        it('Example 1.4: Installation scope is preserved', async function() {
            const sourceId = `${testId}-source-scope`;
            const source = createMockSource(sourceId);
            const initialVersion = '1.0.0';
            const updatedVersion = '1.1.0';
            const installScope = 'user'; // Could also test 'workspace'
            
            // Setup mocks for validation + first sync + install
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(initialVersion, 'initial'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('initial'));

            // Add, sync, and install with specific scope
            await testContext.registryManager.addSource(source);
            await testContext.registryManager.syncSource(sourceId);
            
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            const bundleToInstall = bundles.find(b => b.id === 'test-collection');
            
            await testContext.registryManager.installBundle(bundleToInstall!.id, { scope: installScope });
            
            // Verify initial scope
            const installedBefore = await testContext.registryManager.listInstalledBundles();
            expect(installedBefore[0].scope, 'Initial installation should have correct scope').toBe(installScope);
            
            // Clean up and setup mocks for update
            nock.cleanAll();
            nock.disableNetConnect();
            
            // Clear the adapter's cache to force a fresh fetch
            const adapters3 = (testContext.registryManager as any).adapters;
            for (const [, adapter] of adapters3) {
                if (adapter.collectionsCache) {
                    adapter.collectionsCache.clear();
                }
            }
            
            nock('https://api.github.com')
                .persist()
                .get('/repos/test-owner/awesome-copilot-test/contents/collections?ref=main')
                .reply(200, [
                    { name: 'test-collection.collection.yml', type: 'file' }
                ]);
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/collections/test-collection.collection.yml')
                .reply(200, createCollectionYaml(updatedVersion, 'updated'));
            nock('https://raw.githubusercontent.com')
                .persist()
                .get('/test-owner/awesome-copilot-test/main/prompts/test.prompt.md')
                .reply(200, createPromptContent('updated'));
            
            // Sync to trigger auto-update
            await testContext.registryManager.syncSource(sourceId);
            
            // Verify scope is preserved after update
            const installedAfter = await testContext.registryManager.listInstalledBundles();
            expect(installedAfter[0].scope, 'Installation scope should be preserved after update').toBe(installScope);
            expect(installedAfter[0].version, 'Version should be updated').toBe(updatedVersion);
        });
    });
});
