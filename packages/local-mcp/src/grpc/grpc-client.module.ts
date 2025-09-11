import { Module, Global } from '@nestjs/common';
import { GrpcClientService } from './grpc-client.service';

@Global()
@Module({
  providers: [GrpcClientService],
  exports: [GrpcClientService],
})
export class GrpcClientModule {}