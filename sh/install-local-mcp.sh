#!/bin/bash

# local-mcp 패키지 의존성 설치 스크립트
# Dependency installation script for local-mcp package

set -e

echo "📦 Installing local-mcp package dependencies..."
echo "=============================================="

cd "$(dirname "$0")/../packages/local-mcp"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/local-mcp${NC}"

# 패키지 정보 표시
if [ -f "package.json" ]; then
    local package_version=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    echo -e "Version: ${package_version}"
    echo -e "Type: ES Module (MCP Server)"
    
    # 의존성 정보
    local deps_count=$(node -p "Object.keys(require('./package.json').dependencies || {}).length" 2>/dev/null || echo "0")
    local dev_deps_count=$(node -p "Object.keys(require('./package.json').devDependencies || {}).length" 2>/dev/null || echo "0")
    echo -e "Dependencies: ${deps_count} production, ${dev_deps_count} development"
else
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
fi

# shared 패키지 의존성 확인
echo -e "${BLUE}🔍 Checking shared package dependency...${NC}"
if [ ! -d "../shared/dist" ]; then
    echo -e "${YELLOW}⚠️  shared package not built. Building shared first...${NC}"
    cd ../shared && npm install && npm run build
    cd ../local-mcp
fi

# 기존 node_modules 정리 (선택적)
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}🗑️  Existing node_modules found${NC}"
    echo -e "${YELLOW}💡 Clean install? [y/N]${NC}"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${BLUE}🧹 Cleaning node_modules...${NC}"
        rm -rf node_modules package-lock.json
    fi
fi

echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

# TypeScript 컴파일 확인
echo -e "${BLUE}🔍 Checking TypeScript compilation...${NC}"
if npm run build; then
    echo -e "${GREEN}✅ TypeScript compilation successful${NC}"
    
    # 바이너리 실행 가능성 확인
    if [ -f "dist/index.js" ]; then
        echo -e "${GREEN}📦 Binary created: dist/index.js${NC}"
        # shebang 확인
        if head -n1 dist/index.js | grep -q "#!/usr/bin/env node"; then
            echo -e "${GREEN}🔧 Executable shebang found${NC}"
        else
            echo -e "${YELLOW}⚠️  Adding executable shebang to binary...${NC}"
            sed -i '1i#!/usr/bin/env node' dist/index.js
        fi
        chmod +x dist/index.js
    fi
else
    echo -e "${YELLOW}⚠️  TypeScript compilation had issues${NC}"
fi

# 설치 완료 정보
if [ -d "node_modules" ]; then
    local installed_count=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo -e "${GREEN}📊 Installed packages: $((installed_count - 1))${NC}"
fi

echo -e "${GREEN}✅ local-mcp package dependencies installed successfully!${NC}"

# MCP 서버 설정 안내
echo -e "\n${YELLOW}📋 Claude Code Integration:${NC}"
echo -e "   Binary path: ${BLUE}$(pwd)/dist/index.js${NC}"
echo -e "   Development: ${BLUE}./sh/dev-local-mcp.sh${NC}"
echo -e "   Production: ${BLUE}./sh/start-local-mcp.sh${NC}"
echo -e "   Test: ${BLUE}./sh/test-local-mcp.sh${NC}"

# 환경 변수 확인
echo -e "\n${YELLOW}🔑 Environment Variables:${NC}"
[ ! -z "$OPENAI_API_KEY" ] && echo -e "   OPENAI_API_KEY: ${GREEN}✅ SET${NC}" || echo -e "   OPENAI_API_KEY: ${RED}❌ NOT SET${NC}"
[ ! -z "$GITHUB_TOKEN" ] && echo -e "   GITHUB_TOKEN: ${GREEN}✅ SET${NC}" || echo -e "   GITHUB_TOKEN: ${RED}❌ NOT SET${NC}"