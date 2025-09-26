#!/bin/bash

# shared 패키지 의존성 설치 스크립트
# Dependency installation script for shared package

set -e

echo "📦 Installing shared package dependencies..."
echo "==========================================="

cd "$(dirname "$0")/../packages/shared"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/shared${NC}"

# 패키지 정보 표시
if [ -f "package.json" ]; then
    local package_version=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    echo -e "Version: ${package_version}"
    
    # 의존성 정보
    local deps_count=$(node -p "Object.keys(require('./package.json').dependencies || {}).length" 2>/dev/null || echo "0")
    local dev_deps_count=$(node -p "Object.keys(require('./package.json').devDependencies || {}).length" 2>/dev/null || echo "0")
    echo -e "Dependencies: ${deps_count} production, ${dev_deps_count} development"
else
    echo -e "${RED}❌ package.json not found${NC}"
    exit 1
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
else
    echo -e "${YELLOW}⚠️  TypeScript compilation had issues${NC}"
fi

# 설치 완료 정보
if [ -d "node_modules" ]; then
    local installed_count=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo -e "${GREEN}📊 Installed packages: $((installed_count - 1))${NC}"
fi

echo -e "${GREEN}✅ shared package dependencies installed successfully!${NC}"

# 다음 단계 안내
echo -e "\n${YELLOW}📋 Next steps:${NC}"
echo -e "   - Test: ${BLUE}./sh/test-shared.sh${NC}"
echo -e "   - Install other modules: ${BLUE}./sh/install-local-mcp.sh${NC}"