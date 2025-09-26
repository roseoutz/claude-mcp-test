#!/bin/bash

# 전체 프로젝트 테스트 실행 스크립트
# All modules test execution script

set -e

echo "🧪 Starting comprehensive test suite..."
echo "========================================="

# 프로젝트 루트로 이동
cd "$(dirname "$0")/.."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 테스트 결과 추적
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_MODULES=()

# 헬퍼 함수
run_test() {
    local module=$1
    local test_command=$2
    
    echo -e "\n${BLUE}📦 Testing module: ${module}${NC}"
    echo "-----------------------------------"
    
    if cd "packages/${module}" && eval "$test_command"; then
        echo -e "${GREEN}✅ ${module} tests PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        cd - > /dev/null
        return 0
    else
        echo -e "${RED}❌ ${module} tests FAILED${NC}"
        FAILED_MODULES+=("$module")
        cd - > /dev/null
        return 1
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
}

echo -e "${YELLOW}🔧 Installing dependencies...${NC}"
npm install

echo -e "\n${YELLOW}🏗️  Building projects...${NC}"
npm run build

echo -e "\n${BLUE}🧪 Running individual module tests...${NC}"

# shared 패키지 테스트
run_test "shared" "npm test" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# local-mcp 패키지 테스트  
run_test "local-mcp" "npm test" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# aws-api 패키지 테스트
run_test "aws-api" "npm test" || true
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 전체 워크스페이스 테스트
echo -e "\n${BLUE}🏢 Running workspace-wide tests...${NC}"
echo "-----------------------------------"
if npm test; then
    echo -e "${GREEN}✅ Workspace tests PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ Workspace tests FAILED${NC}"
    FAILED_MODULES+=("workspace")
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# 결과 요약
echo -e "\n${YELLOW}📊 Test Results Summary${NC}"
echo "========================================="
echo -e "Total test suites: ${TOTAL_TESTS}"
echo -e "Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ ${#FAILED_MODULES[@]} -eq 0 ]; then
    echo -e "\n${GREEN}🎉 All tests passed successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}💥 Failed modules:${NC}"
    for module in "${FAILED_MODULES[@]}"; do
        echo -e "  - ${RED}${module}${NC}"
    done
    echo -e "\n${YELLOW}💡 Run individual module tests for more details:${NC}"
    echo "   ./sh/test-shared.sh"
    echo "   ./sh/test-local-mcp.sh" 
    echo "   ./sh/test-aws-api.sh"
    exit 1
fi