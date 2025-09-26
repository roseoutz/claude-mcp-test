#!/bin/bash

# 전체 프로젝트 의존성 일괄 설치 스크립트
# Bulk dependency installation script for all modules

set -e

echo "📦 Installing dependencies for all modules..."
echo "============================================="

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# 설치 결과 추적
TOTAL_MODULES=0
SUCCESS_MODULES=0
FAILED_MODULES=()

# 헬퍼 함수
install_module() {
    local module=$1
    local module_path=$2
    
    echo -e "\n${BLUE}📦 Installing dependencies for: ${module}${NC}"
    echo "----------------------------------------"
    
    if [ ! -d "$module_path" ]; then
        echo -e "${RED}❌ Module directory not found: $module_path${NC}"
        FAILED_MODULES+=("$module (directory not found)")
        return 1
    fi
    
    cd "$module_path"
    
    # package.json 확인
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found in $module_path${NC}"
        FAILED_MODULES+=("$module (no package.json)")
        cd - > /dev/null
        return 1
    fi
    
    echo -e "${YELLOW}📋 Package info:${NC}"
    local package_name=$(node -p "require('./package.json').name" 2>/dev/null || echo "unknown")
    local package_version=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
    echo -e "   Name: ${package_name}"
    echo -e "   Version: ${package_version}"
    
    # 기존 node_modules 확인
    if [ -d "node_modules" ]; then
        local modules_count=$(find node_modules -maxdepth 1 -type d | wc -l)
        echo -e "${YELLOW}🗂️  Existing modules: $((modules_count - 1)) packages${NC}"
    fi
    
    # npm install 실행
    echo -e "${BLUE}🔧 Running npm install...${NC}"
    if npm install; then
        echo -e "${GREEN}✅ ${module} dependencies installed successfully${NC}"
        SUCCESS_MODULES=$((SUCCESS_MODULES + 1))
        
        # 설치된 패키지 수 표시
        if [ -d "node_modules" ]; then
            local installed_count=$(find node_modules -maxdepth 1 -type d | wc -l)
            echo -e "${GREEN}📊 Installed packages: $((installed_count - 1))${NC}"
        fi
        
        cd - > /dev/null
        return 0
    else
        echo -e "${RED}❌ ${module} dependency installation failed${NC}"
        FAILED_MODULES+=("$module")
        cd - > /dev/null
        return 1
    fi
    
    TOTAL_MODULES=$((TOTAL_MODULES + 1))
}

# Node.js 및 npm 버전 확인
echo -e "${PURPLE}🔍 Environment Check${NC}"
echo "-------------------"
if command -v node >/dev/null 2>&1; then
    echo -e "Node.js: ${GREEN}$(node --version)${NC}"
else
    echo -e "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
    exit 1
fi

if command -v npm >/dev/null 2>&1; then
    echo -e "npm: ${GREEN}$(npm --version)${NC}"
else
    echo -e "${RED}❌ npm not found. Please install npm first.${NC}"
    exit 1
fi

# 루트 워크스페이스 설치
echo -e "\n${PURPLE}🏢 Installing workspace dependencies...${NC}"
echo "======================================="
if npm install; then
    echo -e "${GREEN}✅ Workspace dependencies installed${NC}"
    SUCCESS_MODULES=$((SUCCESS_MODULES + 1))
else
    echo -e "${RED}❌ Workspace dependency installation failed${NC}"
    FAILED_MODULES+=("workspace")
fi
TOTAL_MODULES=$((TOTAL_MODULES + 1))

# 각 패키지별 의존성 설치
install_module "shared" "packages/shared" || true
TOTAL_MODULES=$((TOTAL_MODULES + 1))

install_module "local-mcp" "packages/local-mcp" || true
TOTAL_MODULES=$((TOTAL_MODULES + 1))

install_module "aws-api" "packages/aws-api" || true
TOTAL_MODULES=$((TOTAL_MODULES + 1))

# 선택적: Docker 서비스 설치 상태 확인
echo -e "\n${PURPLE}🐳 Docker Services Check${NC}"
echo "-------------------------"
if command -v docker >/dev/null 2>&1; then
    if [ -f "docker-compose.yml" ]; then
        echo -e "${GREEN}✅ Docker and docker-compose.yml found${NC}"
        echo -e "${YELLOW}💡 To start Docker services: docker-compose up -d${NC}"
        
        # Docker 이미지 상태 확인
        if docker images | grep -E "(chroma|redis|postgres|minio|nginx)" >/dev/null 2>&1; then
            echo -e "${GREEN}📋 Some Docker images already available${NC}"
        else
            echo -e "${YELLOW}📋 Docker images need to be pulled${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  docker-compose.yml not found${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Docker not found (optional)${NC}"
fi

# 빌드 실행 (선택적)
echo -e "\n${PURPLE}🏗️  Build Check${NC}"
echo "---------------"
echo -e "${YELLOW}💡 Would you like to build all packages now? [y/N]${NC}"
read -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🏗️  Building all packages...${NC}"
    if npm run build; then
        echo -e "${GREEN}✅ Build completed successfully${NC}"
    else
        echo -e "${RED}❌ Build failed${NC}"
        FAILED_MODULES+=("build")
    fi
fi

# 결과 요약
echo -e "\n${PURPLE}📊 Installation Summary${NC}"
echo "======================="
echo -e "Total modules: ${TOTAL_MODULES}"
echo -e "Successful: ${GREEN}${SUCCESS_MODULES}${NC}"
echo -e "Failed: ${RED}$((TOTAL_MODULES - SUCCESS_MODULES))${NC}"

if [ ${#FAILED_MODULES[@]} -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All dependencies installed successfully!${NC}"
    echo -e "\n${YELLOW}📋 Next Steps:${NC}"
    echo -e "   1. Check system status: ${BLUE}./sh/status.sh${NC}"
    echo -e "   2. Run tests: ${BLUE}./sh/test-all.sh${NC}"
    echo -e "   3. Start development: ${BLUE}./sh/dev-local-mcp.sh${NC}"
    echo -e "   4. Start Docker services: ${BLUE}docker-compose up -d${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Failed modules:${NC}"
    for module in "${FAILED_MODULES[@]}"; do
        echo -e "  - ${RED}${module}${NC}"
    done
    echo -e "\n${YELLOW}🔧 Troubleshooting:${NC}"
    echo -e "   1. Check Node.js version (requires 18+)"
    echo -e "   2. Clear npm cache: ${BLUE}npm cache clean --force${NC}"
    echo -e "   3. Delete node_modules and try again"
    echo -e "   4. Check network connection"
    echo -e "   5. Run individual installs: ${BLUE}./sh/install-shared.sh${NC}"
    exit 1
fi