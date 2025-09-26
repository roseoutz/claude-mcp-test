#!/bin/bash

# aws-api 패키지 테스트 스크립트
# Test script for aws-api package

set -e

echo "🧪 Testing aws-api package..."
echo "============================="

cd "$(dirname "$0")/../packages/aws-api"

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${YELLOW}📦 Package: @code-ai/aws-api${NC}"
echo -e "${BLUE}🔧 Installing dependencies...${NC}"
npm install

echo -e "${BLUE}🏗️  Building package...${NC}"
npm run build

echo -e "${BLUE}🧪 Running tests...${NC}"
npm test

echo -e "${BLUE}🔍 Running linting...${NC}"
npm run lint

echo -e "${GREEN}✅ aws-api package tests completed successfully!${NC}"