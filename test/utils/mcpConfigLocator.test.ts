import * as path from 'path';
import * as os from 'os';
import { McpConfigLocator } from '../../src/utils/mcpConfigLocator';

describe('McpConfigLocator Test Suite', () => {

    it('getUserMcpConfigPath returns correct path for current platform', () => {
        const configPath = McpConfigLocator.getUserMcpConfigPath();
        expect(configPath, 'Config path should not be empty').toBeTruthy();
        expect(configPath.includes('mcp.json'), 'Path should contain mcp.json').toBeTruthy();
        
        const platform = os.platform();
        if (platform === 'linux') {
            expect(configPath.includes('.config'), 'Linux path should contain .config').toBeTruthy();
        } else if (platform === 'darwin') {
            expect(configPath.includes('Library/Application Support'), 'macOS path should contain Library/Application Support').toBeTruthy();
        } else if (platform === 'win32') {
            expect(configPath.includes('AppData'), 'Windows path should contain AppData').toBeTruthy();
        }
    });

    it('getUserTrackingPath returns correct path parallel to mcp.json', () => {
        const trackingPath = McpConfigLocator.getUserTrackingPath();
        const configPath = McpConfigLocator.getUserMcpConfigPath();
        
        expect(trackingPath, 'Tracking path should not be empty').toBeTruthy();
        expect(trackingPath.includes('prompt-registry-mcp-tracking.json'), 'Path should contain tracking filename').toBeTruthy();
        expect(path.dirname(trackingPath), 'Tracking file should be in same directory as mcp.json').toBe(path.dirname(configPath));
    });

    it('getMcpConfigLocation returns location info for user scope', () => {
        const location = McpConfigLocator.getMcpConfigLocation('user');
        
        expect(location, 'Should return location object').toBeTruthy();
        expect(location.configPath, 'Should have config path').toBeTruthy();
        expect(location.trackingPath, 'Should have tracking path').toBeTruthy();
        expect(typeof location.exists, 'Should have exists flag').toBe('boolean');
    });
});
