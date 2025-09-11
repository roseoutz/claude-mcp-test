import { Controller, Post, Get } from '@nestjs/common';
import { McpService } from './mcp.service';

@Controller('mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Get('status')
  getStatus() {
    return {
      status: 'active',
      service: 'local-mcp',
      timestamp: new Date().toISOString(),
    };
  }

  @Post('start')
  async startMcp() {
    await this.mcpService.startMcpServer();
    return {
      message: 'MCP Server started',
      timestamp: new Date().toISOString(),
    };
  }
}