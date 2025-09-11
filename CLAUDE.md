# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 기본 설정
- **모든 대화에는 [답변] 라는 키워드를 붙여줘**

## Commands

### Monorepo Management
- **Install all packages**: `npm install` - Installs dependencies for all workspaces
- **Build all**: `npm run build` - Builds all packages in the monorepo
- **Clean all**: `npm run clean` - Cleans all package distributions

### Local MCP Server (NestJS v11)
- **Development mode**: `npm run dev:local` - Runs NestJS server with hot reload
- **Build**: `npm run build -w @code-ai/local-mcp`
- **Test**: `npm test -w @code-ai/local-mcp`

### AWS API Server
- **Development mode**: `npm run dev:aws` - Runs both HTTP and gRPC servers
- **Build**: `npm run build -w @code-ai/aws-api`
- **Deploy**: `cd packages/aws-api && npm run deploy` - Deploy using AWS CDK

### Docker Infrastructure
- **Start services**: `docker-compose up -d` - Starts ChromaDB, Redis, PostgreSQL, MinIO, and Nginx
- **Stop services**: `docker-compose down`

## Architecture

This is a monorepo architecture with three main packages:

### Package Structure

**`packages/local-mcp`** - Local MCP Server
- **Framework**: NestJS v11
- **Main Module**: `src/app.module.ts`
- **MCP Service**: `src/mcp/mcp.service.ts` - Implements MCP protocol handlers
- **gRPC Client**: `src/grpc/grpc-client.service.ts` - Communicates with AWS server
- **Analysis Module**: Handles streaming responses and chat sessions

**`packages/aws-api`** - AWS API Server
- **Runtime**: Node.js + Express + gRPC
- **gRPC Server**: `src/grpc/grpc.server.ts` - Implements all RPC methods
- **Ports**: HTTP (3000), gRPC (50051)
- **AI Integration**: OpenAI API for semantic search and chat

**`packages/shared`** - Shared Types and Proto
- **Proto Definitions**: `proto/analysis.proto` - gRPC service definitions
- **Type System**: Zod schemas for validation
- **Utilities**: Common helper functions

### Communication Patterns

**gRPC Methods**:
1. **Unary RPC**: `learnCodebase` - Simple request/response
2. **Server Streaming**:
   - `analyzeCodebase` - Progress updates
   - `searchCode` - Search results
   - `analyzeDiff` - Diff analysis
3. **Bidirectional Streaming**: `chatWithCode` - Interactive chat

### Key Technical Decisions

- **NestJS v11**: Latest version for modern features and performance
- **gRPC + HTTP/2**: Efficient binary protocol with streaming support
- **Protocol Buffers**: Type-safe service definitions
- **RxJS Observables**: Stream handling in NestJS
- **SSE (Server-Sent Events)**: Web client streaming support
- **Monorepo with npm workspaces**: Shared dependencies and coordinated builds

### Environment Variables

Required environment variables:
- `OPENAI_API_KEY`: OpenAI API key for AI features
- `GRPC_SERVER_URL`: gRPC server address (default: localhost:50051)
- `PORT`: HTTP server port (local: 3001, aws: 3000)
- `GRPC_PORT`: gRPC server port (default: 50051)

### Infrastructure Services

Docker Compose provides:
- **ChromaDB**: Vector database for embeddings (port: 8000)
- **Redis**: Caching layer (port: 6379)
- **PostgreSQL**: Metadata storage (port: 5432)
- **MinIO**: S3-compatible storage (port: 9000)
- **Nginx**: Reverse proxy (port: 80)

## Development Notes

### Adding New MCP Tools
1. Define gRPC service in `packages/shared/proto/analysis.proto`
2. Implement server handler in `packages/aws-api/src/grpc/grpc.server.ts`
3. Add client method in `packages/local-mcp/src/grpc/grpc-client.service.ts`
4. Register MCP tool in `packages/local-mcp/src/mcp/mcp.service.ts`

### Best Practices
- Use streaming for large data transfers or real-time updates
- Implement proper error handling in gRPC streams
- Follow NestJS module structure and dependency injection
- Maintain type safety with Protocol Buffers and Zod schemas
- Use npm workspaces commands for package-specific operations