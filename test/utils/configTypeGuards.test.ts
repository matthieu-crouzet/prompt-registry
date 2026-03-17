/**
 * Tests for configuration type guards
 */

import {
    isValidUpdateCheckFrequency,
    isValidNotificationPreference,
    getValidUpdateCheckFrequency,
    getValidNotificationPreference,
    UpdateCheckFrequency,
    NotificationPreference
} from '../../src/utils/configTypeGuards';

describe('configTypeGuards', () => {
    describe('isValidUpdateCheckFrequency()', () => {
        it('should return true for "daily"', () => {
            expect(isValidUpdateCheckFrequency('daily')).toBe(true);
        });

        it('should return true for "weekly"', () => {
            expect(isValidUpdateCheckFrequency('weekly')).toBe(true);
        });

        it('should return true for "manual"', () => {
            expect(isValidUpdateCheckFrequency('manual')).toBe(true);
        });

        it('should return false for invalid string', () => {
            expect(isValidUpdateCheckFrequency('hourly')).toBe(false);
            expect(isValidUpdateCheckFrequency('monthly')).toBe(false);
            expect(isValidUpdateCheckFrequency('')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(isValidUpdateCheckFrequency(123)).toBe(false);
            expect(isValidUpdateCheckFrequency(true)).toBe(false);
            expect(isValidUpdateCheckFrequency(null)).toBe(false);
            expect(isValidUpdateCheckFrequency(undefined)).toBe(false);
            expect(isValidUpdateCheckFrequency({})).toBe(false);
            expect(isValidUpdateCheckFrequency([])).toBe(false);
        });
    });

    describe('isValidNotificationPreference()', () => {
        it('should return true for "all"', () => {
            expect(isValidNotificationPreference('all')).toBe(true);
        });

        it('should return true for "critical"', () => {
            expect(isValidNotificationPreference('critical')).toBe(true);
        });

        it('should return true for "none"', () => {
            expect(isValidNotificationPreference('none')).toBe(true);
        });

        it('should return false for invalid string', () => {
            expect(isValidNotificationPreference('some')).toBe(false);
            expect(isValidNotificationPreference('important')).toBe(false);
            expect(isValidNotificationPreference('')).toBe(false);
        });

        it('should return false for non-string values', () => {
            expect(isValidNotificationPreference(123)).toBe(false);
            expect(isValidNotificationPreference(true)).toBe(false);
            expect(isValidNotificationPreference(null)).toBe(false);
            expect(isValidNotificationPreference(undefined)).toBe(false);
            expect(isValidNotificationPreference({})).toBe(false);
            expect(isValidNotificationPreference([])).toBe(false);
        });
    });

    describe('getValidUpdateCheckFrequency()', () => {
        it('should return valid frequency unchanged', () => {
            expect(getValidUpdateCheckFrequency('daily')).toBe('daily');
            expect(getValidUpdateCheckFrequency('weekly')).toBe('weekly');
            expect(getValidUpdateCheckFrequency('manual')).toBe('manual');
        });

        it('should return default "daily" for invalid values', () => {
            expect(getValidUpdateCheckFrequency('hourly')).toBe('daily');
            expect(getValidUpdateCheckFrequency('')).toBe('daily');
            expect(getValidUpdateCheckFrequency(123)).toBe('daily');
            expect(getValidUpdateCheckFrequency(null)).toBe('daily');
            expect(getValidUpdateCheckFrequency(undefined)).toBe('daily');
        });

        it('should use custom default when provided', () => {
            expect(getValidUpdateCheckFrequency('invalid', 'weekly')).toBe('weekly');
            expect(getValidUpdateCheckFrequency(null, 'manual')).toBe('manual');
        });
    });

    describe('getValidNotificationPreference()', () => {
        it('should return valid preference unchanged', () => {
            expect(getValidNotificationPreference('all')).toBe('all');
            expect(getValidNotificationPreference('critical')).toBe('critical');
            expect(getValidNotificationPreference('none')).toBe('none');
        });

        it('should return default "all" for invalid values', () => {
            expect(getValidNotificationPreference('some')).toBe('all');
            expect(getValidNotificationPreference('')).toBe('all');
            expect(getValidNotificationPreference(123)).toBe('all');
            expect(getValidNotificationPreference(null)).toBe('all');
            expect(getValidNotificationPreference(undefined)).toBe('all');
        });

        it('should use custom default when provided', () => {
            expect(getValidNotificationPreference('invalid', 'critical')).toBe('critical');
            expect(getValidNotificationPreference(null, 'none')).toBe('none');
        });
    });
});
