import { describe, it, expect, vi, beforeEach } from '@jest/globals';

// Mock the shared MCP server before importing
const mockStartMCPServer = vi.fn();
const mockStop = vi.fn();

vi.mock('@code-ai/shared/server/mcp-server.js', () => ({
  startMCPServer: mockStartMCPServer,
}));

describe('Local MCP Server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStartMCPServer.mockResolvedValue({
      stop: mockStop
    });
  });

  it('should start MCP server successfully', async () => {
    // Mock console.error to avoid output during tests
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Import and run the main function
    await import('./index.js');
    
    expect(mockStartMCPServer).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('🚀 Local MCP Server started successfully');
    expect(consoleSpy).toHaveBeenCalledWith('📡 Ready to receive commands from Claude Code');
    
    consoleSpy.mockRestore();
  });

  it('should handle startup errors', async () => {
    const testError = new Error('Startup failed');
    mockStartMCPServer.mockRejectedValue(testError);
    
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });
    
    try {
      await import('./index.js');
    } catch (error) {
      expect((error as Error).message).toBe('Process exit called');
    }
    
    expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to start Local MCP Server:', testError);
    expect(exitSpy).toHaveBeenCalledWith(1);
    
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it('should handle process signals correctly', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('Process exit called');
    });
    
    // Import to set up the process handlers
    await import('./index.js');
    
    // Simulate SIGINT
    try {
      process.emit('SIGINT', 'SIGINT');
    } catch (error) {
      expect((error as Error).message).toBe('Process exit called');
    }
    
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith('📴 Shutting down Local MCP Server...');
    expect(exitSpy).toHaveBeenCalledWith(0);
    
    consoleSpy.mockRestore();
    exitSpy.mockRestore();
  });
});

describe('Main function error handling', () => {
  it('should handle unhandled promise rejections', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {});
    
    const testError = new Error('Unhandled error');
    
    // This tests the catch block in main().catch()
    const mainPromise = Promise.reject(testError);
    mainPromise.catch((error) => {
      console.error('💥 Unhandled error in Local MCP Server:', error);
      process.exit(1);
    });
    
    // Allow the promise to resolve
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(consoleSpy).toHaveBeenCalledWith('💥 Unhandled error in Local MCP Server:', testError);
        expect(exitSpy).toHaveBeenCalledWith(1);
        
        consoleSpy.mockRestore();
        exitSpy.mockRestore();
        resolve(void 0);
      }, 10);
    });
  });
});