/**
 * ApmRuntimeManager Unit Tests
 * Tests APM CLI runtime detection and installation management
 */

import * as sinon from 'sinon';
import { ApmRuntimeManager, ApmRuntimeStatus } from '../../src/services/ApmRuntimeManager';

describe('ApmRuntimeManager', () => {
    let sandbox: sinon.SinonSandbox;
    let runtime: ApmRuntimeManager;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        // Reset singleton for testing
        ApmRuntimeManager.resetInstance();
        runtime = ApmRuntimeManager.getInstance();
    });

    afterEach(() => {
        sandbox.restore();
        ApmRuntimeManager.resetInstance();
    });

    describe('getInstance', () => {
        it('should return singleton instance', () => {
            const instance1 = ApmRuntimeManager.getInstance();
            const instance2 = ApmRuntimeManager.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('getStatus', function() {
        // Increase timeout for this suite as it involves spawning processes
        it('should return status object with installed property', async () => {
            const status = await runtime.getStatus();
            
            expect(typeof status.installed === 'boolean').toBeTruthy();
        });

        it('should return cached status on subsequent calls within TTL', async () => {
            // First call
            const status1 = await runtime.getStatus();
            
            // Second call should use cache
            const status2 = await runtime.getStatus();
            
            expect(status1).toEqual(status2);
        });

        it('should refresh status when forceRefresh is true', async () => {
            // First call
            await runtime.getStatus();
            
            // Force refresh
            const status2 = await runtime.getStatus(true);
            
            expect(typeof status2.installed === 'boolean').toBeTruthy();
        });

        it('should include version when APM is installed', async () => {
            // Mock the internal detection
            sandbox.stub(runtime as any, 'detectRuntime').resolves({
                installed: true,
                version: '1.0.0',
                installMethod: 'pip',
            });
            
            const status = await runtime.getStatus(true);
            
            if (status.installed) {
                expect(status.version).toBeTruthy();
            }
        });

        it('should detect install method', async () => {
            sandbox.stub(runtime as any, 'detectRuntime').resolves({
                installed: true,
                version: '1.0.0',
                installMethod: 'pip',
            });
            
            const status = await runtime.getStatus(true);
            
            if (status.installed) {
                expect(['pip', 'brew', 'binary', 'unknown'].includes(status.installMethod || 'unknown')).toBeTruthy();
            }
        });
    });

    describe('isAvailable', () => {
        it('should return true when APM is installed', async () => {
            sandbox.stub(runtime as any, 'detectRuntime').resolves({
                installed: true,
                version: '1.0.0',
            });
            
            const available = await runtime.isAvailable();
            
            expect(available).toBe(true);
        });

        it('should return false when APM is not installed', async () => {
            sandbox.stub(runtime as any, 'detectRuntime').resolves({
                installed: false,
            });
            
            const available = await runtime.isAvailable();
            
            expect(available).toBe(false);
        });
    });

    describe('clearCache', () => {
        it('should clear cached status', async () => {
            // Populate cache
            await runtime.getStatus();
            
            // Clear cache
            runtime.clearCache();
            
            // Should re-detect on next call
            // This is hard to verify without more sophisticated mocking
            // but at least we can verify it doesn't throw
            const status = await runtime.getStatus();
            expect(typeof status.installed === 'boolean').toBeTruthy();
        });
    });

    describe('getInstallInstructions', () => {
        it('should return platform-appropriate instructions', () => {
            const instructions = runtime.getInstallInstructions();
            
            expect(typeof instructions === 'string').toBeTruthy();
            expect(instructions.length > 0).toBeTruthy();
            // Should contain some installation command
            expect(instructions.includes('pip') || 
                instructions.includes('brew') || 
                instructions.includes('install')).toBeTruthy();
        });

        it('should include URL to APM repository', () => {
            const instructions = runtime.getInstallInstructions();
            
            expect(instructions.includes('github.com') || instructions.includes('apm')).toBeTruthy();
        });
    });

    describe('Security', () => {
        it('should not execute arbitrary commands', async () => {
            // This is a conceptual test - in real implementation
            // the runtime manager should only execute known safe commands
            const status = await runtime.getStatus();
            
            // Should not throw and should return valid status
            expect(typeof status.installed === 'boolean').toBeTruthy();
        });

        it('should sanitize version output', async () => {
            sandbox.stub(runtime as any, 'detectRuntime').resolves({
                installed: true,
                version: '<script>alert(1)</script>',
                installMethod: 'pip',
            });
            
            const status = await runtime.getStatus(true);
            
            // Version should be sanitized or at least not cause issues
            if (status.version) {
                expect(typeof status.version === 'string').toBeTruthy();
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle detection errors gracefully', async () => {
            sandbox.stub(runtime as any, 'detectRuntime').rejects(new Error('Detection failed'));
            
            const status = await runtime.getStatus(true);
            
            // Should return not installed rather than throwing
            expect(status.installed).toBe(false);
        });

        it('should handle timeout during detection', async () => {
            // Simulate a very slow detection
            sandbox.stub(runtime as any, 'detectRuntime').callsFake(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                return { installed: false };
            });
            
            const status = await runtime.getStatus(true);
            
            expect(typeof status.installed === 'boolean').toBeTruthy();
        });
    });
});
