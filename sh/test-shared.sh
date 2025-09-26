#!/bin/bash

# shared 패키지 테스트 스크립트
# Test script for shared package

set -e

echo "🧪 Testing shared package..."
echo "============================"

cd "$(dirname "$0")/../packages/shared"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/shared${NC}"
echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🏗️  Building package...${NC}"
npm run build

echo -e "${BLUE}🧪 Running tests...${NC}"
npm test

echo -e "${BLUE}🔍 Running linting...${NC}"
npm run lint

echo -e "${GREEN}✅ shared package tests completed successfully!${NC}"