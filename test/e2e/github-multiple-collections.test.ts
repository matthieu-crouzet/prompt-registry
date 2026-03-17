/**
 * E2E Tests: GitHub Multiple Collections (Separate Releases)
 * 
 * Tests that Option 1 works correctly: Two separate releases in a GitHub repository,
 * each containing a different collection, result in two separate installable bundles.
 * 
 * Validates:
 * - Each release is detected as a separate bundle
 * - Each bundle has correct metadata from its deployment manifest
 * - Both bundles can be installed independently
 * - Both bundles can be installed simultaneously
 * - Each bundle maintains its own installation record
 * - Uninstalling one bundle doesn't affect the other
 */

import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import nock from 'nock';
import AdmZip from 'adm-zip';
import { createE2ETestContext, E2ETestContext, generateTestId } from '../helpers/e2eTestHelpers';
import { RegistrySource } from '../../src/types/registry';

describe('E2E: GitHub Multiple Collections (Separate Releases)', () => {
    let testContext: E2ETestContext;
    let testId: string;
    let sandbox: sinon.SinonSandbox;

    /**
     * Create a deployment manifest for a collection
     */
    const createDeploymentManifest = (collectionId: string, version: string, tag: string): string => {
        return `id: test-owner-test-repo-${tag}
name: ${collectionId} Collection
version: ${version}
description: Test collection ${collectionId} for E2E testing
author: test-owner
tags:
  - ${collectionId}
  - test
  - e2e
environments:
  - vscode
dependencies: []
license: MIT
`;
    };

    /**
     * Create a bundle ZIP file for a collection
     */
    const createBundleZip = (collectionId: string, version: string, tag: string): Buffer => {
        const zip = new AdmZip();
        
        // Add deployment manifest
        const manifest = createDeploymentManifest(collectionId, version, tag);
        zip.addFile('deployment-manifest.yml', Buffer.from(manifest));
        
        // Add collection-specific prompts
        const prompt1 = `# ${collectionId} Prompt 1

This is prompt 1 from ${collectionId} collection.
Version: ${version}
`;
        const prompt2 = `# ${collectionId} Prompt 2

This is prompt 2 from ${collectionId} collection.
Version: ${version}
`;
        
        zip.addFile(`prompts/${collectionId}-prompt-1.md`, Buffer.from(prompt1));
        zip.addFile(`prompts/${collectionId}-prompt-2.md`, Buffer.from(prompt2));
        
        return zip.toBuffer();
    };

    /**
     * Create mock GitHub source
     */
    const createMockSource = (id: string): RegistrySource => ({
        id,
        name: 'Test GitHub Multi-Collection Source',
        type: 'github',
        url: 'https://github.com/test-owner/test-repo',
        enabled: true,
        priority: 1,
        token: 'test-token'
    });

    /**
     * Setup GitHub API mocks for two separate releases (two collections)
     * 
     * Note: Using different versions to make it crystal clear these are separate bundles.
     * The key differentiator is the tag name which includes the collection ID.
     */
    function setupMultiCollectionMocks(): void {
        // Define two collections as separate releases with different versions
        const collections = [
            { id: 'collection-a', version: '1.0.0', tag: 'collection-a-v1.0.0' },
            { id: 'collection-b', version: '2.0.0', tag: 'collection-b-v2.0.0' }
        ];

        // Mock GitHub releases API - returns both releases
        const releasesResponse = collections.map((col, index) => ({
            tag_name: col.tag,
            name: `${col.id} Release ${col.version}`,
            body: `Release notes for ${col.id} ${col.version}`,
            published_at: new Date(Date.now() - index * 86400000).toISOString(),
            assets: [
                {
                    name: 'deployment-manifest.yml',
                    url: `https://api.github.com/repos/test-owner/test-repo/releases/assets/${1000 + index}`,
                    browser_download_url: `https://github.com/test-owner/test-repo/releases/download/${col.tag}/deployment-manifest.yml`,
                    size: 512
                },
                {
                    name: 'bundle.zip',
                    url: `https://api.github.com/repos/test-owner/test-repo/releases/assets/${2000 + index}`,
                    browser_download_url: `https://github.com/test-owner/test-repo/releases/download/${col.tag}/bundle.zip`,
                    size: 2048
                }
            ]
        }));

        nock('https://api.github.com')
            .persist()
            .get('/repos/test-owner/test-repo/releases')
            .reply(200, releasesResponse);

        // Mock repository info
        nock('https://api.github.com')
            .persist()
            .get('/repos/test-owner/test-repo')
            .reply(200, {
                name: 'test-repo',
                description: 'Test repository with multiple collections',
                updated_at: new Date().toISOString()
            });

        // Mock manifest and bundle downloads for each collection
        collections.forEach((col, index) => {
            const manifest = createDeploymentManifest(col.id, col.version, col.tag);
            const bundleZip = createBundleZip(col.id, col.version, col.tag);

            // Manifest download (API URL)
            nock('https://api.github.com')
                .persist()
                .get(`/repos/test-owner/test-repo/releases/assets/${1000 + index}`)
                .reply(200, manifest);

            // Bundle download (API URL redirects)
            nock('https://api.github.com')
                .persist()
                .get(`/repos/test-owner/test-repo/releases/assets/${2000 + index}`)
                .reply(302, '', {
                    location: `https://objects.githubusercontent.com/test-owner/test-repo/${col.tag}/bundle.zip`
                });

            // Actual bundle content
            nock('https://objects.githubusercontent.com')
                .persist()
                .get(`/test-owner/test-repo/${col.tag}/bundle.zip`)
                .reply(200, bundleZip);
        });
    }

    beforeEach(async function() {
        testId = generateTestId('github-multi-col');
        
        // Create sinon sandbox
        sandbox = sinon.createSandbox();
        
        // Stub VS Code authentication
        if (vscode.authentication && typeof vscode.authentication.getSession === 'function') {
            sandbox.stub(vscode.authentication, 'getSession').resolves(undefined);
        }
        
        // Stub gh CLI
        const childProcess = require('child_process');
        sandbox.stub(childProcess, 'exec').callsFake((...args: unknown[]) => {
            const cmd = args[0] as string;
            const callback = args[args.length - 1] as Function;
            if (cmd === 'gh auth token') {
                callback(new Error('gh not available'), '', '');
            } else {
                callback(null, '', '');
            }
        });
        
        testContext = await createE2ETestContext();
        
        // Clear cached auth tokens
        const adapters = (testContext.registryManager as any).adapters;
        if (adapters) {
            adapters.forEach((adapter: any) => {
                if (adapter.authToken !== undefined) {
                    adapter.authToken = undefined;
                    adapter.authMethod = 'none';
                }
            });
        }
        
        // Disable real network connections
        nock.disableNetConnect();
        nock.enableNetConnect('127.0.0.1');
    });

    afterEach(async function() {
        await testContext.cleanup();
        sandbox.restore();
        nock.cleanAll();
        nock.enableNetConnect();
    });

    describe('Bundle Detection', () => {
        it('should detect two separate bundles from two releases', async function() {
            // Clean all existing mocks first to prevent interference
            nock.cleanAll();
            nock.disableNetConnect();
            nock.enableNetConnect('127.0.0.1');
            
            // Setup mocks fresh for this test
            setupMultiCollectionMocks();
            
            const sourceId = `${testId}-source-detect`;
            const source = createMockSource(sourceId);
            
            await testContext.registryManager.addSource(source);
            await testContext.registryManager.syncSource(sourceId);
            
            // Search for bundles
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            
            // Verify two bundles are detected
            expect(bundles.length >= 2, `Should detect at least 2 bundles, got ${bundles.length}`).toBeTruthy();
            
            const collectionA = bundles.find(b => b.id.includes('collection-a'));
            const collectionB = bundles.find(b => b.id.includes('collection-b'));
            
            expect(collectionA, 'Should find collection-a bundle').toBeTruthy();
            expect(collectionB, 'Should find collection-b bundle').toBeTruthy();
        });
    });

    describe('Simultaneous Installation', () => {
        it('should maintain separate installation records', async function() {
            setupMultiCollectionMocks();
            
            const sourceId = `${testId}-source-records`;
            const source = createMockSource(sourceId);
            
            await testContext.registryManager.addSource(source);
            await testContext.registryManager.syncSource(sourceId);
            
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            const collectionA = bundles.find(b => b.id.includes('collection-a'));
            const collectionB = bundles.find(b => b.id.includes('collection-b'));
            
            // Install both
            await testContext.registryManager.installBundle(collectionA!.id, { 
                scope: 'user', 
                version: '1.0.0' 
            });
            await testContext.registryManager.installBundle(collectionB!.id, { 
                scope: 'user', 
                version: '1.0.0' 
            });
            
            const installed = await testContext.registryManager.listInstalledBundles();
            
            // Verify each has its own record
            const recordA = installed.find(b => b.bundleId.includes('collection-a'));
            const recordB = installed.find(b => b.bundleId.includes('collection-b'));
            
            expect(recordA, 'Should have collection-a record').toBeTruthy();
            expect(recordB, 'Should have collection-b record').toBeTruthy();
            
            // Verify records are different
            expect(recordA!.bundleId, 'Bundle IDs should be different').not.toBe(recordB!.bundleId);
            expect(recordA!.installPath, 'Install paths should be different').not.toBe(recordB!.installPath);
            expect(recordA!.version, 'Collection-a should be v1.0.0').toBe('1.0.0');
            expect(recordB!.version, 'Collection-b should be v2.0.0').toBe('2.0.0');
        });

        it('should maintain separate file structures', async function() {
            setupMultiCollectionMocks();
            
            const sourceId = `${testId}-source-files`;
            const source = createMockSource(sourceId);
            
            await testContext.registryManager.addSource(source);
            await testContext.registryManager.syncSource(sourceId);
            
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            const collectionA = bundles.find(b => b.id.includes('collection-a'));
            const collectionB = bundles.find(b => b.id.includes('collection-b'));
            
            // Install both
            await testContext.registryManager.installBundle(collectionA!.id, { 
                scope: 'user', 
                version: '1.0.0' 
            });
            await testContext.registryManager.installBundle(collectionB!.id, { 
                scope: 'user', 
                version: '2.0.0' 
            });
            
            const installed = await testContext.registryManager.listInstalledBundles();
            const recordA = installed.find(b => b.bundleId.includes('collection-a'));
            const recordB = installed.find(b => b.bundleId.includes('collection-b'));
            
            // Verify collection-a files
            const promptA = path.join(recordA!.installPath, 'prompts', 'collection-a-prompt-1.md');
            expect(fs.existsSync(promptA), 'Collection-a prompt should exist').toBeTruthy();
            const contentA = fs.readFileSync(promptA, 'utf-8');
            expect(contentA.includes('collection-a'), 'Should have collection-a content').toBeTruthy();
            
            // Verify collection-b files
            const promptB = path.join(recordB!.installPath, 'prompts', 'collection-b-prompt-1.md');
            expect(fs.existsSync(promptB), 'Collection-b prompt should exist').toBeTruthy();
            const contentB = fs.readFileSync(promptB, 'utf-8');
            expect(contentB.includes('collection-b'), 'Should have collection-b content').toBeTruthy();
            
            // Verify no cross-contamination
            const wrongPromptA = path.join(recordA!.installPath, 'prompts', 'collection-b-prompt-1.md');
            const wrongPromptB = path.join(recordB!.installPath, 'prompts', 'collection-a-prompt-1.md');
            expect(!fs.existsSync(wrongPromptA), 'Collection-a should not have collection-b files').toBeTruthy();
            expect(!fs.existsSync(wrongPromptB), 'Collection-b should not have collection-a files').toBeTruthy();
        });
    });

    describe('Independent Uninstallation', () => {
        it('should uninstall collection-a without affecting collection-b', async function() {
            setupMultiCollectionMocks();
            
            const sourceId = `${testId}-source-uninstall`;
            const source = createMockSource(sourceId);
            
            await testContext.registryManager.addSource(source);
            await testContext.registryManager.syncSource(sourceId);
            
            const bundles = await testContext.registryManager.searchBundles({ sourceId });
            const collectionA = bundles.find(b => b.id.includes('collection-a'));
            const collectionB = bundles.find(b => b.id.includes('collection-b'));
            
            // Install both
            await testContext.registryManager.installBundle(collectionA!.id, { 
                scope: 'user', 
                version: '1.0.0' 
            });
            await testContext.registryManager.installBundle(collectionB!.id, { 
                scope: 'user', 
                version: '2.0.0' 
            });
            
            // Get collection-a bundle ID
            let installed = await testContext.registryManager.listInstalledBundles();
            const recordA = installed.find(b => b.bundleId.includes('collection-a'));
            const recordB = installed.find(b => b.bundleId.includes('collection-b'));
            const installPathB = recordB!.installPath;
            
            // Uninstall collection-a
            await testContext.registryManager.uninstallBundle(recordA!.bundleId);
            
            // Verify collection-a is removed
            installed = await testContext.registryManager.listInstalledBundles();
            expect(installed.length, 'Should have one bundle remaining').toBe(1);
            expect(installed[0].bundleId.includes('collection-b'), 'Remaining bundle should be collection-b').toBeTruthy();
            
            // Verify collection-b files still exist
            const promptB = path.join(installPathB, 'prompts', 'collection-b-prompt-1.md');
            expect(fs.existsSync(promptB), 'Collection-b files should still exist').toBeTruthy();
        });
    });
});
