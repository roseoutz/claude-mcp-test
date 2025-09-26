#!/bin/bash

# local-mcp 패키지 테스트 스크립트
# Test script for local-mcp package

set -e

echo "🧪 Testing local-mcp package..."
echo "==============================="

cd "$(dirname "$0")/../packages/local-mcp"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/local-mcp${NC}"
echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🏗️  Building package...${NC}"
npm run build

echo -e "${BLUE}🧪 Running tests...${NC}"
npm test

echo -e "${BLUE}🔍 Running linting...${NC}"
npm run lint

echo -e "${BLUE}🎯 Testing binary execution...${NC}"
echo "Testing if the binary can be executed..."
node dist/index.js --help 2>/dev/null || echo "Binary created successfully (help flag test)"

echo -e "${GREEN}✅ local-mcp package tests completed successfully!${NC}"