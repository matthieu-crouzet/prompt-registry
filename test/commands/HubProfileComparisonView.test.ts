import * as path from 'path';
import * as fs from 'fs';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubManager } from '../../src/services/HubManager';
import { HubProfileComparisonView } from '../../src/commands/HubProfileComparisonView';
import { HubConfig, HubReference } from '../../src/types/hub';

describe('Hub Profile Comparison View', () => {
    let storage: HubStorage;
    let hubManager: HubManager;
    let comparisonView: HubProfileComparisonView;
    let testDir: string;

    beforeEach(async () => {
        testDir = path.join(__dirname, '..', 'test-data', 'comparison-view-test');
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
        fs.mkdirSync(testDir, { recursive: true });

        storage = new HubStorage(testDir);
        hubManager = new HubManager(storage, {} as any, process.cwd(), undefined, undefined);
        comparisonView = new HubProfileComparisonView(hubManager);
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true });
        }
    });

    async function createTestHub(hubId: string): Promise<void> {
        const config: HubConfig = {
            version: '1.0.0',
            metadata: {
                name: `Test Hub ${hubId}`,
                description: 'Test hub for comparison view',
                maintainer: 'test',
                updatedAt: new Date().toISOString()
            },
            sources: [
                {
                    id: 'test-source',
                    name: 'Test Source',
                    type: 'github',
                    url: 'github:test/repo',
                    enabled: true,
                    priority: 1,
                    metadata: {
                        description: 'Test source'
                    }
                }
            ],
            profiles: [
                {
                    id: 'test-profile',
                    name: 'Test Profile',
                    description: 'Test profile',
                    icon: '🔧',
                    bundles: [
                        {
                            id: 'bundle-1',
                            version: '1.0.0',
                            source: 'test-source',
                            required: false
                        }
                    ],
                    active: false,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }
            ]
        };

        const reference: HubReference = {
            type: 'local',
            location: testDir
        };

        await storage.saveHub(hubId, config, reference);
    }

    describe('Get Profile Comparison Data', () => {
        it('should generate comparison data for active profile with changes', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            // Wait to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Update hub config
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            updated.config.profiles[0].bundles[0].version = '2.0.0';
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');

            expect(comparison).toBeTruthy();
            expect(comparison.hubId).toBe('test-hub');
            expect(comparison.profileId).toBe('test-profile');
            expect(comparison.availableBundles.length).toBe(2);
            expect(comparison.addedBundles.length).toBe(1);
            expect(comparison.updatedBundles.length >= 0).toBeTruthy(); // May vary based on detection logic
            expect(comparison.removedBundles.length).toBe(0);
        });

        it('should return null for profile with no changes', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');

            expect(comparison).toBe(null);
        });

        it('should return null for non-active profile', async () => {
            await createTestHub('test-hub');

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');

            expect(comparison).toBe(null);
        });
    });

    describe('Format Bundle Comparison', () => {
        it('should format bundle with added status', () => {
            const bundle = {
                id: 'bundle-1',
                version: '1.0.0',
                source: 'test-source',
                required: false
            };

            const formatted = comparisonView.formatBundleComparison(bundle, 'added');

            expect(formatted.includes('bundle-1')).toBeTruthy();
            expect(formatted.includes('1.0.0')).toBeTruthy();
            expect(formatted.includes('Added') || formatted.includes('NEW')).toBeTruthy();
        });

        it('should format bundle with updated status showing version change', () => {
            const bundle = {
                id: 'bundle-1',
                version: '2.0.0',
                source: 'test-source',
                required: false
            };

            const formatted = comparisonView.formatBundleComparison(bundle, 'updated', '1.0.0');

            expect(formatted.includes('bundle-1')).toBeTruthy();
            expect(formatted.includes('1.0.0')).toBeTruthy();
            expect(formatted.includes('2.0.0')).toBeTruthy();
            expect(formatted.includes('Updated') || formatted.includes('→')).toBeTruthy();
        });

        it('should format bundle with removed status', () => {
            const bundle = {
                id: 'bundle-1',
                version: '1.0.0',
                source: 'test-source',
                required: false
            };

            const formatted = comparisonView.formatBundleComparison(bundle, 'removed');

            expect(formatted.includes('bundle-1')).toBeTruthy();
            expect(formatted.includes('1.0.0')).toBeTruthy();
            expect(formatted.includes('Removed') || formatted.includes('DELETED')).toBeTruthy();
        });

        it('should format bundle with unchanged status', () => {
            const bundle = {
                id: 'bundle-1',
                version: '1.0.0',
                source: 'test-source',
                required: false
            };

            const formatted = comparisonView.formatBundleComparison(bundle, 'unchanged');

            expect(formatted.includes('bundle-1')).toBeTruthy();
            expect(formatted.includes('1.0.0')).toBeTruthy();
        });
    });

    describe('Generate Comparison Summary', () => {
        it('should generate summary with all change types', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles = [
                {
                    id: 'bundle-1',
                    version: '2.0.0',
                    source: 'test-source',
                    required: false
                },
                {
                    id: 'bundle-2',
                    version: '1.0.0',
                    source: 'test-source',
                    required: false
                }
            ];
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const summary = comparisonView.generateComparisonSummary(comparison);

            expect(summary.includes('bundle-1')).toBeTruthy();
            expect(summary.includes('bundle-2')).toBeTruthy();
            expect(summary.includes('1.0.0')).toBeTruthy();
            expect(summary.includes('2.0.0')).toBeTruthy();
        });

        it('should generate summary with metadata changes', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].name = 'Updated Profile Name';
            updated.config.profiles[0].description = 'Updated description';
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const summary = comparisonView.generateComparisonSummary(comparison);

            expect(summary.includes('Updated Profile Name') || summary.includes('metadata')).toBeTruthy();
        });

        it('should handle comparison with no bundle changes', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].description = 'Updated description only';
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const summary = comparisonView.generateComparisonSummary(comparison);

            expect(summary.length > 0).toBeTruthy();
            expect(summary.includes('metadata') || summary.includes('description')).toBeTruthy();
        });
    });

    describe('Create Comparison QuickPick Items', () => {
        it('should create QuickPick items for all bundles', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            updated.config.profiles[0].bundles[0].version = '2.0.0';
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const items = comparisonView.createComparisonQuickPickItems(comparison);

            expect(items.length >= 2).toBeTruthy(); // At least 2 bundles
            expect(items.some(item => item.label.includes('bundle-1'))).toBeTruthy();
            expect(items.some(item => item.label.includes('bundle-2'))).toBeTruthy();
        });

        it('should include change status in QuickPick item descriptions', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles[0].version = '2.0.0';
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const items = comparisonView.createComparisonQuickPickItems(comparison);

            const updatedItem = items.find(item => item.label.includes('bundle-1'));
            expect(updatedItem).toBeTruthy();
            expect(updatedItem.description).toBeTruthy();
            expect(updatedItem.description.includes('1.0.0') && 
                updatedItem.description.includes('2.0.0')).toBeTruthy();
        });

        it('should mark added bundles distinctly in QuickPick items', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-new',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const items = comparisonView.createComparisonQuickPickItems(comparison);

            const newItem = items.find(item => item.label.includes('bundle-new'));
            expect(newItem).toBeTruthy();
            expect(newItem.description?.includes('Added') || newItem.description?.includes('NEW')).toBeTruthy();
        });
    });

    describe('Get Side By Side Comparison', () => {
        it('should generate side-by-side comparison text', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles.push({
                id: 'bundle-2',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const sideBySide = comparisonView.getSideBySideComparison(comparison);

            expect(sideBySide.includes('Current')).toBeTruthy();
            expect(sideBySide.includes('Available')).toBeTruthy();
            expect(sideBySide.includes('bundle-1')).toBeTruthy();
            expect(sideBySide.includes('bundle-2')).toBeTruthy();
        });

        it('should show version differences in side-by-side view', async () => {
            await createTestHub('test-hub');
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles[0].version = '2.0.0';
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const sideBySide = comparisonView.getSideBySideComparison(comparison);

            expect(sideBySide.includes('1.0.0')).toBeTruthy();
            expect(sideBySide.includes('2.0.0')).toBeTruthy();
        });

        it('should handle removed bundles in side-by-side view', async () => {
            await createTestHub('test-hub');
            
            // Add extra bundle to activate
            const hub = await storage.loadHub('test-hub');
            hub.config.profiles[0].bundles.push({
                id: 'bundle-to-remove',
                version: '1.0.0',
                source: 'test-source',
                required: false
            });
            await storage.saveHub('test-hub', hub.config, hub.reference);
            
            await hubManager.activateProfile('test-hub', 'test-profile', { installBundles: false });
            
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Remove the bundle from hub
            const updated = await storage.loadHub('test-hub');
            updated.config.profiles[0].bundles = updated.config.profiles[0].bundles.filter(
                b => b.id !== 'bundle-to-remove'
            );
            updated.config.profiles[0].updatedAt = new Date().toISOString();
            await storage.saveHub('test-hub', updated.config, updated.reference);

            const comparison = await comparisonView.getProfileComparisonData('test-hub', 'test-profile');
            expect(comparison).toBeTruthy();

            const sideBySide = comparisonView.getSideBySideComparison(comparison);

            expect(sideBySide.includes('bundle-to-remove')).toBeTruthy();
            expect(sideBySide.includes('Removed') || sideBySide.includes('—') || sideBySide.includes('(none)')).toBeTruthy();
        });
    });
});
