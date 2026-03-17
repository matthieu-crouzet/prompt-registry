import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { TelemetryService } from '../../src/services/TelemetryService';
import { Logger } from '../../src/utils/logger';
import { InstalledBundle, Profile, RegistrySource, SourceSyncedEvent, AutoUpdatePreferenceChangedEvent } from '../../src/types/registry';
import { createMockInstalledBundle } from '../helpers/bundleTestHelpers';

/**
 * Extract the event name and data from a telemetry log message.
 * The sender formats as: `[Telemetry] ${eventName} ${JSON.stringify(data)}`
 */
function parseTelemetryLog(call: sinon.SinonSpyCall): { eventName: string; data: Record<string, any> } {
    const message: string = call.args[0];
    const match = message.match(/^\[Telemetry\] (\S+)\s*(.*)?$/);
    expect(match, `Expected telemetry log format, got: ${message}`).toBeTruthy();
    const eventName = match[1];
    const rawData = match[2]?.trim();
    const data = rawData && rawData !== 'undefined' ? JSON.parse(rawData) : {};
    return { eventName, data };
}

/**
 * Create a mock RegistryManager with EventEmitters for all events.
 * Returns both the mock object and all emitters for firing events in tests.
 */
function createMockRegistryManager() {
    const emitters = {
        bundleInstalled: new vscode.EventEmitter<InstalledBundle>(),
        bundleUninstalled: new vscode.EventEmitter<string>(),
        bundleUpdated: new vscode.EventEmitter<InstalledBundle>(),
        bundlesInstalled: new vscode.EventEmitter<InstalledBundle[]>(),
        bundlesUninstalled: new vscode.EventEmitter<string[]>(),
        profileActivated: new vscode.EventEmitter<Profile>(),
        profileDeactivated: new vscode.EventEmitter<string>(),
        profileCreated: new vscode.EventEmitter<Profile>(),
        profileUpdated: new vscode.EventEmitter<Profile>(),
        profileDeleted: new vscode.EventEmitter<string>(),
        sourceAdded: new vscode.EventEmitter<RegistrySource>(),
        sourceRemoved: new vscode.EventEmitter<string>(),
        sourceUpdated: new vscode.EventEmitter<string>(),
        sourceSynced: new vscode.EventEmitter<SourceSyncedEvent>(),
        autoUpdatePreferenceChanged: new vscode.EventEmitter<AutoUpdatePreferenceChangedEvent>(),
        repositoryBundlesChanged: new vscode.EventEmitter<void>(),
    };

    const mockRegistryManager = {
        onBundleInstalled: emitters.bundleInstalled.event,
        onBundleUninstalled: emitters.bundleUninstalled.event,
        onBundleUpdated: emitters.bundleUpdated.event,
        onBundlesInstalled: emitters.bundlesInstalled.event,
        onBundlesUninstalled: emitters.bundlesUninstalled.event,
        onProfileActivated: emitters.profileActivated.event,
        onProfileDeactivated: emitters.profileDeactivated.event,
        onProfileCreated: emitters.profileCreated.event,
        onProfileUpdated: emitters.profileUpdated.event,
        onProfileDeleted: emitters.profileDeleted.event,
        onSourceAdded: emitters.sourceAdded.event,
        onSourceRemoved: emitters.sourceRemoved.event,
        onSourceUpdated: emitters.sourceUpdated.event,
        onSourceSynced: emitters.sourceSynced.event,
        onAutoUpdatePreferenceChanged: emitters.autoUpdatePreferenceChanged.event,
        onRepositoryBundlesChanged: emitters.repositoryBundlesChanged.event,
    };

    return { mockRegistryManager, emitters };
}

function disposeEmitters(emitters: ReturnType<typeof createMockRegistryManager>['emitters']): void {
    Object.values(emitters).forEach(e => e.dispose());
}

function createMockProfile(overrides?: Partial<Profile>): Profile {
    return {
        id: 'profile-1',
        name: 'Test Profile',
        description: 'A test profile',
        icon: 'icon',
        bundles: [],
        active: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        ...overrides
    };
}

function createMockSource(overrides?: Partial<RegistrySource>): RegistrySource {
    return {
        id: 'source-1',
        name: 'Test Source',
        type: 'github',
        url: 'https://github.com/test/repo',
        enabled: true,
        priority: 0,
        ...overrides
    } as RegistrySource;
}

