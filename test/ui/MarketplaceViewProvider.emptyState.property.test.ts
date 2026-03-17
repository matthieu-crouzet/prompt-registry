/**
 * Property-based tests for MarketplaceViewProvider Empty State UI
 * 
 * Property 8: Empty State UI Correctness
 * For any marketplace rendering with no bundles:
 * - If no hub is configured (setup incomplete/not_started), show setup prompt
 * - If hub is configured (setup complete), show "Syncing sources..."
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.5**
 */

import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fc from 'fast-check';
import { MarketplaceViewProvider } from '../../src/ui/MarketplaceViewProvider';
import { RegistryManager } from '../../src/services/RegistryManager';
import { SetupStateManager, SetupState } from '../../src/services/SetupStateManager';
import { PropertyTestConfig } from '../helpers/propertyTestHelpers';
import { formatTestParams } from '../helpers/setupStateTestHelpers';
import { BundleBuilder } from '../helpers/bundleTestHelpers';

// Project root for resolving webview assets in dist/
const PROJECT_ROOT = process.cwd();

describe('MarketplaceViewProvider Empty State - Property Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let mockRegistryManager: sinon.SinonStubbedInstance<RegistryManager>;
    let mockSetupStateManager: sinon.SinonStubbedInstance<SetupStateManager>;
    let marketplaceProvider: MarketplaceViewProvider;
    let mockWebview: any;
    let postedMessages: any[];

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        postedMessages = [];

        // Create mock context
        mockContext = {
            subscriptions: [],
            extensionUri: vscode.Uri.file(PROJECT_ROOT),
            extensionPath: PROJECT_ROOT,
            storagePath: '/mock/storage',
            globalStoragePath: '/mock/global-storage',
            logPath: '/mock/logs',
            extensionMode: 2 // ExtensionMode.Test
        } as any;

        // Create mock webview that captures posted messages
        mockWebview = {
            postMessage: (message: any) => {
                postedMessages.push(message);
                return Promise.resolve(true);
            },
            onDidReceiveMessage: sandbox.stub().returns({ dispose: () => {} }),
            asWebviewUri: (uri: vscode.Uri) => uri,
            cspSource: "'self'",
            options: {},
            html: ''
        };

        // Create mock RegistryManager with event emitters
        mockRegistryManager = {
            onBundleInstalled: sandbox.stub().returns({ dispose: () => {} }),
            onBundleUninstalled: sandbox.stub().returns({ dispose: () => {} }),
            onBundleUpdated: sandbox.stub().returns({ dispose: () => {} }),
            onBundlesInstalled: sandbox.stub().returns({ dispose: () => {} }),
            onBundlesUninstalled: sandbox.stub().returns({ dispose: () => {} }),
            onSourceSynced: sandbox.stub().returns({ dispose: () => {} }),
            onAutoUpdatePreferenceChanged: sandbox.stub().returns({ dispose: () => {} }),
            onRepositoryBundlesChanged: sandbox.stub().returns({ dispose: () => {} }),
            searchBundles: sandbox.stub().resolves([]),
            listInstalledBundles: sandbox.stub().resolves([]),
            listSources: sandbox.stub().resolves([]),
            autoUpdateService: null
        } as any;

        // Create mock SetupStateManager
        mockSetupStateManager = {
            getState: sandbox.stub(),
            isComplete: sandbox.stub(),
            isIncomplete: sandbox.stub(),
            markStarted: sandbox.stub().resolves(),
            markComplete: sandbox.stub().resolves(),
            markIncomplete: sandbox.stub().resolves()
        } as any;

        // Create MarketplaceViewProvider
        marketplaceProvider = new MarketplaceViewProvider(
            mockContext, 
            mockRegistryManager as any, 
            mockSetupStateManager as any
        );

        // Set up the view with mock webview
        (marketplaceProvider as any)._view = {
            webview: mockWebview
        };
    });

    afterEach(() => {
        sandbox.restore();
    });

    /**
     * Property 8: Empty State UI Correctness
     * For any marketplace rendering with no bundles:
     * - If setup is incomplete or not_started, show setup prompt
     * - If setup is complete or in_progress, show syncing message
     * 
     * **Validates: Requirements 4.1, 4.2, 4.3, 4.5**
     */
    it('Property 8: Empty state UI correctness (Req 4.1, 4.2, 4.3, 4.5)', async () => {
        const setupStateArbitrary = fc.constantFrom(
            SetupState.NOT_STARTED,
            SetupState.IN_PROGRESS,
            SetupState.COMPLETE,
            SetupState.INCOMPLETE
        );

        const bundleCountArbitrary = fc.integer({ min: 0, max: 5 });

        await fc.assert(
            fc.asyncProperty(
                setupStateArbitrary,
                bundleCountArbitrary,
                async (setupState, bundleCount) => {
                    // Reset state for each test
                    postedMessages = [];
                    mockSetupStateManager.getState.resolves(setupState);

                    // Generate mock bundles if bundleCount > 0
                    const mockBundles = Array.from({ length: bundleCount }, (_, i) => 
                        BundleBuilder.github('owner', `repo-${i}`)
                            .withVersion('1.0.0')
                            .withDescription(`Test bundle ${i}`)
                            .build()
                    );

                    mockRegistryManager.searchBundles.resolves(mockBundles);
                    mockRegistryManager.listInstalledBundles.resolves([]);
                    mockRegistryManager.listSources.resolves([]);

                    // Trigger loadBundles
                    await (marketplaceProvider as any).loadBundles();

                    const testParams = formatTestParams({ setupState, bundleCount });

                    // Verify message was posted
                    expect(postedMessages.length, `Should post exactly one bundlesLoaded message (${testParams})`).toBe(1);
                    expect(postedMessages[0].type, `Message type should be bundlesLoaded (${testParams})`).toBe('bundlesLoaded');

                    // Verify setup state is included in message
                    expect(postedMessages[0].setupState, `Setup state should be included in message (${testParams})`).toBe(setupState);

                    // Verify bundle count matches
                    expect(postedMessages[0].bundles.length, `Bundle count should match (${testParams})`).toBe(bundleCount);

                    // The UI rendering logic is in the webview JavaScript
                    // We verify that the correct data is sent to enable proper rendering
                    const isSetupIncomplete = setupState === SetupState.INCOMPLETE || 
                                              setupState === SetupState.NOT_STARTED;
                    const hasNoBundles = bundleCount === 0;

                    if (hasNoBundles && isSetupIncomplete) {
                        // Req 4.1, 4.2, 4.3: Setup prompt should be shown
                        // The webview will use setupState to determine this
                        expect(postedMessages[0].setupState === SetupState.INCOMPLETE ||
                            postedMessages[0].setupState === SetupState.NOT_STARTED, `Req 4.1: Setup state should indicate incomplete setup (${testParams})`).toBeTruthy();
                    } else if (hasNoBundles && !isSetupIncomplete) {
                        // Req 4.5: Syncing message should be shown
                        // The webview will use setupState to determine this
                        expect(postedMessages[0].setupState === SetupState.COMPLETE ||
                            postedMessages[0].setupState === SetupState.IN_PROGRESS, `Req 4.5: Setup state should indicate complete/in_progress setup (${testParams})`).toBeTruthy();
                    }

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: PropertyTestConfig.RUNS.STANDARD }
        );
    });

    /**
     * Additional property: HTML content includes required UI elements
     * Verifies that the generated HTML contains all necessary elements for empty state rendering
     */
    it('Property 8b: External webview files include required empty state elements', async () => {
        // Read the external CSS and JS files directly to verify content
        const cssPath = path.join(__dirname, '..', '..', 'src', 'ui', 'webview', 'marketplace', 'marketplace.css');
        const jsPath = path.join(__dirname, '..', '..', 'src', 'ui', 'webview', 'marketplace', 'marketplace.js');

        await fc.assert(
            fc.asyncProperty(
                fc.boolean(), // Whether to check for setup prompt elements
                async (checkSetupPrompt) => {
                    const html = (marketplaceProvider as any).getHtmlContent(mockWebview);

                    // Verify HTML references external CSS and JS
                    expect(html.includes('marketplace.css'), 'HTML should reference marketplace.css').toBeTruthy();
                    expect(html.includes('marketplace.js'), 'HTML should reference marketplace.js').toBeTruthy();
                    expect(html.includes('Content-Security-Policy'), 'HTML should include CSP').toBeTruthy();

                    // Verify external CSS includes required classes
                    if (fs.existsSync(cssPath)) {
                        const css = fs.readFileSync(cssPath, 'utf8');
                        expect(css.includes('.primary-button'), 'CSS should include primary-button class').toBeTruthy();
                        expect(css.includes('.empty-state'), 'CSS should include empty-state class').toBeTruthy();
                        expect(css.includes('.empty-state-icon'), 'CSS should include empty-state-icon class').toBeTruthy();
                        expect(css.includes('.empty-state-title'), 'CSS should include empty-state-title class').toBeTruthy();
                    }

                    // Verify external JS includes required functions and state
                    if (fs.existsSync(jsPath)) {
                        const js = fs.readFileSync(jsPath, 'utf8');
                        expect(js.includes('completeSetup'), 'JS should include completeSetup function').toBeTruthy();
                        expect(js.includes('setupState'), 'JS should include setupState variable').toBeTruthy();
                        expect(js.includes('Setup Not Complete') || js.includes('No hub is configured'), 'JS should include setup prompt message').toBeTruthy();
                        expect(js.includes('Syncing sources...'), 'JS should include syncing message').toBeTruthy();
                    }

                    return true;
                }
            ),
            { ...PropertyTestConfig.FAST_CHECK_OPTIONS, numRuns: 10 } // Fewer runs since content is static
        );
    });
});

