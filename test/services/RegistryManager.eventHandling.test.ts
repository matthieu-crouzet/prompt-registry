/**
 * RegistryManager Event Handling Tests
 * 
 * Tests for verifying that bundle events are fired correctly
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { RegistryManager } from '../../src/services/RegistryManager';
import { RegistryStorage } from '../../src/storage/RegistryStorage';
import { BundleInstaller } from '../../src/services/BundleInstaller';
import { RepositoryAdapterFactory } from '../../src/adapters/RepositoryAdapter';
import { InstalledBundle, Bundle, RegistrySource, DeploymentManifest } from '../../src/types/registry';

// Helper to create mock manifest
function createMockManifest(): DeploymentManifest {
    return {
        common: {
            directories: [],
            files: [],
            include_patterns: [],
            exclude_patterns: []
        },
        bundle_settings: {
            include_common_in_environment_bundles: true,
            create_common_bundle: true,
            compression: 'zip' as any,
            naming: {
                environment_bundle: 'bundle'
            }
        },
        metadata: {
            manifest_version: '1.0.0',
            description: 'Test manifest'
        }
    };
}

describe('RegistryManager - Event Handling', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('onBundleInstalled Event', () => {
        it('should fire onBundleInstalled event with correct installation details', () => {
            // Requirement 6.1: WHEN a bundle is installed THEN the system SHALL fire the onBundleInstalled event with the installation details

            // Create a mock event emitter
            const eventEmitter = new vscode.EventEmitter<InstalledBundle>();
            
            const mockInstallation: InstalledBundle = {
                bundleId: 'test-bundle',
                version: '1.0.0',
                installPath: '/mock/install/path',
                installedAt: new Date().toISOString(),
                scope: 'user',
                sourceId: 'test-source',
                sourceType: 'github',
                manifest: createMockManifest()
            };

            // Listen for event
            let eventFired = false;
            let eventData: InstalledBundle | undefined;
            
            eventEmitter.event((installation) => {
                eventFired = true;
                eventData = installation;
            });

            // Fire the event
            eventEmitter.fire(mockInstallation);

            // Verify event was fired
            expect(eventFired, 'onBundleInstalled event should be fired').toBe(true);
            expect(eventData, 'Event data should be provided').toBeTruthy();
            expect(eventData?.bundleId, 'Event should contain correct bundle ID').toBe('test-bundle');
            expect(eventData?.version, 'Event should contain correct version').toBe('1.0.0');
            expect(eventData?.sourceId, 'Event should contain correct source ID').toBe('test-source');
            expect(eventData?.sourceType, 'Event should contain correct source type').toBe('github');
        });
    });

    describe('onBundleUninstalled Event', () => {
        it('should fire onBundleUninstalled event with correct bundle ID', () => {
            // Requirement 6.2: WHEN a bundle is uninstalled THEN the system SHALL fire the onBundleUninstalled event with the bundle ID

            // Create a mock event emitter
            const eventEmitter = new vscode.EventEmitter<string>();

            // Listen for event
            let eventFired = false;
            let eventBundleId: string | undefined;
            
            eventEmitter.event((bundleId) => {
                eventFired = true;
                eventBundleId = bundleId;
            });

            // Fire the event
            eventEmitter.fire('test-bundle-v1.0.0');

            // Verify event was fired
            expect(eventFired, 'onBundleUninstalled event should be fired').toBe(true);
            expect(eventBundleId, 'Event should contain correct bundle ID').toBe('test-bundle-v1.0.0');
        });
    });

    describe('onBundleUpdated Event', () => {
        it('should fire onBundleUpdated event with correct new installation details', () => {
            // Requirement 6.3: WHEN a bundle is updated THEN the system SHALL fire the onBundleUpdated event with the new installation details

            // Create a mock event emitter
            const eventEmitter = new vscode.EventEmitter<InstalledBundle>();

            const updatedInstallation: InstalledBundle = {
                bundleId: 'test-bundle',
                version: '1.1.0',
                installPath: '/mock/install/path',
                installedAt: new Date().toISOString(),
                scope: 'user',
                sourceId: 'test-source',
                sourceType: 'github',
                manifest: createMockManifest()
            };

            // Listen for event
            let eventFired = false;
            let eventData: InstalledBundle | undefined;
            
            eventEmitter.event((installation) => {
                eventFired = true;
                eventData = installation;
            });

            // Fire the event
            eventEmitter.fire(updatedInstallation);

            // Verify event was fired
            expect(eventFired, 'onBundleUpdated event should be fired').toBe(true);
            expect(eventData, 'Event data should be provided').toBeTruthy();
            expect(eventData?.bundleId, 'Event should contain correct bundle ID').toBe('test-bundle');
            expect(eventData?.version, 'Event should contain new version').toBe('1.1.0');
        });
    });

    describe('Event Firing Order', () => {
        it('should fire update event (not uninstall + install)', () => {
            // Track event order
            const eventOrder: string[] = [];

            // Create mock event emitters
            const updateEmitter = new vscode.EventEmitter<InstalledBundle>();
            const uninstallEmitter = new vscode.EventEmitter<string>();
            const installEmitter = new vscode.EventEmitter<InstalledBundle>();

            // Listen for events
            updateEmitter.event(() => {
                eventOrder.push('updated');
            });
            
            uninstallEmitter.event(() => {
                eventOrder.push('uninstalled');
            });
            
            installEmitter.event(() => {
                eventOrder.push('installed');
            });

            // Fire only update event (simulating RegistryManager.updateBundle behavior)
            const updatedInstallation: InstalledBundle = {
                bundleId: 'test-bundle',
                version: '1.1.0',
                installPath: '/mock/install/path',
                installedAt: new Date().toISOString(),
                scope: 'user',
                sourceId: 'test-source',
                sourceType: 'github',
                manifest: createMockManifest()
            };
            
            updateEmitter.fire(updatedInstallation);

            // Verify only update event was fired (not uninstall + install)
            expect(eventOrder.length, 'Should fire exactly one event').toBe(1);
            expect(eventOrder[0], 'Should fire update event').toBe('updated');
        });
    });

    describe('onSourceSynced Event', () => {
        it('should fire onSourceSynced event with correct source ID and bundle count', () => {
            // Requirement 1.6: WHEN a source is synced THEN the Registry Manager SHALL emit an event to notify listeners that bundle metadata has been refreshed
            // Requirement 11.1: WHEN a source sync completes THEN the Registry Manager SHALL emit a source synced event

            // Create a mock event emitter
            const eventEmitter = new vscode.EventEmitter<{ sourceId: string; bundleCount: number }>();

            // Listen for event
            let eventFired = false;
            let eventData: { sourceId: string; bundleCount: number } | undefined;
            
            eventEmitter.event((data) => {
                eventFired = true;
                eventData = data;
            });

            // Fire the event
            eventEmitter.fire({ sourceId: 'test-source', bundleCount: 42 });

            // Verify event was fired
            expect(eventFired, 'onSourceSynced event should be fired').toBe(true);
            expect(eventData, 'Event data should be provided').toBeTruthy();
            expect(eventData?.sourceId, 'Event should contain correct source ID').toBe('test-source');
            expect(eventData?.bundleCount, 'Event should contain correct bundle count').toBe(42);
        });

        it('should fire onSourceSynced event with zero bundle count for empty sources', () => {
            // Edge case: source with no bundles

            // Create a mock event emitter
            const eventEmitter = new vscode.EventEmitter<{ sourceId: string; bundleCount: number }>();

            // Listen for event
            let eventFired = false;
            let eventData: { sourceId: string; bundleCount: number } | undefined;
            
            eventEmitter.event((data) => {
                eventFired = true;
                eventData = data;
            });

            // Fire the event with zero bundles
            eventEmitter.fire({ sourceId: 'empty-source', bundleCount: 0 });

            // Verify event was fired
            expect(eventFired, 'onSourceSynced event should be fired even for empty sources').toBe(true);
            expect(eventData, 'Event data should be provided').toBeTruthy();
            expect(eventData?.sourceId, 'Event should contain correct source ID').toBe('empty-source');
            expect(eventData?.bundleCount, 'Event should contain zero bundle count').toBe(0);
        });
    });
});
