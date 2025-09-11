# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 기본 설정
- **모든 대화에는 [답변] 라는 키워드를 붙여줘**

## Commands

### Building and Running
- **Build TypeScript**: `npm run build` - Compiles TypeScript to JavaScript in `/dist`
- **Development mode**: `npm run dev` - Runs TypeScript directly with hot reload using tsx
- **Production mode**: `npm start` - Runs compiled JavaScript from `/dist`
- **Clean build**: `npm run clean` - Removes `/dist` directory

### Testing and Quality
- **Run tests**: `npm test` - Executes Vitest test suite
- **Lint code**: `npm run lint` - Runs ESLint on all TypeScript files in `/src`

### Docker Infrastructure
- **Start services**: `docker-compose up -d` - Starts ChromaDB, Redis, PostgreSQL, MinIO, and Nginx
- **Stop services**: `docker-compose down`

## Architecture

This is a TypeScript/Node.js MCP (Model Context Protocol) server that provides codebase analysis tools. The project follows an ES Module structure (`"type": "module"` in package.json) and targets ES2022.

### Core Components

**MCP Server** (`src/server.ts`)
- Main entry point implementing the MCP protocol using `@modelcontextprotocol/sdk`
- Communicates via STDIO transport
- Registers and handles tool calls

**Tool Implementations** (`src/tools/`)
- `learn-codebase.ts`: Analyzes Git repositories, extracts file statistics, identifies components (currently the only implemented tool)
- `analyze-diff.ts`: Branch difference analysis (not yet implemented)
- `explain-feature.ts`: Feature explanation (not yet implemented)  
- `analyze-impact.ts`: Change impact analysis (not yet implemented)

**Service Layer** (`src/services/`)
- `auth.service.ts`: Handles GitHub token authentication

**Configuration** (`src/config/`)
- `security.ts`: Security settings and file restrictions

### Key Technical Decisions

- **Git Operations**: Uses `simple-git` library for all repository interactions
- **File Pattern Matching**: `glob` package for efficient file discovery
- **AI Integration**: OpenAI API for code analysis features
- **TypeScript Configuration**: Strict mode enabled with all type checking flags

### Environment Variables

Required environment variables (see `.env.example`):
- `OPENAI_API_KEY`: OpenAI API key for AI features
- `GITHUB_TOKEN`: GitHub authentication token
- Various security and configuration settings for file size limits, allowed paths, etc.

### Infrastructure Services

The project includes Docker Compose configuration for:
- **ChromaDB**: Vector database for embeddings
- **Redis**: Caching layer
- **PostgreSQL**: Metadata storage
- **MinIO**: S3-compatible object storage
- **Nginx**: Reverse proxy

## Development Notes

- When adding new MCP tools, follow the existing pattern in `src/tools/learn-codebase.ts`
- All tools should be registered in `src/server.ts` with proper input/output schemas
- The project uses ES modules - ensure all imports include file extensions (`.js` in compiled code)
- TypeScript strict mode is enabled - maintain type safety in all code