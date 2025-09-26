#!/bin/bash

# 전체 시스템 상태 확인 스크립트
# System status check script

echo "📊 Code AI MCP System Status"
echo "============================"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# PID 파일 경로
LOCAL_MCP_PID="/tmp/local-mcp.pid"
AWS_API_PID="/tmp/aws-api.pid"

check_service() {
    local service_name=$1
    local pid_file=$2
    local port=$3
    
    echo -e "\n${BLUE}🔍 $service_name${NC}"
    echo "-------------------"
    
    if [ -f "$pid_file" ]; then
        pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "Status: ${GREEN}✅ RUNNING${NC} (PID: $pid)"
            
            # 포트가 제공된 경우 연결 테스트
            if [ ! -z "$port" ]; then
                if nc -z localhost $port 2>/dev/null; then
                    echo -e "Port $port: ${GREEN}✅ LISTENING${NC}"
                else
                    echo -e "Port $port: ${RED}❌ NOT ACCESSIBLE${NC}"
                fi
            fi
        else
            echo -e "Status: ${RED}❌ STOPPED${NC} (Stale PID file)"
            echo -e "Action: ${YELLOW}Run cleanup: rm $pid_file${NC}"
        fi
    else
        echo -e "Status: ${YELLOW}⭕ STOPPED${NC}"
    fi
}

# 환경 변수 확인
echo -e "${BLUE}🌍 Environment Variables${NC}"
echo "------------------------"
[ ! -z "$OPENAI_API_KEY" ] && echo -e "OPENAI_API_KEY: ${GREEN}✅ SET${NC}" || echo -e "OPENAI_API_KEY: ${YELLOW}⚠️  NOT SET${NC}"
[ ! -z "$GITHUB_TOKEN" ] && echo -e "GITHUB_TOKEN: ${GREEN}✅ SET${NC}" || echo -e "GITHUB_TOKEN: ${YELLOW}⚠️  NOT SET${NC}"
[ ! -z "$AWS_REGION" ] && echo -e "AWS_REGION: ${GREEN}✅ SET${NC}" || echo -e "AWS_REGION: ${YELLOW}⚠️  NOT SET${NC}"
[ ! -z "$S3_BUCKET" ] && echo -e "S3_BUCKET: ${GREEN}✅ SET${NC}" || echo -e "S3_BUCKET: ${YELLOW}⚠️  NOT SET${NC}"
[ ! -z "$DYNAMODB_TABLE" ] && echo -e "DYNAMODB_TABLE: ${GREEN}✅ SET${NC}" || echo -e "DYNAMODB_TABLE: ${YELLOW}⚠️  NOT SET${NC}"

# 서비스 상태 확인
check_service "Local MCP Server" "$LOCAL_MCP_PID" ""
check_service "AWS API Server" "$AWS_API_PID" "${PORT:-3000}"

# Docker 서비스 확인 (선택적)
echo -e "\n${BLUE}🐳 Docker Services${NC}"
echo "------------------"
if command -v docker >/dev/null 2>&1; then
    if docker ps >/dev/null 2>&1; then
        docker_services=$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(chroma|redis|postgres|minio|nginx)" | wc -l)
        if [ $docker_services -gt 0 ]; then
            echo -e "Docker Services: ${GREEN}✅ $docker_services services running${NC}"
            docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(chroma|redis|postgres|minio|nginx)"
        else
            echo -e "Docker Services: ${YELLOW}⭕ No related services running${NC}"
        fi
    else
        echo -e "Docker: ${RED}❌ NOT ACCESSIBLE${NC}"
    fi
else
    echo -e "Docker: ${YELLOW}⭕ NOT INSTALLED${NC}"
fi

# 로그 파일 확인
echo -e "\n${BLUE}📁 Recent Logs${NC}"
echo "--------------"
if [ -d "/tmp" ]; then
    local_mcp_logs=$(ls -la /tmp/*local-mcp*.log 2>/dev/null | wc -l)
    aws_api_logs=$(ls -la /tmp/*aws-api*.log 2>/dev/null | wc -l)
    
    [ $local_mcp_logs -gt 0 ] && echo -e "Local MCP logs: ${GREEN}$local_mcp_logs files${NC}" || echo -e "Local MCP logs: ${YELLOW}No log files${NC}"
    [ $aws_api_logs -gt 0 ] && echo -e "AWS API logs: ${GREEN}$aws_api_logs files${NC}" || echo -e "AWS API logs: ${YELLOW}No log files${NC}"
fi

# 요약
echo -e "\n${BLUE}📋 Quick Actions${NC}"
echo "----------------"
echo -e "${YELLOW}Start services:${NC}"
echo "  ./sh/start-local-mcp.sh"
echo "  ./sh/start-aws-api.sh"
echo ""
echo -e "${YELLOW}Development mode:${NC}"
echo "  ./sh/dev-local-mcp.sh"
echo "  ./sh/dev-aws-api.sh"
echo ""
echo -e "${YELLOW}Stop services:${NC}"
echo "  ./sh/stop-local-mcp.sh"
echo "  ./sh/stop-aws-api.sh"
echo ""
echo -e "${YELLOW}Run tests:${NC}"
echo "  ./sh/test-all.sh"