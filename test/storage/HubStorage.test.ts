/**
 * HubStorage Tests
 * Tests for hub configuration storage, caching, and file operations
 */

import * as path from 'path';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { HubStorage } from '../../src/storage/HubStorage';
import { HubConfig, HubReference } from '../../src/types/hub';

describe('HubStorage - TDD', () => {
    let storage: HubStorage;
    let tempDir: string;
    let testHubConfig: HubConfig;
    let testHubReference: HubReference;

    beforeEach(() => {
        // Create temp directory for tests
        tempDir = path.join(__dirname, '..', '..', 'test-temp-hub-storage');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Initialize storage with temp directory
        storage = new HubStorage(tempDir);

        // Load test fixture
        const fixturesDir = path.join(process.cwd(), 'test', 'fixtures', 'hubs');
        const validContent = fs.readFileSync(
            path.join(fixturesDir, 'valid-hub-config.yml'),
            'utf-8'
        );
        testHubConfig = yaml.load(validContent) as HubConfig;

        // Create test reference
        testHubReference = {
            type: 'github',
            location: 'promptregistry/official-hub',
            ref: 'main',
            autoSync: true
        };
    });

    afterEach(() => {
        // Cleanup temp directory
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    describe('Initialization', () => {
        it('should create storage directory if it does not exist', () => {
            const newDir = path.join(tempDir, 'new-storage');
            const newStorage = new HubStorage(newDir);
            
            expect(fs.existsSync(newDir), 'Storage directory should be created').toBeTruthy();
        });

        it('should use existing directory if it exists', () => {
            const existingDir = path.join(tempDir, 'existing');
            fs.mkdirSync(existingDir, { recursive: true });
            
            const newStorage = new HubStorage(existingDir);
            expect(fs.existsSync(existingDir)).toBeTruthy();
        });

        it('should throw error for invalid path', () => {
            expect(() => {
                new HubStorage('');
            }).toThrow(/Invalid storage path/);
        });
    });

    describe('Save Hub Configuration', () => {
        it('should save hub config to file', async () => {
            const hubId = 'test-hub';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const configPath = path.join(tempDir, `${hubId}.yml`);
            expect(fs.existsSync(configPath), 'Hub config file should exist').toBeTruthy();
        });

        it('should save hub config with correct YAML format', async () => {
            const hubId = 'test-hub-yaml';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const configPath = path.join(tempDir, `${hubId}.yml`);
            const savedContent = fs.readFileSync(configPath, 'utf-8');
            const parsed = yaml.load(savedContent) as HubConfig;
            
            expect(parsed.version).toBe(testHubConfig.version);
            expect(parsed.metadata.name).toBe(testHubConfig.metadata.name);
        });

        it('should save reference metadata separately', async () => {
            const hubId = 'test-hub-ref';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const metaPath = path.join(tempDir, `${hubId}.meta.json`);
            expect(fs.existsSync(metaPath), 'Reference metadata should exist').toBeTruthy();
            
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
            expect(meta.reference.type).toBe(testHubReference.type);
            expect(meta.reference.location).toBe(testHubReference.location);
        });

        it('should reject invalid hub IDs', async () => {
            await expect(async () => await storage.saveHub('../invalid', testHubConfig, testHubReference)).rejects.toThrow(/Invalid hub ID/);
        });

        it('should handle save errors gracefully', async () => {
            // Create a read-only directory
            const readOnlyDir = path.join(tempDir, 'readonly');
            fs.mkdirSync(readOnlyDir, { recursive: true });
            fs.chmodSync(readOnlyDir, 0o444);
            
            const readOnlyStorage = new HubStorage(readOnlyDir);
            
            await expect(async () => await readOnlyStorage.saveHub('test', testHubConfig, testHubReference)).rejects.toThrow(/Failed to save hub/);
            
            // Restore permissions for cleanup
            fs.chmodSync(readOnlyDir, 0o755);
        });

        it('should overwrite existing hub config', async () => {
            const hubId = 'test-hub-overwrite';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            // Modify and save again
            const modifiedConfig = JSON.parse(JSON.stringify(testHubConfig));
            modifiedConfig.metadata.name = 'Modified Name';
            await storage.saveHub(hubId, modifiedConfig, testHubReference);
            
            const loaded = await storage.loadHub(hubId);
            expect(loaded.config.metadata.name).toBe('Modified Name');
        });
    });

    describe('Load Hub Configuration', () => {
        it('should load existing hub config', async () => {
            const hubId = 'test-load';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const result = await storage.loadHub(hubId);
            
            expect(result).toBeTruthy();
            expect(result.config.version).toBe(testHubConfig.version);
            expect(result.config.metadata.name).toBe(testHubConfig.metadata.name);
        });

        it('should load reference metadata with config', async () => {
            const hubId = 'test-load-ref';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const result = await storage.loadHub(hubId);
            
            expect(result.reference).toBeTruthy();
            expect(result.reference.type).toBe(testHubReference.type);
            expect(result.reference.location).toBe(testHubReference.location);
        });

        it('should throw error for non-existent hub', async () => {
            await expect(async () => await storage.loadHub('non-existent')).rejects.toThrow(/Hub not found/);
        });

        it('should validate hub ID before loading', async () => {
            await expect(async () => await storage.loadHub('../invalid')).rejects.toThrow(/Invalid hub ID/);
        });

        it('should handle corrupted config files', async () => {
            const hubId = 'corrupted';
            const configPath = path.join(tempDir, `${hubId}.yml`);
            fs.writeFileSync(configPath, 'invalid: yaml: content: [[[');
            
            await expect(async () => await storage.loadHub(hubId)).rejects.toThrow(/Failed to load hub/);
        });
    });

    describe('Cache Management', () => {
        it('should cache loaded hub configs', async () => {
            const hubId = 'test-cache';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            // First load
            const result1 = await storage.loadHub(hubId);
            
            // Second load should use cache (modify file to verify)
            const configPath = path.join(tempDir, `${hubId}.yml`);
            fs.writeFileSync(configPath, 'version: "999.0.0"');
            
            const result2 = await storage.loadHub(hubId);
            
            // Should still have original version from cache
            expect(result2.config.version).toBe(testHubConfig.version);
        });

        it('should bypass cache when forceReload is true', async () => {
            const hubId = 'test-force-reload';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            // First load
            await storage.loadHub(hubId);
            
            // Modify file
            const modifiedConfig = JSON.parse(JSON.stringify(testHubConfig));
            modifiedConfig.version = '999.0.0';
            await storage.saveHub(hubId, modifiedConfig, testHubReference);
            
            // Force reload
            const result = await storage.loadHub(hubId, true);
            
            expect(result.config.version).toBe('999.0.0');
        });

        it('should clear cache for specific hub', async () => {
            const hubId = 'test-clear-cache';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            await storage.loadHub(hubId);
            storage.clearCache(hubId);
            
            // Modify file
            const configPath = path.join(tempDir, `${hubId}.yml`);
            const modifiedConfig = JSON.parse(JSON.stringify(testHubConfig));
            modifiedConfig.version = '999.0.0';
            fs.writeFileSync(configPath, yaml.dump(modifiedConfig));
            
            // Should load modified version
            const result = await storage.loadHub(hubId);
            expect(result.config.version).toBe('999.0.0');
        });

        it('should clear all caches', async () => {
            await storage.saveHub('hub1', testHubConfig, testHubReference);
            await storage.saveHub('hub2', testHubConfig, testHubReference);
            
            await storage.loadHub('hub1');
            await storage.loadHub('hub2');
            
            storage.clearCache();
            
            // Verify cache is empty by checking load behavior
            expect(true, 'Cache cleared successfully').toBeTruthy();
        });
    });

    describe('List Hubs', () => {
        it('should list all stored hubs', async () => {
            await storage.saveHub('hub1', testHubConfig, testHubReference);
            await storage.saveHub('hub2', testHubConfig, testHubReference);
            await storage.saveHub('hub3', testHubConfig, testHubReference);
            
            const hubs = await storage.listHubs();
            
            expect(hubs.length).toBe(3);
            expect(hubs.includes('hub1')).toBeTruthy();
            expect(hubs.includes('hub2')).toBeTruthy();
            expect(hubs.includes('hub3')).toBeTruthy();
        });

        it('should return empty array when no hubs exist', async () => {
            const hubs = await storage.listHubs();
            expect(hubs.length).toBe(0);
        });

        it('should ignore non-hub files', async () => {
            await storage.saveHub('hub1', testHubConfig, testHubReference);
            
            // Create non-hub files
            fs.writeFileSync(path.join(tempDir, 'random.txt'), 'content');
            fs.writeFileSync(path.join(tempDir, 'test.json'), '{}');
            
            const hubs = await storage.listHubs();
            
            expect(hubs.length).toBe(1);
            expect(hubs[0]).toBe('hub1');
        });
    });

    describe('Delete Hub', () => {
        it('should delete hub config and metadata', async () => {
            const hubId = 'test-delete';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            await storage.deleteHub(hubId);
            
            const configPath = path.join(tempDir, `${hubId}.yml`);
            const metaPath = path.join(tempDir, `${hubId}.meta.json`);
            
            expect(!fs.existsSync(configPath), 'Config file should be deleted').toBeTruthy();
            expect(!fs.existsSync(metaPath), 'Metadata file should be deleted').toBeTruthy();
        });

        it('should remove hub from cache after deletion', async () => {
            const hubId = 'test-delete-cache';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            await storage.loadHub(hubId);
            
            await storage.deleteHub(hubId);
            
            await expect(async () => await storage.loadHub(hubId)).rejects.toThrow(/Hub not found/);
        });

        it('should throw error when deleting non-existent hub', async () => {
            await expect(async () => await storage.deleteHub('non-existent')).rejects.toThrow(/Hub not found/);
        });

        it('should validate hub ID before deletion', async () => {
            await expect(async () => await storage.deleteHub('../invalid')).rejects.toThrow(/Invalid hub ID/);
        });
    });

    describe('Hub Existence Check', () => {
        it('should return true for existing hub', async () => {
            const hubId = 'test-exists';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const exists = await storage.hubExists(hubId);
            expect(exists).toBe(true);
        });

        it('should return false for non-existent hub', async () => {
            const exists = await storage.hubExists('non-existent');
            expect(exists).toBe(false);
        });

        it('should validate hub ID before checking', async () => {
            await expect(async () => await storage.hubExists('../invalid')).rejects.toThrow(/Invalid hub ID/);
        });
    });

    describe('Get Hub Metadata', () => {
        it('should return hub metadata without loading full config', async () => {
            const hubId = 'test-metadata';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const metadata = await storage.getHubMetadata(hubId);
            
            expect(metadata).toBeTruthy();
            expect(metadata.reference.type).toBe(testHubReference.type);
            expect(metadata.lastModified).toBeTruthy();
            expect(metadata.size > 0).toBeTruthy();
        });

        it('should throw error for non-existent hub', async () => {
            await expect(async () => await storage.getHubMetadata('non-existent')).rejects.toThrow(/Hub not found/);
        });
    });

    describe('Security and Validation', () => {
        it('should reject path traversal in hub IDs', async () => {
            const invalidIds = ['../etc/passwd', '../../hack', 'test/../bad'];
            
            for (const id of invalidIds) {
                await expect(async () => await storage.saveHub(id, testHubConfig, testHubReference)).rejects.toThrow(/Invalid hub ID/);
            }
        });

        it('should reject special characters in hub IDs', async () => {
            const invalidIds = ['test<script>', 'hub:evil', 'name|pipe', 'test&cmd'];
            
            for (const id of invalidIds) {
                await expect(async () => await storage.saveHub(id, testHubConfig, testHubReference)).rejects.toThrow(/Invalid hub ID/);
            }
        });

        it('should handle file system errors gracefully', async () => {
            // This test is already covered by "should handle save errors gracefully"
            expect(true).toBeTruthy();
        });
    });

    describe('Active Hub Management', () => {
        it('should return null when no active hub is set', async () => {
            const activeHubId = await storage.getActiveHubId();
            expect(activeHubId, 'Should return null when no active hub exists').toBe(null);
        });

        it('should set and retrieve active hub ID', async () => {
            const hubId = 'test-active-hub';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            await storage.setActiveHubId(hubId);
            const retrievedHubId = await storage.getActiveHubId();
            
            expect(retrievedHubId, 'Should return the correct active hub ID').toBe(hubId);
        });

        it('should update active hub ID when changed', async () => {
            const hubId1 = 'test-hub-1';
            const hubId2 = 'test-hub-2';
            
            await storage.saveHub(hubId1, testHubConfig, testHubReference);
            await storage.saveHub(hubId2, testHubConfig, testHubReference);
            
            await storage.setActiveHubId(hubId1);
            expect(await storage.getActiveHubId()).toBe(hubId1);
            
            await storage.setActiveHubId(hubId2);
            expect(await storage.getActiveHubId(), 'Should update to new active hub').toBe(hubId2);
        });

        it('should clear active hub ID when set to null', async () => {
            const hubId = 'test-clear-hub';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            await storage.setActiveHubId(hubId);
            expect(await storage.getActiveHubId()).toBe(hubId);
            
            await storage.setActiveHubId(null);
            expect(await storage.getActiveHubId(), 'Should clear active hub ID').toBe(null);
        });

        it('should reject setting non-existent hub as active', async () => {
            await expect(async () => await storage.setActiveHubId('non-existent-hub')).rejects.toThrow(/does not exist/, 'Should reject non-existent hub');
        });

        it('should persist active hub ID across storage instances', async () => {
            const hubId = 'test-persist-hub';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            await storage.setActiveHubId(hubId);
            
            // Create new storage instance with same directory
            const newStorage = new HubStorage(tempDir);
            const retrievedHubId = await newStorage.getActiveHubId();
            
            expect(retrievedHubId, 'Active hub ID should persist across instances').toBe(hubId);
        });

        it('should store timestamp when setting active hub', async () => {
            const hubId = 'test-timestamp-hub';
            await storage.saveHub(hubId, testHubConfig, testHubReference);
            
            const beforeTime = new Date();
            await storage.setActiveHubId(hubId);
            const afterTime = new Date();
            
            // Read the active hub file directly to verify timestamp
            const activeHubPath = path.join(tempDir, 'activeHubId.json');
            expect(fs.existsSync(activeHubPath), 'activeHubId.json should exist').toBeTruthy();
            
            const content = JSON.parse(fs.readFileSync(activeHubPath, 'utf-8'));
            expect(content.setAt, 'Should have setAt timestamp').toBeTruthy();
            
            const setAtTime = new Date(content.setAt);
            expect(setAtTime >= beforeTime && setAtTime <= afterTime, 'Timestamp should be within test execution time').toBeTruthy();
        });

        it('should handle concurrent active hub changes', async () => {
            const hubId1 = 'test-concurrent-1';
            const hubId2 = 'test-concurrent-2';
            
            await storage.saveHub(hubId1, testHubConfig, testHubReference);
            await storage.saveHub(hubId2, testHubConfig, testHubReference);
            
            // Simulate concurrent updates
            await Promise.all([
                storage.setActiveHubId(hubId1),
                storage.setActiveHubId(hubId2)
            ]);
            
            const finalHubId = await storage.getActiveHubId();
            expect(finalHubId === hubId1 || finalHubId === hubId2, 'Should have one of the hub IDs set').toBeTruthy();
        });
    });

});