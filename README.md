# Website Grammar Checker

A tool to check websites for grammar, spelling, and incomplete sentences using Playwright and NLP libraries.

## Features

- Extracts content from web pages using Mozilla's Readability
- Checks for grammar and spelling issues using retext
- Detects incomplete sentences using compromise NLP
- Generates reports in various formats (console, JSON, HTML, markdown)
- Built with minimal custom code by leveraging existing libraries

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

Clone this repository and run the setup script:

```bash
cd website-grammar-checker
./setup.sh
```

Or install dependencies manually:

```bash
npm install
npx playwright install
mkdir -p reports
chmod +x check-grammar.sh
```

## Usage

### Basic Usage

Check a website for grammar and spelling issues:

```bash
./check-grammar.sh https://example.com
```

Or with specific options:

```bash
# Output as HTML
./check-grammar.sh https://example.com --output-format=html --output-path=reports/report.html

# Check in a different language
./check-grammar.sh https://example.com --language=de-DE
```

### CLI Options

```
Options:
  --language, -l           Language code (default: en-US)
  --output-format, -f      Output format: console, json, html, markdown (default: console)
  --output-path, -o        Path to save the report (required for non-console outputs)
  --include-raw-text, -r   Include raw extracted text in the report
  --no-headless            Run browser in non-headless mode
  --no-incomplete          Disable detection of incomplete sentences
  --help, -h               Show this help message
```

### API Usage

You can also use the library programmatically in your TypeScript/JavaScript projects:

```typescript
import { checkWebsiteGrammar } from './dist';

async function main() {
  await checkWebsiteGrammar({
    url: 'https://example.com',
    language: 'en-US',
    outputFormat: 'html',
    outputPath: './reports/grammar-report.html'
  });
}

main();
```

## Libraries Used

This tool leverages several established libraries to minimize custom code:

- **Playwright**: For web browsing and page interaction
- **Mozilla Readability**: For extracting main content from web pages
- **Cheerio**: For HTML parsing and manipulation
- **Compromise**: For NLP analysis and incomplete sentence detection
- **Retext**: For grammar and style checking
- **JSDOM**: For DOM implementation in Node.js

## License

ISC