import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { vi } from 'vitest';
import { NpmCliWrapper } from '../../src/utils/NpmCliWrapper';
import {
    createMockProcess,
    createSuccessProcess,
    createFailureProcess,
    createErrorProcess
} from '../helpers/processTestHelpers';

// Mock child_process at the module level so ESM imports are intercepted
const mockSpawn = vi.fn();
vi.mock('child_process', () => ({
    spawn: (...args: any[]) => mockSpawn(...args),
}));

describe('NpmCliWrapper', () => {
    let sandbox: sinon.SinonSandbox;
    let npmWrapper: NpmCliWrapper;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        // Reset singleton to get fresh instance
        (NpmCliWrapper as any).instance = undefined;
        npmWrapper = NpmCliWrapper.getInstance();
        mockSpawn.mockReset();
    });

    afterEach(() => {
        sandbox.restore();
        (NpmCliWrapper as any).instance = undefined;
    });

    describe('getInstance()', () => {
        it('should return singleton instance', () => {
            const instance1 = NpmCliWrapper.getInstance();
            const instance2 = NpmCliWrapper.getInstance();
            expect(instance1).toBe(instance2);
        });
    });

    describe('isAvailable()', () => {
        it('should return true when npm is available', async () => {
            const { process, emitEvents } = createSuccessProcess();
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.isAvailable();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe(true);
        });

        it('should return false when npm is not available', async () => {
            const { process, emitEvents } = createFailureProcess(1);
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.isAvailable();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe(false);
        });

        it('should return false when spawn errors', async () => {
            const { process, emitEvents } = createErrorProcess(new Error('ENOENT'));
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.isAvailable();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe(false);
        });
    });

    describe('getVersion()', () => {
        it('should return version string when npm is available', async () => {
            const { process, emitEvents } = createSuccessProcess('10.2.3\n');
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.getVersion();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe('10.2.3');
        });

        it('should return undefined when npm fails', async () => {
            const { process, emitEvents } = createFailureProcess(1);
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.getVersion();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe(undefined);
        });

        it('should return undefined when spawn errors', async () => {
            const { process, emitEvents } = createErrorProcess(new Error('ENOENT'));
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.getVersion();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe(undefined);
        });
    });

    describe('promptAndInstall()', () => {
        it('should show prompt and handle user decline', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            showInformationMessageStub.onFirstCall().resolves(undefined); // User declines
            showInformationMessageStub.onSecondCall().resolves(undefined); // User dismisses manual instruction

            const result = await npmWrapper.promptAndInstall('/test/path');

            expect(result.success).toBe(true);
            expect(showInformationMessageStub.calledTwice).toBeTruthy();
            expect(showInformationMessageStub.secondCall.args[0].includes('npm install')).toBeTruthy();
        });

        it('should return success when user chooses "No, I\'ll do it later"', async () => {
            const showInformationMessageStub = sandbox.stub(vscode.window, 'showInformationMessage');
            showInformationMessageStub.onFirstCall().resolves('No, I\'ll do it later' as any);
            showInformationMessageStub.onSecondCall().resolves(undefined);

            const result = await npmWrapper.promptAndInstall('/test/path');

            expect(result.success).toBe(true);
        });
    });

    describe('spawn shell option', () => {
        it('should pass shell option to spawn', async () => {
            const { process, emitEvents } = createSuccessProcess();
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.isAvailable();
            emitEvents();
            await resultPromise;

            expect(mockSpawn.mock.calls.length === 1).toBeTruthy();
            const spawnOptions = mockSpawn.mock.calls[0][2];
            // Verify shell option is set (value depends on platform)
            expect('shell' in spawnOptions).toBeTruthy();
        });
    });

    describe('event sequencing', () => {
        it('should handle stdout data before close', async () => {
            const { process, emitEvents } = createMockProcess({
                exitCode: 0,
                stdoutData: '9.8.1\n'
            });
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.getVersion();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe('9.8.1');
        });

        it('should handle stderr data on failure', async () => {
            const { process, emitEvents } = createMockProcess({
                exitCode: 1,
                stderrData: 'npm ERR! code ENOENT'
            });
            mockSpawn.mockReturnValue(process);

            const resultPromise = npmWrapper.getVersion();
            emitEvents();

            const result = await resultPromise;
            expect(result).toBe(undefined);
        });
    });
});
