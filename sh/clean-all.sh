#!/bin/bash

# 전체 프로젝트 정리 스크립트
# Clean all modules (node_modules, dist, cache, etc.)

echo "🧹 Cleaning all modules..."
echo "=========================="

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 확인 메시지
echo -e "${RED}⚠️  This will remove:${NC}"
echo -e "   - All node_modules directories"
echo -e "   - All package-lock.json files"
echo -e "   - All dist directories"
echo -e "   - All coverage directories"
echo -e "   - npm cache"
echo -e "   - TypeScript build cache"
echo ""
echo -e "${YELLOW}💡 Continue? [y/N]${NC}"
read -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}❌ Cancelled by user${NC}"
    exit 0
fi

# 정리 함수
clean_directory() {
    local dir=$1
    local desc=$2
    
    if [ -d "$dir" ]; then
        echo -e "${BLUE}🗑️  Removing ${desc}: ${dir}${NC}"
        rm -rf "$dir"
    fi
}

# 루트 레벨 정리
echo -e "\n${YELLOW}🏢 Cleaning workspace root...${NC}"
clean_directory "node_modules" "workspace node_modules"
clean_directory "package-lock.json" "workspace package-lock.json"
clean_directory "dist" "workspace dist"
clean_directory "coverage" "workspace coverage"

# shared 패키지 정리
if [ -d "packages/shared" ]; then
    echo -e "\n${YELLOW}📦 Cleaning shared package...${NC}"
    cd packages/shared
    clean_directory "node_modules" "shared node_modules"
    clean_directory "package-lock.json" "shared package-lock.json"
    clean_directory "dist" "shared dist"
    clean_directory "coverage" "shared coverage"
    clean_directory ".nyc_output" "shared nyc output"
    cd ../..
fi

# local-mcp 패키지 정리
if [ -d "packages/local-mcp" ]; then
    echo -e "\n${YELLOW}📦 Cleaning local-mcp package...${NC}"
    cd packages/local-mcp
    clean_directory "node_modules" "local-mcp node_modules"
    clean_directory "package-lock.json" "local-mcp package-lock.json"
    clean_directory "dist" "local-mcp dist"
    clean_directory "coverage" "local-mcp coverage"
    cd ../..
fi

# aws-api 패키지 정리
if [ -d "packages/aws-api" ]; then
    echo -e "\n${YELLOW}📦 Cleaning aws-api package...${NC}"
    cd packages/aws-api
    clean_directory "node_modules" "aws-api node_modules"
    clean_directory "package-lock.json" "aws-api package-lock.json"
    clean_directory "dist" "aws-api dist"
    clean_directory "coverage" "aws-api coverage"
    cd ../..
fi

# 로그 파일 정리
echo -e "\n${YELLOW}📝 Cleaning log files...${NC}"
clean_directory "/tmp/local-mcp.pid" "local-mcp PID file"
clean_directory "/tmp/aws-api.pid" "aws-api PID file"

# npm 캐시 정리
echo -e "\n${YELLOW}🗂️  Cleaning npm cache...${NC}"
if command -v npm >/dev/null 2>&1; then
    npm cache clean --force
    echo -e "${GREEN}✅ npm cache cleaned${NC}"
fi

# TypeScript 빌드 캐시 정리
echo -e "\n${YELLOW}🔧 Cleaning TypeScript cache...${NC}"
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true
find . -name ".tscache" -type d -exec rm -rf {} + 2>/dev/null || true
echo -e "${GREEN}✅ TypeScript cache cleaned${NC}"

# Jest 캐시 정리
echo -e "\n${YELLOW}🧪 Cleaning test cache...${NC}"
find . -name ".jest" -type d -exec rm -rf {} + 2>/dev/null || true
npx jest --clearCache 2>/dev/null || true
echo -e "${GREEN}✅ Test cache cleaned${NC}"

# 임시 파일 정리
echo -e "\n${YELLOW}🗑️  Cleaning temporary files...${NC}"
find . -name "*.tmp" -delete 2>/dev/null || true
find . -name "*.temp" -delete 2>/dev/null || true
find . -name ".DS_Store" -delete 2>/dev/null || true
echo -e "${GREEN}✅ Temporary files cleaned${NC}"

# 디스크 사용량 표시
echo -e "\n${BLUE}💾 Current directory size:${NC}"
du -sh . 2>/dev/null || echo "Unable to calculate directory size"

# 완료 메시지
echo -e "\n${GREEN}🎉 All modules cleaned successfully!${NC}"
echo -e "\n${YELLOW}📋 Next steps:${NC}"
echo -e "   1. Install dependencies: ${BLUE}./sh/install-all.sh${NC}"
echo -e "   2. Build all packages: ${BLUE}npm run build${NC}"
echo -e "   3. Run tests: ${BLUE}./sh/test-all.sh${NC}"

# 정리된 항목 요약
echo -e "\n${YELLOW}📊 Cleaned items:${NC}"
echo -e "   ✅ All node_modules directories"
echo -e "   ✅ All package-lock.json files"  
echo -e "   ✅ All build artifacts (dist/)"
echo -e "   ✅ All test coverage reports"
echo -e "   ✅ npm cache"
echo -e "   ✅ TypeScript build cache"
echo -e "   ✅ Test runner cache"
echo -e "   ✅ Temporary files"
echo -e "   ✅ PID files"