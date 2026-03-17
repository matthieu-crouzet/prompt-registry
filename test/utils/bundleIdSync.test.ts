/**
 * Bundle ID Synchronization Tests
 * 
 * Verifies that the TypeScript runtime implementation and the shared library
 * implementation produce identical bundle IDs.
 * 
 * This is critical because:
 * - Runtime (TS): src/utils/bundleNameUtils.ts - generateBuildScriptBundleId
 * - Shared library: @prompt-registry/collection-scripts - generateBundleId
 * 
 * If these drift, bundles built by CI won't match what the runtime expects.
 */

import { generateBuildScriptBundleId } from '../../src/utils/bundleNameUtils';
import { generateBundleId } from '@prompt-registry/collection-scripts';

describe('Bundle ID Synchronization', () => {
    // Use the shared library implementation
    const bundleIdJs = { generateBundleId };

    const testCases = [
        { repoSlug: 'owner/repo', collectionId: 'my-collection', version: '1.0.0' },
        { repoSlug: 'owner-repo', collectionId: 'my-collection', version: '1.0.0' },
        { repoSlug: 'my-org/my-repo', collectionId: 'test', version: '2.3.4' },
        { repoSlug: 'company/product-prompts', collectionId: 'frontend', version: '0.1.0' },
        { repoSlug: 'user/repo-with-dashes', collectionId: 'collection-with-dashes', version: '10.20.30' },
    ];

    it('TypeScript and JavaScript implementations should produce identical bundle IDs', () => {
        for (const tc of testCases) {
            const tsResult = generateBuildScriptBundleId(tc.repoSlug, tc.collectionId, tc.version);
            const jsResult = bundleIdJs.generateBundleId(tc.repoSlug, tc.collectionId, tc.version);
            
            expect(tsResult, `Bundle ID mismatch for ${JSON.stringify(tc)}:\n  TS: ${tsResult}\n  JS: ${jsResult}`).toBe(jsResult);
        }
    });

    it('Bundle ID format should be {owner}-{repo}-{collectionId}-v{version}', () => {
        const tsResult = generateBuildScriptBundleId('owner/repo', 'collection', '1.0.0');
        const jsResult = bundleIdJs.generateBundleId('owner/repo', 'collection', '1.0.0');
        
        const expected = 'owner-repo-collection-v1.0.0';
        expect(tsResult, `TS result should match expected format`).toBe(expected);
        expect(jsResult, `JS result should match expected format`).toBe(expected);
    });

    it('Repo slug with slash should be normalized to hyphen', () => {
        const tsResult = generateBuildScriptBundleId('my-org/my-repo', 'test', '1.0.0');
        const jsResult = bundleIdJs.generateBundleId('my-org/my-repo', 'test', '1.0.0');
        
        expect(!tsResult.includes('/'), 'TS result should not contain slash').toBeTruthy();
        expect(!jsResult.includes('/'), 'JS result should not contain slash').toBeTruthy();
        expect(tsResult).toBe(jsResult);
    });
});
