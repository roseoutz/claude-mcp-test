import { Module } from '@nestjs/common';
import { McpModule } from './mcp/mcp.module';
import { AnalysisModule } from './analysis/analysis.module';
import { GrpcClientModule } from './grpc/grpc-client.module';

@Module({
  imports: [
    GrpcClientModule,
    McpModule,
    AnalysisModule,
  ],
})
export class AppModule {}