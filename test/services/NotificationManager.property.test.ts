/**
 * Property-based tests for BundleUpdateNotifications
 * Feature: bundle-update-notifications
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as fc from 'fast-check';
import { BundleUpdateNotifications } from '../../src/notifications/BundleUpdateNotifications';
import { Logger } from '../../src/utils/logger';

describe('BundleUpdateNotifications - Property Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let showInformationMessageStub: sinon.SinonStub;
    let showErrorMessageStub: sinon.SinonStub;
    let executeCommandStub: sinon.SinonStub;
    let openExternalStub: sinon.SinonStub;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
        showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage');
        executeCommandStub = sandbox.stub(vscode.commands, 'executeCommand').resolves();
        
        // Create openExternal stub if it doesn't exist
        if (!vscode.env.openExternal) {
            (vscode.env as any).openExternal = () => Promise.resolve(true);
        }
        openExternalStub = sandbox.stub(vscode.env, 'openExternal').resolves(true);
        
        // Mock vscode.Uri.parse if it doesn't exist
        if (!vscode.Uri.parse) {
            (vscode.Uri as any).parse = (uri: string) => ({ toString: () => uri });
        }
    });

    afterEach(() => {
        sandbox.restore();
    });

    /**
     * Property 6: Update notification displays for available updates
     * **Validates: Requirements 2.1**
     */
    it('Property 6: Update notification displays for available updates', async () => {
        // Generator for update check results
        const updateResultArb = fc.record({
            bundleId: fc.string({ minLength: 1, maxLength: 50 }),
            currentVersion: fc.string({ minLength: 1, maxLength: 20 }),
            latestVersion: fc.string({ minLength: 1, maxLength: 20 }),
            releaseNotes: fc.option(fc.string(), { nil: undefined }),
            releaseDate: fc.date().map(d => d.toISOString()),
            downloadUrl: fc.webUrl(),
            autoUpdateEnabled: fc.boolean()
        });

        await fc.assert(
            fc.asyncProperty(
                fc.array(updateResultArb, { minLength: 1, maxLength: 10 }),
                async (updates) => {
                    // Reset stubs for each iteration
                    showInformationMessageStub.reset();
                    showInformationMessageStub.resolves('Dismiss');

                    const bundleNotifications = new BundleUpdateNotifications();
                    const options = {
                        updates,
                        notificationPreference: 'all' as const
                    };

                    await bundleNotifications.showUpdateNotification(options);

                    // Property: For any update check that finds available updates,
                    // the Notification System should display a notification
                    expect(showInformationMessageStub.called, 'Notification should be displayed when updates are available').toBe(true);

                    // Verify the notification contains bundle names and version numbers
                    const callArgs = showInformationMessageStub.firstCall.args;
                    const message = callArgs[0] as string;

                    // Check that at least one bundle ID appears in the message
                    const containsBundleId = updates.some(u => message.includes(u.bundleId));
                    expect(containsBundleId, 'Notification message should contain bundle name(s)').toBe(true);
                }
            ),
            { verbose: false, numRuns: 50 }
        );
    });

    /**
     * Property 7: Notification action buttons present
     * **Validates: Requirements 2.2**
     */
    it('Property 7: Notification action buttons present', async () => {
        // Generator for update check results
        const updateResultArb = fc.record({
            bundleId: fc.string({ minLength: 1, maxLength: 50 }),
            currentVersion: fc.string({ minLength: 1, maxLength: 20 }),
            latestVersion: fc.string({ minLength: 1, maxLength: 20 }),
            releaseNotes: fc.option(fc.string(), { nil: undefined }),
            releaseDate: fc.date().map(d => d.toISOString()),
            downloadUrl: fc.webUrl(),
            autoUpdateEnabled: fc.boolean()
        });

        await fc.assert(
            fc.asyncProperty(
                fc.array(updateResultArb, { minLength: 1, maxLength: 10 }),
                async (updates) => {
                    // Reset stubs for each iteration
                    showInformationMessageStub.reset();
                    showInformationMessageStub.resolves('Dismiss');

                    const bundleNotifications = new BundleUpdateNotifications();
                    const options = {
                        updates,
                        notificationPreference: 'all' as const
                    };

                    await bundleNotifications.showUpdateNotification(options);

                    // Property: For any update notification displayed,
                    // the notification should include exactly three action buttons
                    expect(showInformationMessageStub.called, 'Notification should be displayed').toBe(true);

                    const callArgs = showInformationMessageStub.firstCall.args;
                    // args[0] is the message, args[1..n] are the action buttons
                    const buttons = callArgs.slice(1);

                    expect(buttons.length, 'Notification should have exactly 3 action buttons').toBe(3);

                    expect(buttons.includes('Update Now'), 'Notification should include "Update Now" button').toBe(true);

                    expect(buttons.includes('View Changes'), 'Notification should include "View Changes" button').toBe(true);

                    expect(buttons.includes('Dismiss'), 'Notification should include "Dismiss" button').toBe(true);
                }
            ),
            { verbose: false, numRuns: 50 }
        );
    });

    /**
     * Property 10: Multiple updates grouped in notification
     * **Validates: Requirements 2.5**
     */
    it('Property 10: Multiple updates grouped in notification', async () => {
        // Generator for update check results
        const updateResultArb = fc.record({
            bundleId: fc.string({ minLength: 1, maxLength: 50 }),
            currentVersion: fc.string({ minLength: 1, maxLength: 20 }),
            latestVersion: fc.string({ minLength: 1, maxLength: 20 }),
            releaseNotes: fc.option(fc.string(), { nil: undefined }),
            releaseDate: fc.date().map(d => d.toISOString()),
            downloadUrl: fc.webUrl(),
            autoUpdateEnabled: fc.boolean()
        });

        await fc.assert(
            fc.asyncProperty(
                fc.array(updateResultArb, { minLength: 2, maxLength: 10 }),
                async (updates) => {
                    // Reset stubs for each iteration
                    showInformationMessageStub.reset();
                    showInformationMessageStub.resolves('Dismiss');

                    const bundleNotifications = new BundleUpdateNotifications();
                    const options = {
                        updates,
                        notificationPreference: 'all' as const
                    };

                    await bundleNotifications.showUpdateNotification(options);

                    // Property: For any update check that finds updates for N bundles where N > 1,
                    // the Notification System should display a single grouped notification
                    expect(showInformationMessageStub.callCount, 'Should display exactly one notification for multiple updates').toBe(1);

                    const callArgs = showInformationMessageStub.firstCall.args;
                    const message = callArgs[0] as string;

                    // Verify the message indicates multiple updates
                    expect(message.includes(updates.length.toString()), 'Notification should mention the number of updates').toBe(true);

                    // Verify all bundle IDs are listed in the notification
                    // (or at least the count is mentioned)
                    const allBundlesListed = updates.every(u => message.includes(u.bundleId));
                    const countMentioned = message.includes(updates.length.toString());

                    expect(allBundlesListed || countMentioned, 'Notification should list all bundles or mention the count').toBe(true);
                }
            ),
            { verbose: false, numRuns: 50 }
        );
    });

    /**
     * Property 8: Update Now triggers update process
     * **Validates: Requirements 2.3**
     */
    it('Property 8: Update Now triggers update process', async () => {
        // Generator for update check results
        const updateResultArb = fc.record({
            bundleId: fc.string({ minLength: 1, maxLength: 50 }),
            currentVersion: fc.string({ minLength: 1, maxLength: 20 }),
            latestVersion: fc.string({ minLength: 1, maxLength: 20 }),
            releaseNotes: fc.option(fc.string(), { nil: undefined }),
            releaseDate: fc.date().map(d => d.toISOString()),
            downloadUrl: fc.webUrl(),
            autoUpdateEnabled: fc.boolean()
        });

        await fc.assert(
            fc.asyncProperty(
                updateResultArb,
                async (update) => {
                    // Reset stubs for each iteration
                    showInformationMessageStub.reset();
                    executeCommandStub.reset();
                    
                    // Simulate user clicking "Update Now"
                    showInformationMessageStub.resolves('Update Now');
                    executeCommandStub.resolves();

                    const bundleNotifications = new BundleUpdateNotifications();
                    const options = {
                        updates: [update],
                        notificationPreference: 'all' as const
                    };

                    await bundleNotifications.showUpdateNotification(options);

                    // Property: For any user click on "Update Now" button,
                    // the Registry Manager should initiate the updateBundle() method
                    expect(executeCommandStub.called, 'Update command should be executed when "Update Now" is clicked').toBe(true);

                    // Verify the correct command was called with the bundle ID
                    const commandCall = executeCommandStub.getCalls().find(
                        call => call.args[0] === 'promptRegistry.updateBundle'
                    );

                    expect(commandCall, 'Should execute promptRegistry.updateBundle command').toBeTruthy();

                    expect(commandCall?.args[1], 'Should pass the correct bundle ID to the update command').toBe(update.bundleId);
                }
            ),
            { verbose: false, numRuns: 100 }
        );
    });

    /**
     * Property 9: View Changes opens release notes
     * **Validates: Requirements 2.4**
     */
    it('Property 9: View Changes opens release notes', async () => {
        // Generator for update check results with release notes
        const updateResultArb = fc.record({
            bundleId: fc.string({ minLength: 1, maxLength: 50 }),
            currentVersion: fc.string({ minLength: 1, maxLength: 20 }),
            latestVersion: fc.string({ minLength: 1, maxLength: 20 }),
            releaseNotes: fc.webUrl(), // Always has release notes URL
            releaseDate: fc.date().map(d => d.toISOString()),
            downloadUrl: fc.webUrl(),
            autoUpdateEnabled: fc.boolean()
        });

        await fc.assert(
            fc.asyncProperty(
                updateResultArb,
                async (update) => {
                    // Reset stubs for each iteration
                    showInformationMessageStub.reset();
                    openExternalStub.reset();
                    
                    // Simulate user clicking "View Changes"
                    showInformationMessageStub.resolves('View Changes');
                    openExternalStub.resolves(true);

                    const bundleNotifications = new BundleUpdateNotifications();
                    const options = {
                        updates: [update],
                        notificationPreference: 'all' as const
                    };

                    await bundleNotifications.showUpdateNotification(options);

                    // Property: For any user click on "View Changes" button,
                    // the system should open the release notes URL
                    expect(openExternalStub.called, 'Release notes URL should be opened when "View Changes" is clicked').toBe(true);

                    // Verify the correct URL was opened
                    const openCall = openExternalStub.firstCall;
                    expect(openCall, 'Should call openExternal').toBeTruthy();

                    const uri = openCall.args[0] as vscode.Uri;
                    expect(uri.toString(), 'Should open the correct release notes URL').toBe(update.releaseNotes);
                }
            ),
            { verbose: false, numRuns: 100 }
        );
    });

    /**
     * Property 40: Notification manager reuses existing utilities
     * **Validates: Requirements 9.1**
     */
    it('Property 40: Notification manager reuses existing utilities', async () => {
        // This property verifies that NotificationManager uses the Logger utility
        // for all notification operations
        
        const loggerInstance = Logger.getInstance();
        
        // Stub logger methods
        const loggerInfoStub = sandbox.stub(loggerInstance, 'info');
        const loggerWarnStub = sandbox.stub(loggerInstance, 'warn');
        const loggerErrorStub = sandbox.stub(loggerInstance, 'error');
        
        showInformationMessageStub.reset();
        showInformationMessageStub.resolves('Dismiss');
        showErrorMessageStub.reset();
        showErrorMessageStub.resolves('Dismiss');
        
        const bundleNotifications = new BundleUpdateNotifications();
        
        // Test that showUpdateNotification uses logger
        const updates = [{
            bundleId: 'test-bundle',
            currentVersion: '1.0.0',
            latestVersion: '2.0.0',
            releaseNotes: 'http://example.com',
            releaseDate: new Date().toISOString(),
            downloadUrl: 'http://example.com/bundle.zip',
            autoUpdateEnabled: false
        }];
        
        await bundleNotifications.showUpdateNotification({
            updates,
            notificationPreference: 'all'
        });
        
        // Property: For any notification display, the NotificationManager should use
        // the existing Logger utility for logging
        expect(loggerInfoStub.called, 'NotificationManager should use Logger.info for information notifications').toBe(true);
        
        // Test error notification logging
        loggerErrorStub.reset();
        await bundleNotifications.showUpdateFailure('test-bundle', 'Test error');
        
        expect(loggerErrorStub.called, 'NotificationManager should use Logger.error for error notifications').toBe(true);
        
        // Restore stubs
        loggerInfoStub.restore();
        loggerWarnStub.restore();
        loggerErrorStub.restore();
    });
});
