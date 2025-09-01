import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LogService, LogLevel } from '../log.service';

describe('LogService', () => {
  let logService: LogService;
  let consoleSpies: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    logService = new LogService();

    // Mock console methods to prevent actual console output during tests
    consoleSpies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    // Restore the original console methods after each test
    vi.restoreAllMocks();
  });

  it('should log info messages when level is Info', () => {
    logService.setLevel(LogLevel.Info);
    logService.info('Test info message');

    expect(consoleSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('\x1b[32m[info]\x1b[0m'),
      'Test info message',
    );
  });

  it('should not log debug messages when level is Info', () => {
    logService.setLevel(LogLevel.Info);
    logService.debug('Test debug message');

    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });

  it('should log debug messages when level is Debug', () => {
    logService.setLevel(LogLevel.Debug);
    logService.debug('Test debug message');

    expect(consoleSpies.debug).toHaveBeenCalledWith(
      expect.stringContaining('\x1b[34m[debug]\x1b[0m'),
      'Test debug message',
    );
  });

  it('should log error messages regardless of level', () => {
    logService.setLevel(LogLevel.Error);
    logService.error('Test error message');

    expect(consoleSpies.error).toHaveBeenCalledWith(
      expect.stringContaining('\x1b[31m[error]\x1b[0m'),
      'Test error message',
    );
  });

  it('should not log info messages when level is Warn', () => {
    logService.setLevel(LogLevel.Warn);
    logService.info('Test info message');

    expect(consoleSpies.info).not.toHaveBeenCalled();
  });

  it('should log warn messages when level is Warn', () => {
    logService.setLevel(LogLevel.Warn);
    logService.warn('Test warn message');

    expect(consoleSpies.warn).toHaveBeenCalledWith(
      expect.stringContaining('\x1b[33m[warn]\x1b[0m'),
      'Test warn message',
    );
  });

  it('should not log any messages when level is Off', () => {
    logService.setLevel(LogLevel.Off);
    logService.error('Test error message');
    logService.warn('Test warn message');
    logService.info('Test info message');
    logService.debug('Test debug message');

    expect(consoleSpies.error).not.toHaveBeenCalled();
    expect(consoleSpies.warn).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });

  it('should include color codes in the output', () => {
    logService.setLevel(LogLevel.Debug);
    logService.debug('Test debug message');

    expect(consoleSpies.debug).toHaveBeenCalledWith('\x1b[34m[debug]\x1b[0m', 'Test debug message');
  });

  it('should change log level at runtime', () => {
    logService.setLevel(LogLevel.Warn);
    logService.info('Test info message');

    expect(consoleSpies.info).not.toHaveBeenCalled();

    logService.setLevel(LogLevel.Info);
    logService.info('Test info message');

    expect(consoleSpies.info).toHaveBeenCalledWith(
      expect.stringContaining('\x1b[32m[info]\x1b[0m'),
      'Test info message',
    );
  });

  it('should default to Info level if not set', () => {
    logService.info('Test info message');

    expect(consoleSpies.info).toHaveBeenCalled();

    logService.debug('Test debug message');

    expect(consoleSpies.debug).not.toHaveBeenCalled();
  });
});
