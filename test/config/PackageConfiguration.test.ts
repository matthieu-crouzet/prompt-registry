/**
 * Package Configuration Tests
 * 
 * Tests for validating configuration settings in package.json
 */

import * as path from 'path';
import * as fs from 'fs';

describe('Package Configuration - Update Check Settings', () => {
    let packageJson: any;

    beforeEach(() => {
        // Load package.json
        const packagePath = path.join(process.cwd(), 'package.json');
        const packageContent = fs.readFileSync(packagePath, 'utf-8');
        packageJson = JSON.parse(packageContent);
    });

    describe('Configuration Schema Structure', () => {
        it('should prefer workspace extension host for remote environments', () => {
            expect(Array.isArray(packageJson.extensionKind), 'package.json should define extensionKind array').toBeTruthy();
            expect(packageJson.extensionKind.includes('workspace'), 'extensionKind should include workspace').toBeTruthy();
            expect(packageJson.extensionKind.includes('ui'), 'extensionKind should include ui fallback').toBeTruthy();
            expect(packageJson.extensionKind[0], 'workspace should be first so WSL/remote sessions run repository file operations in the remote host').toBe('workspace');
        });

        it('should have configuration section', () => {
            expect(packageJson.contributes, 'package.json should have contributes section').toBeTruthy();
            expect(packageJson.contributes.configuration, 'contributes should have configuration section').toBeTruthy();
            expect(packageJson.contributes.configuration.properties, 'configuration should have properties').toBeTruthy();
        });

        it('should have updateCheck.enabled setting', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.enabled'];
            
            expect(setting, 'updateCheck.enabled setting should exist').toBeTruthy();
            expect(setting.type, 'updateCheck.enabled should be boolean type').toBe('boolean');
            expect(setting.description, 'updateCheck.enabled should have description').toBeTruthy();
        });

        it('should have updateCheck.frequency setting', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.frequency'];
            
            expect(setting, 'updateCheck.frequency setting should exist').toBeTruthy();
            expect(setting.type, 'updateCheck.frequency should be string type').toBe('string');
            expect(setting.description, 'updateCheck.frequency should have description').toBeTruthy();
        });

        it('should have updateCheck.notificationPreference setting', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.notificationPreference'];
            
            expect(setting, 'updateCheck.notificationPreference setting should exist').toBeTruthy();
            expect(setting.type, 'updateCheck.notificationPreference should be string type').toBe('string');
            expect(setting.description, 'updateCheck.notificationPreference should have description').toBeTruthy();
        });

        it('should have updateCheck.autoUpdate setting', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.autoUpdate'];
            
            expect(setting, 'updateCheck.autoUpdate setting should exist').toBeTruthy();
            expect(setting.type, 'updateCheck.autoUpdate should be boolean type').toBe('boolean');
            expect(setting.description, 'updateCheck.autoUpdate should have description').toBeTruthy();
        });
    });

    describe('Default Values', () => {
        it('updateCheck.enabled should default to true', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.enabled'];
            expect(setting.default, 'updateCheck.enabled should default to true').toBe(true);
        });

        it('updateCheck.frequency should default to "daily"', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.frequency'];
            expect(setting.default, 'updateCheck.frequency should default to "daily"').toBe('daily');
        });

        it('updateCheck.notificationPreference should default to "all"', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.notificationPreference'];
            expect(setting.default, 'updateCheck.notificationPreference should default to "all"').toBe('all');
        });

        it('updateCheck.autoUpdate should default to false', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.autoUpdate'];
            expect(setting.default, 'updateCheck.autoUpdate should default to false').toBe(false);
        });
    });

    describe('Enum Options', () => {
        it('updateCheck.frequency should have correct enum values', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.frequency'];
            
            expect(Array.isArray(setting.enum), 'updateCheck.frequency should have enum array').toBeTruthy();
            expect(setting.enum.length, 'updateCheck.frequency should have 3 enum values').toBe(3);
            expect(setting.enum.includes('daily'), 'enum should include "daily"').toBeTruthy();
            expect(setting.enum.includes('weekly'), 'enum should include "weekly"').toBeTruthy();
            expect(setting.enum.includes('manual'), 'enum should include "manual"').toBeTruthy();
        });

        it('updateCheck.notificationPreference should have correct enum values', () => {
            const setting = packageJson.contributes.configuration.properties['promptregistry.updateCheck.notificationPreference'];
            
            expect(Array.isArray(setting.enum), 'updateCheck.notificationPreference should have enum array').toBeTruthy();
            expect(setting.enum.length, 'updateCheck.notificationPreference should have 3 enum values').toBe(3);
            expect(setting.enum.includes('all'), 'enum should include "all"').toBeTruthy();
            expect(setting.enum.includes('critical'), 'enum should include "critical"').toBeTruthy();
            expect(setting.enum.includes('none'), 'enum should include "none"').toBeTruthy();
        });
    });
});
