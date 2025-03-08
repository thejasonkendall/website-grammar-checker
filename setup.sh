#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Setting up Website Grammar Checker...${NC}"

# Install dependencies
echo -e "${BLUE}Installing npm dependencies...${NC}"
npm install

# Install Playwright browsers
echo -e "${BLUE}Installing Playwright browsers...${NC}"
npx playwright install

# Create reports directory
echo -e "${BLUE}Creating reports directory...${NC}"
mkdir -p reports

# Make the check script executable
echo -e "${BLUE}Making check-grammar.sh executable...${NC}"
chmod +x check-grammar.sh

echo -e "${GREEN}Setup complete! You can now run the tool with:${NC}"
echo -e "${YELLOW}./check-grammar.sh https://example.com${NC}"