import { describe, it, expect, beforeEach } from '@jest/globals';

// Mock functions
const mockStartMCPServer = jest.fn();
const mockStop = jest.fn();

jest.mock('@code-ai/shared/server/mcp-server', () => ({
  startMCPServer: mockStartMCPServer,
}));

describe('Local MCP Server', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStartMCPServer.mockResolvedValue({
      stop: mockStop
    });
  });

  it('should start MCP server successfully', async () => {
    // Mock console.error to avoid output during tests
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Import and run the main function directly
    const { main } = await import('./index');
    await main();
    
    expect(mockStartMCPServer).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('🚀 Local MCP Server started successfully');
    expect(consoleSpy).toHaveBeenCalledWith('📡 Ready to receive commands from Claude Code');
    
    consoleSpy.mockRestore();
  });

  it('should handle startup errors', async () => {
    const testError = new Error('Startup failed');
    mockStartMCPServer.mockRejectedValue(testError);
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('Process exit called');
    }) as any);
    
    try {
      const { main } = await import('./index');
      await main();
    } catch (error) {
      expect((error as Error).message).toBe('Process exit called');
    }
    
    expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to start Local MCP Server:', testError);
    expect(exitSpy).toHaveBeenCalledWith(1);
    
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should handle process signals correctly', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    
    // Mock process.on to track listener registration without actually registering them
    const processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process);
    
    // Start server to set up the process handlers
    const { main } = await import('./index');
    await main();
    
    // Verify that process handlers were registered
    expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    expect(processOnSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
    
    processOnSpy.mockRestore();
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe('Main function error handling', () => {
  it('should handle unhandled promise rejections', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    
    const testError = new Error('Unhandled error');
    mockStartMCPServer.mockRejectedValue(testError);
    
    const { main } = await import('./index');
    
    // This should trigger the catch block in main
    try {
      await main();
    } catch (error) {
      // main should catch and call process.exit, not throw
    }
    
    expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to start Local MCP Server:', testError);
    expect(exitSpy).toHaveBeenCalledWith(1);
    
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});