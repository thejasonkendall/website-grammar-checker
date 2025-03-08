#!/bin/bash

# Make sure the URL is provided
if [ -z "$1" ]; then
  echo "Usage: ./check-grammar.sh <url> [options]"
  echo "Example: ./check-grammar.sh https://example.com"
  exit 1
fi

# Run the grammar checker
npx ts-node src/index.ts "$@"