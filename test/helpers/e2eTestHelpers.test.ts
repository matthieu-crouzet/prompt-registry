/**
 * Tests for E2E Test Helpers
 * 
 * Validates that the E2ETestContext helper properly:
 * - Creates isolated storage directories
 * - Cleans up test artifacts
 * - Handles cleanup even on test failure
 * 
 * Requirements: 3.1, 3.2, 3.3
 */

import * as fs from 'fs';
import * as path from 'path';
import { createE2ETestContext, E2ETestContext, generateTestId, waitForCondition } from './e2eTestHelpers';

describe('E2E Test Helpers', () => {
    describe('createE2ETestContext', () => {
        it('should create isolated storage directory for each test (Example 3.1)', async function() {
            // Create two test contexts
            const context1 = await createE2ETestContext();
            const context2 = await createE2ETestContext();
            
            try {
                // Verify each has unique storage path
                expect(context1.tempStoragePath, 'Each test context should have unique storage path').not.toBe(context2.tempStoragePath);
                
                // Verify directories exist
                expect(fs.existsSync(context1.tempStoragePath), 'Context 1 storage directory should exist').toBeTruthy();
                expect(fs.existsSync(context2.tempStoragePath), 'Context 2 storage directory should exist').toBeTruthy();
                
                // Verify storage subdirectories are created
                const paths1 = context1.storage.getPaths();
                expect(fs.existsSync(paths1.installed), 'Installed directory should be created').toBeTruthy();
                expect(fs.existsSync(paths1.cache), 'Cache directory should be created').toBeTruthy();
            } finally {
                // Cleanup both contexts
                await context1.cleanup();
                await context2.cleanup();
            }
        });

        it('should cleanup all test artifacts after teardown (Example 3.2)', async function() {
            // Create test context
            const context = await createE2ETestContext();
            const storagePath = context.tempStoragePath;
            
            // Verify directory exists before cleanup
            expect(fs.existsSync(storagePath), 'Storage directory should exist before cleanup').toBeTruthy();
            
            // Create some test files to simulate test artifacts
            const testFile = path.join(storagePath, 'test-artifact.json');
            fs.writeFileSync(testFile, JSON.stringify({ test: 'data' }));
            expect(fs.existsSync(testFile), 'Test artifact should be created').toBeTruthy();
            
            // Run cleanup
            await context.cleanup();
            
            // Verify directory is removed
            expect(!fs.existsSync(storagePath), 'Storage directory should be removed after cleanup').toBeTruthy();
            expect(!fs.existsSync(testFile), 'Test artifacts should be removed after cleanup').toBeTruthy();
        });

        it('should cleanup even on test failure (Example 3.3)', async function() {
            let storagePath: string | undefined;
            let cleanupCalled = false;
            
            // Create test context
            const context = await createE2ETestContext();
            storagePath = context.tempStoragePath;
            
            // Wrap cleanup to track if it was called
            const originalCleanup = context.cleanup;
            context.cleanup = async () => {
                cleanupCalled = true;
                await originalCleanup();
            };
            
            try {
                // Simulate test failure
                throw new Error('Simulated test failure');
            } catch {
                // In real tests, this would be in teardown
                // Here we manually call cleanup to simulate teardown behavior
                await context.cleanup();
            }
            
            // Verify cleanup was called and directory removed
            expect(cleanupCalled, 'Cleanup should be called').toBeTruthy();
            expect(!fs.existsSync(storagePath), 'Storage directory should be removed even after test failure').toBeTruthy();
        });

        it('should provide working RegistryManager instance', async function() {
            const context = await createE2ETestContext();
            
            try {
                // Verify RegistryManager is available
                expect(context.registryManager, 'RegistryManager should be available').toBeTruthy();
                
                // Verify storage is available
                expect(context.storage, 'Storage should be available').toBeTruthy();
                
                // Verify storage paths point to temp directory
                const paths = context.storage.getPaths();
                expect(paths.root.startsWith(context.tempStoragePath) || 
                    paths.root === context.tempStoragePath, 'Storage root should be in temp directory').toBeTruthy();
            } finally {
                await context.cleanup();
            }
        });
    });

    describe('generateTestId', () => {
        it('should generate unique IDs', () => {
            const id1 = generateTestId();
            const id2 = generateTestId();
            
            expect(id1, 'Generated IDs should be unique').not.toBe(id2);
        });

        it('should include prefix in ID', () => {
            const id = generateTestId('my-prefix');
            
            expect(id.startsWith('my-prefix-'), 'ID should start with prefix').toBeTruthy();
        });
    });

    describe('waitForCondition', () => {
        it('should resolve when condition becomes true', async function() {
            let counter = 0;
            const condition = () => {
                counter++;
                return counter >= 3;
            };
            
            await waitForCondition(condition, 2000, 50);
            
            expect(counter >= 3, 'Condition should have been checked multiple times').toBeTruthy();
        });

        it('should reject on timeout', async function() {
            const condition = () => false; // Never true
            
            try {
                await waitForCondition(condition, 200, 50);
                expect.fail('Should have thrown timeout error');
            } catch (error: any) {
                expect(error.message.includes('timeout'), 'Error should mention timeout').toBeTruthy();
            }
        });
    });
});
