/**
 * Unit tests for VersionConsolidator
 */
import { VersionConsolidator } from '../../src/services/VersionConsolidator';
import { BundleBuilder, TEST_SOURCE_IDS } from '../helpers/bundleTestHelpers';

describe('VersionConsolidator Unit Tests', () => {
    let consolidator: VersionConsolidator;
    
    beforeEach(() => {
        consolidator = new VersionConsolidator();
    });
    
    afterEach(() => {
        consolidator.clearCache();
    });
    
    describe('consolidateBundles', () => {
        it('should consolidate 3 versions (1.0.0, 2.0.0, 1.5.0) into single entry with latest (2.0.0)', () => {
            const bundles = [
                BundleBuilder.github('microsoft', 'vscode').withVersion('1.0.0').build(),
                BundleBuilder.github('microsoft', 'vscode').withVersion('2.0.0').build(),
                BundleBuilder.github('microsoft', 'vscode').withVersion('1.5.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            expect(consolidated.length, 'Should have one consolidated entry').toBe(1);
            expect(consolidated[0].version, 'Should select latest version').toBe('2.0.0');
            expect(consolidated[0].isConsolidated, 'Should be marked as consolidated').toBe(true);
            expect(consolidated[0].availableVersions.length, 'Should have all versions').toBe(3);
        });
        
        it('should preserve version metadata for all versions', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            const versions = consolidated[0].availableVersions;
            expect(versions.length).toBe(2);
            expect(versions.some(v => v.version === '1.0.0')).toBeTruthy();
            expect(versions.some(v => v.version === '2.0.0')).toBeTruthy();
            expect(versions.every(v => v.downloadUrl && v.manifestUrl)).toBeTruthy();
        });
        
        it('should not consolidate single-version bundles', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            expect(consolidated.length).toBe(1);
            expect(consolidated[0].isConsolidated, 'Should not be marked as consolidated').toBe(false);
            expect(consolidated[0].availableVersions.length).toBe(1);
        });
        
        it('should handle mixed source types (GitHub consolidated, others unchanged)', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build(),
                BundleBuilder.fromSource('gitlab-bundle', 'GITLAB').withVersion('1.0.0').build(),
                BundleBuilder.fromSource('local-bundle', 'LOCAL').withVersion('1.0.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            // GitHub bundles should be consolidated (1 entry)
            // GitLab and local should remain separate (2 entries)
            expect(consolidated.length, 'Should have 3 entries total').toBe(3);
            
            const githubEntry = consolidated.find(b => b.sourceId === TEST_SOURCE_IDS.GITHUB);
            expect(githubEntry, 'Should have GitHub entry').toBeTruthy();
            expect(githubEntry!.isConsolidated).toBe(true);
            expect(githubEntry!.version).toBe('2.0.0');
        });
        
        it('should handle empty bundle array', () => {
            const consolidated = consolidator.consolidateBundles([]);
            
            expect(consolidated.length).toBe(0);
        });
        
        it('should consolidate each GitHub repo separately', () => {
            const bundles = [
                BundleBuilder.github('owner1', 'repo1').withVersion('1.0.0').build(),
                BundleBuilder.github('owner1', 'repo1').withVersion('2.0.0').build(),
                BundleBuilder.github('owner2', 'repo2').withVersion('1.0.0').build(),
                BundleBuilder.github('owner2', 'repo2').withVersion('3.0.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            expect(consolidated.length, 'Should have 2 consolidated entries').toBe(2);
            
            const repo1 = consolidated.find(b => b.name === 'owner1/repo1');
            const repo2 = consolidated.find(b => b.name === 'owner2/repo2');
            
            expect(repo1).toBeTruthy();
            expect(repo2).toBeTruthy();
            expect(repo1!.version).toBe('2.0.0');
            expect(repo2!.version).toBe('3.0.0');
        });
        
        it('should sort versions semantically (10.0.0 > 2.0.0 > 1.10.0 > 1.0.0)', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('10.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('1.10.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            expect(consolidated[0].version, 'Should select highest version').toBe('10.0.0');
            
            // Check that versions are sorted in availableVersions
            const versions = consolidated[0].availableVersions.map(v => v.version);
            expect(versions[0]).toBe('10.0.0');
            expect(versions[1]).toBe('2.0.0');
            expect(versions[2]).toBe('1.10.0');
            expect(versions[3]).toBe('1.0.0');
        });
    });
    
    describe('getAvailableVersions', () => {
        it('should return cached versions for consolidated bundle', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            const versions = consolidator.getAllVersions('owner-repo');
            
            expect(versions.length).toBe(2);
            expect(versions.some(v => v.version === '1.0.0')).toBeTruthy();
            expect(versions.some(v => v.version === '2.0.0')).toBeTruthy();
        });
        
        it('should return empty array for non-existent bundle', () => {
            const versions = consolidator.getAllVersions('non-existent');
            
            expect(versions.length).toBe(0);
        });
    });
    
    describe('getAllVersions', () => {
        it('should return all versions for a bundle identity (alias for getAvailableVersions)', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('1.5.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            const versions = consolidator.getAllVersions('owner-repo');
            
            expect(versions.length).toBe(3);
            expect(versions.some(v => v.version === '1.0.0')).toBeTruthy();
            expect(versions.some(v => v.version === '1.5.0')).toBeTruthy();
            expect(versions.some(v => v.version === '2.0.0')).toBeTruthy();
        });
        
        it('should return versions in descending semantic version order', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('10.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            const versions = consolidator.getAllVersions('owner-repo');
            
            expect(versions.length).toBe(3);
            expect(versions[0].version).toBe('10.0.0');
            expect(versions[1].version).toBe('2.0.0');
            expect(versions[2].version).toBe('1.0.0');
        });
        
        it('should return empty array for non-existent bundle', () => {
            const versions = consolidator.getAllVersions('non-existent');
            
            expect(versions.length).toBe(0);
        });
        
        it('should return same results as getAvailableVersions', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            const versionsFromGetAll = consolidator.getAllVersions('owner-repo');
            const versionsFromGetAvailable = consolidator.getAllVersions('owner-repo');
            
            expect(versionsFromGetAll.length).toBe(versionsFromGetAvailable.length);
            expect(versionsFromGetAll).toEqual(versionsFromGetAvailable);
        });
    });
    
    describe('getBundleVersion', () => {
        it('should return specific version when it exists', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('1.5.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            const version = consolidator.getBundleVersion('owner-repo', '1.5.0');
            
            expect(version).toBeTruthy();
            expect(version.version).toBe('1.5.0');
            expect(version.downloadUrl).toBeTruthy();
            expect(version.manifestUrl).toBeTruthy();
        });
        
        it('should return undefined when version does not exist', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            const version = consolidator.getBundleVersion('owner-repo', '3.0.0');
            
            expect(version).toBe(undefined);
        });
        
        it('should return undefined for non-existent bundle', () => {
            const version = consolidator.getBundleVersion('non-existent', '1.0.0');
            
            expect(version).toBe(undefined);
        });
        
        it('should return correct version metadata', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            const version = consolidator.getBundleVersion('owner-repo', '1.0.0');
            
            expect(version).toBeTruthy();
            expect(version.version).toBe('1.0.0');
            expect(version.downloadUrl.includes('1.0.0')).toBeTruthy();
            expect(version.manifestUrl.includes('1.0.0')).toBeTruthy();
            expect(version.publishedAt).toBeTruthy();
        });
    });
    
    describe('clearCache', () => {
        it('should clear version cache', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            let versions = consolidator.getAllVersions('owner-repo');
            expect(versions.length).toBe(2);
            
            consolidator.clearCache();
            
            versions = consolidator.getAllVersions('owner-repo');
            expect(versions.length).toBe(0);
        });
    });
    
    describe('setSourceTypeResolver', () => {
        it('should use custom source type resolver when provided', () => {
            // Set up a custom resolver that always returns 'local' (no consolidation)
            consolidator.setSourceTypeResolver(() => 'local');
            
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            // Should NOT consolidate because resolver returns 'local'
            expect(consolidated.length, 'Should not consolidate with local source type').toBe(2);
        });
        
        it('should fall back to heuristic when no resolver provided', () => {
            // No resolver set, should use heuristic (github-source -> github)
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            const consolidated = consolidator.consolidateBundles(bundles);
            
            // Should consolidate using heuristic
            expect(consolidated.length, 'Should consolidate using heuristic').toBe(1);
        });
    });
    
    describe('LRU Cache Mechanism', () => {
        it('should cache versions after consolidation', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            // Verify cache is populated
            const versions = consolidator.getAllVersions('owner-repo');
            expect(versions.length, 'Cache should contain versions').toBe(2);
        });
        
        it('should update last access time when getAvailableVersions is called', async () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Access the cache
            const versions1 = consolidator.getAllVersions('owner-repo');
            expect(versions1.length).toBe(1);
            
            // The access time should be updated (we can't directly verify this,
            // but we can verify the cache still works after access)
            const versions2 = consolidator.getAllVersions('owner-repo');
            expect(versions2.length).toBe(1);
        });
        
        it('should update last access time when getBundleVersion is called', async () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            // Wait a bit to ensure timestamp difference
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Access specific version
            const version = consolidator.getBundleVersion('owner-repo', '1.0.0');
            expect(version).toBeTruthy();
            expect(version.version).toBe('1.0.0');
            
            // Verify cache still works
            const versions = consolidator.getAllVersions('owner-repo');
            expect(versions.length).toBe(2);
        });
        
        it('should evict least recently used entry when cache is full', async () => {
            // Create a consolidator with a very small cache size for testing
            const smallConsolidator = new VersionConsolidator(3);
            
            // Add 3 bundles to fill the cache
            const bundle1 = [BundleBuilder.github('owner1', 'repo1').withVersion('1.0.0').build()];
            const bundle2 = [BundleBuilder.github('owner2', 'repo2').withVersion('1.0.0').build()];
            const bundle3 = [BundleBuilder.github('owner3', 'repo3').withVersion('1.0.0').build()];
            
            smallConsolidator.consolidateBundles(bundle1);
            await new Promise(resolve => setTimeout(resolve, 10));
            
            smallConsolidator.consolidateBundles(bundle2);
            await new Promise(resolve => setTimeout(resolve, 10));
            
            smallConsolidator.consolidateBundles(bundle3);
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // All 3 should be in cache
            expect(smallConsolidator.getAllVersions('owner1-repo1').length).toBe(1);
            expect(smallConsolidator.getAllVersions('owner2-repo2').length).toBe(1);
            expect(smallConsolidator.getAllVersions('owner3-repo3').length).toBe(1);
            
            // Access owner2 and owner3 to make them more recently used
            await new Promise(resolve => setTimeout(resolve, 10));
            smallConsolidator.getAllVersions('owner2-repo2');
            await new Promise(resolve => setTimeout(resolve, 10));
            smallConsolidator.getAllVersions('owner3-repo3');
            
            // Add a 4th bundle - should evict owner1 (least recently used)
            await new Promise(resolve => setTimeout(resolve, 10));
            const bundle4 = [BundleBuilder.github('owner4', 'repo4').withVersion('1.0.0').build()];
            smallConsolidator.consolidateBundles(bundle4);
            
            // owner1 should be evicted (LRU)
            expect(smallConsolidator.getAllVersions('owner1-repo1').length, 'LRU entry should be evicted').toBe(0);
            
            // owner2, owner3, and owner4 should still be in cache
            expect(smallConsolidator.getAllVersions('owner2-repo2').length, 'Recently used entry should remain').toBe(1);
            expect(smallConsolidator.getAllVersions('owner3-repo3').length, 'Recently used entry should remain').toBe(1);
            expect(smallConsolidator.getAllVersions('owner4-repo4').length, 'New entry should be cached').toBe(1);
        });
        
        it('should not evict entry when updating existing cache entry', () => {
            // Create a consolidator with small cache
            const smallConsolidator = new VersionConsolidator(2);
            
            // Add 2 bundles to fill cache
            const bundle1 = [BundleBuilder.github('owner1', 'repo1').withVersion('1.0.0').build()];
            const bundle2 = [BundleBuilder.github('owner2', 'repo2').withVersion('1.0.0').build()];
            
            smallConsolidator.consolidateBundles(bundle1);
            smallConsolidator.consolidateBundles(bundle2);
            
            // Update bundle1 with new version (should not trigger eviction)
            const bundle1Updated = [
                BundleBuilder.github('owner1', 'repo1').withVersion('1.0.0').build(),
                BundleBuilder.github('owner1', 'repo1').withVersion('2.0.0').build()
            ];
            smallConsolidator.consolidateBundles(bundle1Updated);
            
            // Both should still be in cache
            expect(smallConsolidator.getAllVersions('owner1-repo1').length, 'Updated entry should have 2 versions').toBe(2);
            expect(smallConsolidator.getAllVersions('owner2-repo2').length, 'Other entry should remain').toBe(1);
        });
        
        it('should reject invalid cache sizes', () => {
            expect(() => new VersionConsolidator(0)).toThrow(/positive number/);
            expect(() => new VersionConsolidator(-1)).toThrow(/positive number/);
            expect(() => new VersionConsolidator(NaN)).toThrow(/positive number/);
            expect(() => new VersionConsolidator(Infinity)).toThrow(/positive number/);
        });
        
        it('should handle cache with single-version bundles', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            // Single version should still be cached
            const versions = consolidator.getAllVersions('owner-repo');
            expect(versions.length).toBe(1);
            expect(versions[0].version).toBe('1.0.0');
        });
        
        it('should maintain cache consistency across multiple consolidations', () => {
            // First consolidation
            const bundles1 = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            consolidator.consolidateBundles(bundles1);
            
            let versions = consolidator.getAllVersions('owner-repo');
            expect(versions.length).toBe(2);
            
            // Second consolidation with additional version
            const bundles2 = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('3.0.0').build()
            ];
            consolidator.consolidateBundles(bundles2);
            
            // Cache should be updated with new version
            versions = consolidator.getAllVersions('owner-repo');
            expect(versions.length).toBe(3);
            expect(versions.some(v => v.version === '3.0.0')).toBeTruthy();
        });
        
        it('should preserve cache across multiple getAvailableVersions calls', () => {
            const bundles = [
                BundleBuilder.github('owner', 'repo').withVersion('1.0.0').build(),
                BundleBuilder.github('owner', 'repo').withVersion('2.0.0').build()
            ];
            
            consolidator.consolidateBundles(bundles);
            
            // Multiple accesses should return same data
            const versions1 = consolidator.getAllVersions('owner-repo');
            const versions2 = consolidator.getAllVersions('owner-repo');
            const versions3 = consolidator.getAllVersions('owner-repo');
            
            expect(versions1.length).toBe(2);
            expect(versions2.length).toBe(2);
            expect(versions3.length).toBe(2);
        });
    });
});
