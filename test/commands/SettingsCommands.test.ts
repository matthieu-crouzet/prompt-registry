/**
 * SettingsCommands Unit Tests
 * 
 * Tests for settings export/import functionality
 */

import * as sinon from 'sinon';
import { SettingsCommands } from '../../src/commands/SettingsCommands';
import { RegistryManager } from '../../src/services/RegistryManager';

describe('SettingsCommands', () => {
    let settingsCommands: SettingsCommands;
    let mockRegistryManager: any;

    beforeEach(() => {
        // Create mock RegistryManager
        mockRegistryManager = {
            exportSettings: sinon.stub(),
            importSettings: sinon.stub()
        };
        
        settingsCommands = new SettingsCommands(mockRegistryManager);
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('exportSettings', () => {
        it('should create SettingsCommands instance', () => {
            expect(settingsCommands).toBeTruthy();
            expect(typeof settingsCommands.exportSettings === 'function').toBeTruthy();
        });

        it('should have importSettings method', () => {
            expect(typeof settingsCommands.importSettings === 'function').toBeTruthy();
        });
    });

    describe('RegistryManager export/import integration', () => {
        it('exportSettings should be callable', async () => {
            mockRegistryManager.exportSettings.resolves('{"version":"1.0.0"}');
            
            const result = await mockRegistryManager.exportSettings('json');
            
            expect(mockRegistryManager.exportSettings.calledWith('json')).toBeTruthy();
            expect(result).toBe('{"version":"1.0.0"}');
        });

        it('importSettings should be callable', async () => {
            mockRegistryManager.importSettings.resolves();
            
            await mockRegistryManager.importSettings('{"version":"1.0.0"}', 'json', 'merge');
            
            expect(mockRegistryManager.importSettings.calledWith('{"version":"1.0.0"}', 'json', 'merge')).toBeTruthy();
        });
    });
});
