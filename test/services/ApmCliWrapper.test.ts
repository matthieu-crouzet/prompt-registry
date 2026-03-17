/**
 * ApmCliWrapper Unit Tests
 * Tests APM CLI command execution wrapper
 */

import * as sinon from 'sinon';
import * as path from 'path';
import * as os from 'os';
import { ApmCliWrapper, ApmInstallResult } from '../../src/services/ApmCliWrapper';
import { ApmRuntimeManager } from '../../src/services/ApmRuntimeManager';

describe('ApmCliWrapper', () => {
    let sandbox: sinon.SinonSandbox;
    let wrapper: ApmCliWrapper;
    let mockRuntime: sinon.SinonStubbedInstance<ApmRuntimeManager>;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        
        // Mock runtime manager
        ApmRuntimeManager.resetInstance();
        mockRuntime = sandbox.createStubInstance(ApmRuntimeManager);
        mockRuntime.getStatus.resolves({ installed: true, version: '1.0.0' });
        mockRuntime.isAvailable.resolves(true);
        
        // Replace getInstance to return mock
        sandbox.stub(ApmRuntimeManager, 'getInstance').returns(mockRuntime as unknown as ApmRuntimeManager);
        
        wrapper = new ApmCliWrapper();
    });

    afterEach(() => {
        sandbox.restore();
        ApmRuntimeManager.resetInstance();
    });

    describe('Constructor', () => {
        it('should create instance', () => {
            expect(wrapper).toBeTruthy();
        });
    });

    describe('isRuntimeAvailable', () => {
        it('should return true when APM is installed', async () => {
            mockRuntime.getStatus.resolves({ installed: true, uvxAvailable: false });
            
            const available = await wrapper.isRuntimeAvailable();
            
            expect(available).toBe(true);
        });

        it('should return true when uvx is available even if APM is not installed', async () => {
            mockRuntime.getStatus.resolves({ installed: false, uvxAvailable: true });
            
            const available = await wrapper.isRuntimeAvailable();
            
            expect(available).toBe(true);
        });

        it('should return false when neither is available', async () => {
            mockRuntime.getStatus.resolves({ installed: false, uvxAvailable: false });
            
            const available = await wrapper.isRuntimeAvailable();
            
            expect(available).toBe(false);
        });
    });

    describe('getVersion', () => {
        it('should return version when APM is installed', async () => {
            mockRuntime.getStatus.resolves({ 
                installed: true, 
                version: '2.0.0' 
            });
            
            const version = await wrapper.getVersion();
            
            expect(version).toBe('2.0.0');
        });

        it('should return undefined when APM is not installed', async () => {
            mockRuntime.getStatus.resolves({ installed: false });
            
            const version = await wrapper.getVersion();
            
            expect(version).toBe(undefined);
        });
    });

    describe('validatePackageRef', () => {
        it('should accept valid owner/repo format', () => {
            expect(wrapper.validatePackageRef('owner/repo')).toBeTruthy();
        });

        it('should accept owner/repo/path format', () => {
            expect(wrapper.validatePackageRef('owner/repo/some/path')).toBeTruthy();
        });

        it('should reject empty string', () => {
            expect(wrapper.validatePackageRef('')).toBe(false);
        });

        it('should reject strings with spaces', () => {
            expect(wrapper.validatePackageRef('owner /repo')).toBe(false);
        });

        it('should reject strings without slash', () => {
            expect(wrapper.validatePackageRef('ownerrepo')).toBe(false);
        });

        it('should reject strings starting with slash', () => {
            expect(wrapper.validatePackageRef('/owner/repo')).toBe(false);
        });

        it('should reject strings ending with slash', () => {
            expect(wrapper.validatePackageRef('owner/repo/')).toBe(false);
        });

        it('should reject strings with special characters', () => {
            expect(wrapper.validatePackageRef('owner/repo;rm -rf')).toBe(false);
        });

        it('should reject strings with shell metacharacters', () => {
            expect(wrapper.validatePackageRef('owner/repo$(whoami)')).toBe(false);
        });
    });

    describe('install', () => {
        it('should return error when runtime not available', async () => {
            mockRuntime.getStatus.resolves({ installed: false, uvxAvailable: false });
            
            const result = await wrapper.install('owner/repo', '/tmp/target');
            
            expect(result.success).toBe(false);
            expect(result.error?.includes('not installed')).toBeTruthy();
        });

        it('should reject invalid package reference', async () => {
            const result = await wrapper.install('invalid', '/tmp/target');
            
            expect(result.success).toBe(false);
            expect(result.error?.includes('Invalid package reference')).toBeTruthy();
        });

        it('should reject path traversal in target directory', async () => {
            const result = await wrapper.install('owner/repo', '/tmp/../etc/target');
            
            expect(result.success).toBe(false);
            expect(result.error?.includes('Invalid') || result.error?.includes('path')).toBeTruthy();
        });
    });

    describe('Security', () => {
        it('should sanitize package references', () => {
            // Should reject anything with shell metacharacters
            const dangerous = [
                'owner/repo; rm -rf /',
                'owner/repo | cat /etc/passwd',
                'owner/repo && whoami',
                'owner/repo`id`',
                '$(cat /etc/passwd)',
                'owner/repo\nmalicious',
            ];
            
            for (const ref of dangerous) {
                expect(wrapper.validatePackageRef(ref), `Should reject: ${ref}`).toBe(false);
            }
        });

        it('should not allow absolute paths as package refs', () => {
            expect(wrapper.validatePackageRef('/etc/passwd')).toBe(false);
            expect(wrapper.validatePackageRef('C:\\Windows\\System32')).toBe(false);
        });

        it('should not allow URLs as package refs', () => {
            expect(wrapper.validatePackageRef('http://evil.com/malware')).toBe(false);
            expect(wrapper.validatePackageRef('https://evil.com/malware')).toBe(false);
        });
    });

    describe('Error Handling', () => {
        it('should handle runtime errors gracefully', async () => {
            mockRuntime.getStatus.rejects(new Error('Runtime error'));
            
            const result = await wrapper.install('owner/repo', '/tmp/target');
            
            expect(result.success).toBe(false);
            expect(result.error).toBeTruthy();
        });

        it('should provide meaningful error messages', async () => {
            mockRuntime.getStatus.resolves({ installed: false, uvxAvailable: false });
            
            const result = await wrapper.install('owner/repo', '/tmp/target');
            
            expect(result.error).toBeTruthy();
            expect(result.error.length > 10).toBeTruthy(); // Not just "error"
        });
    });
});