describe('TelemetryService', () => {
    let sandbox: sinon.SinonSandbox;
    let service: TelemetryService;
    let loggerStub: sinon.SinonStubbedInstance<Logger>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        // Stub logger
        const loggerInstance = Logger.getInstance();
        loggerStub = sandbox.stub(loggerInstance);
        loggerStub.debug.returns();
        loggerStub.info.returns();
        loggerStub.warn.returns();
        loggerStub.error.returns();

        // Reset singleton so each test gets a fresh instance
        TelemetryService.resetInstance();
        service = TelemetryService.getInstance();

        // Clear the telemetryService.started call from the constructor
        // so event subscription tests start with a clean call count
        loggerStub.info.resetHistory();
    });

    afterEach(() => {
        service.dispose();
        TelemetryService.resetInstance();
        sandbox.restore();
    });

    describe('lifecycle events', () => {
        it('should log telemetryService.started on construction', () => {
            TelemetryService.resetInstance();
            loggerStub.info.resetHistory();

            service = TelemetryService.getInstance();

            expect(loggerStub.info.callCount).toBe(1);
            const { eventName } = parseTelemetryLog(loggerStub.info.firstCall);
            expect(eventName).toBe('telemetryService.started');
        });

        it('should log telemetryService.stopped on dispose', () => {
            loggerStub.info.resetHistory();

            service.dispose();

            expect(loggerStub.info.callCount).toBe(1);
            const { eventName } = parseTelemetryLog(loggerStub.info.firstCall);
            expect(eventName).toBe('telemetryService.stopped');
        });
    });

    describe('subscribeToRegistryEvents()', () => {
        let emitters: ReturnType<typeof createMockRegistryManager>['emitters'];

        beforeEach(() => {
            const mock = createMockRegistryManager();
            emitters = mock.emitters;
            service.subscribeToRegistryEvents(mock.mockRegistryManager as any);
        });

        afterEach(() => {
            disposeEmitters(emitters);
        });

        describe('bundle events', () => {
            it('should track bundle.installed with bundle details', () => {
                const bundle = createMockInstalledBundle('my-bundle', '1.0.0', {
                    scope: 'user',
                    sourceType: 'github'
                });
                emitters.bundleInstalled.fire(bundle);

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('bundle.installed');
                expect(data.bundleId).toBe('my-bundle');
                expect(data.version).toBe('1.0.0');
                expect(data.scope).toBe('user');
                expect(data.sourceType).toBe('github');
            });

            it('should default sourceType to unknown when not provided', () => {
                const bundle = createMockInstalledBundle('my-bundle', '1.0.0');
                emitters.bundleInstalled.fire(bundle);

                const { data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(data.sourceType).toBe('unknown');
            });

            it('should track bundle.uninstalled with bundleId', () => {
                emitters.bundleUninstalled.fire('my-bundle');

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('bundle.uninstalled');
                expect(data.bundleId).toBe('my-bundle');
            });

            it('should track bundle.updated with bundle details', () => {
                const bundle = createMockInstalledBundle('my-bundle', '2.0.0', {
                    scope: 'workspace',
                    sourceType: 'gitlab'
                });
                emitters.bundleUpdated.fire(bundle);

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('bundle.updated');
                expect(data.bundleId).toBe('my-bundle');
                expect(data.version).toBe('2.0.0');
                expect(data.scope).toBe('workspace');
                expect(data.sourceType).toBe('gitlab');
            });

            it('should track bundles.installed with count and bundleIds', () => {
                const bundles = [
                    createMockInstalledBundle('bundle-a', '1.0.0'),
                    createMockInstalledBundle('bundle-b', '2.0.0'),
                ];
                emitters.bundlesInstalled.fire(bundles);

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('bundles.installed');
                expect(data.count).toBe(2);
                expect(data.bundleIds).toEqual(['bundle-a', 'bundle-b']);
            });

            it('should track bundles.uninstalled with count and bundleIds', () => {
                emitters.bundlesUninstalled.fire(['bundle-a', 'bundle-b']);

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('bundles.uninstalled');
                expect(data.count).toBe(2);
                expect(data.bundleIds).toEqual(['bundle-a', 'bundle-b']);
            });
        });

        describe('profile events', () => {
            it('should track profile.activated with profile details', () => {
                emitters.profileActivated.fire(createMockProfile({ id: 'p1', name: 'Dev Profile' }));

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('profile.activated');
                expect(data.profileId).toBe('p1');
                expect(data.name).toBe('Dev Profile');
            });

            it('should track profile.deactivated with profileId', () => {
                emitters.profileDeactivated.fire('p1');

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('profile.deactivated');
                expect(data.profileId).toBe('p1');
            });

            it('should track profile.created with profile details', () => {
                emitters.profileCreated.fire(createMockProfile({ id: 'p2', name: 'New Profile' }));

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('profile.created');
                expect(data.profileId).toBe('p2');
                expect(data.name).toBe('New Profile');
            });

            it('should track profile.updated with profile details', () => {
                emitters.profileUpdated.fire(createMockProfile({ id: 'p1', name: 'Renamed' }));

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('profile.updated');
                expect(data.profileId).toBe('p1');
                expect(data.name).toBe('Renamed');
            });

            it('should track profile.deleted with profileId', () => {
                emitters.profileDeleted.fire('p1');

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('profile.deleted');
                expect(data.profileId).toBe('p1');
            });
        });

        describe('source events', () => {
            it('should track source.added with source details', () => {
                emitters.sourceAdded.fire(createMockSource({ id: 's1', type: 'github' as any }));

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('source.added');
                expect(data.sourceId).toBe('s1');
                expect(data.type).toBe('github');
            });

            it('should track source.removed with sourceId', () => {
                emitters.sourceRemoved.fire('s1');

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('source.removed');
                expect(data.sourceId).toBe('s1');
            });

            it('should track source.updated with sourceId', () => {
                emitters.sourceUpdated.fire('s1');

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('source.updated');
                expect(data.sourceId).toBe('s1');
            });

            it('should track source.synced with sourceId and bundleCount', () => {
                emitters.sourceSynced.fire({ sourceId: 's1', bundleCount: 5 });

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('source.synced');
                expect(data.sourceId).toBe('s1');
                expect(data.bundleCount).toBe(5);
            });
        });

        describe('preference events', () => {
            it('should track autoUpdate.preferenceChanged with bundleId and enabled', () => {
                emitters.autoUpdatePreferenceChanged.fire({ bundleId: 'my-bundle', enabled: true });

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName, data } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('autoUpdate.preferenceChanged');
                expect(data.bundleId).toBe('my-bundle');
                expect(data.enabled).toBe(true);
            });

            it('should track repository.bundlesChanged', () => {
                emitters.repositoryBundlesChanged.fire();

                expect(loggerStub.info.callCount).toBe(1);
                const { eventName } = parseTelemetryLog(loggerStub.info.firstCall);
                expect(eventName).toBe('repository.bundlesChanged');
            });
        });
    });

    describe('telemetry levels', () => {
        let origCreate: any;

        beforeEach(() => {
            origCreate = (vscode.env as any).createTelemetryLogger;
        });

        afterEach(() => {
            (vscode.env as any).createTelemetryLogger = origCreate;
        });

        it('should NOT log usage events when level is "off" (usage and errors disabled)', () => {
            TelemetryService.resetInstance();

            (vscode.env as any).createTelemetryLogger = (sender: any, options: any) => {
                const logger = origCreate(sender, options);
                logger.isUsageEnabled = false;
                return logger;
            };

            loggerStub.info.resetHistory();
            service = TelemetryService.getInstance();

            const mock = createMockRegistryManager();
            service.subscribeToRegistryEvents(mock.mockRegistryManager as any);

            mock.emitters.bundleInstalled.fire(createMockInstalledBundle('my-bundle', '1.0.0'));

            expect(loggerStub.info.callCount).toBe(0);

            disposeEmitters(mock.emitters);
        });

        it('should NOT log usage events when level is "error" (only errors enabled)', () => {
            TelemetryService.resetInstance();

            (vscode.env as any).createTelemetryLogger = (sender: any, options: any) => {
                const logger = origCreate(sender, options);
                // "error" level: usage disabled, errors still enabled
                logger.isUsageEnabled = false;
                return logger;
            };

            loggerStub.info.resetHistory();
            service = TelemetryService.getInstance();

            const mock = createMockRegistryManager();
            service.subscribeToRegistryEvents(mock.mockRegistryManager as any);

            // Usage events should be suppressed
            mock.emitters.bundleInstalled.fire(createMockInstalledBundle('my-bundle', '1.0.0'));
            mock.emitters.profileActivated.fire(createMockProfile());
            mock.emitters.sourceAdded.fire(createMockSource());

            expect(loggerStub.info.callCount).toBe(0);

            disposeEmitters(mock.emitters);
        });

        it('should log usage events when level is "all"', () => {
            // Default mock has isUsageEnabled = true (simulates "all" level)
            const mock = createMockRegistryManager();
            service.subscribeToRegistryEvents(mock.mockRegistryManager as any);

            mock.emitters.bundleInstalled.fire(createMockInstalledBundle('my-bundle', '1.0.0'));

            expect(loggerStub.info.callCount).toBe(1);
            const { eventName } = parseTelemetryLog(loggerStub.info.firstCall);
            expect(eventName).toBe('bundle.installed');

            disposeEmitters(mock.emitters);
        });
    });

    describe('dispose()', () => {
        it('should clean up event subscriptions', () => {
            const { mockRegistryManager, emitters } = createMockRegistryManager();

            service.subscribeToRegistryEvents(mockRegistryManager as any);
            service.dispose();

            // Reset after dispose (which logs telemetryService.stopped)
            loggerStub.info.resetHistory();

            // Fire events after dispose — should not log anything
            emitters.bundleInstalled.fire(createMockInstalledBundle('test-bundle', '1.0.0'));
            emitters.profileActivated.fire(createMockProfile());
            emitters.sourceAdded.fire(createMockSource());
            emitters.repositoryBundlesChanged.fire();

            expect(loggerStub.info.callCount).toBe(0);

            disposeEmitters(emitters);
        });
    });

});
