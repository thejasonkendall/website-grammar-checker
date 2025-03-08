#!/usr/bin/env node
import { checkWebsiteGrammar } from './index';

interface CliArgs {
  url: string;
  language?: string;
  outputFormat?: 'console' | 'json' | 'html' | 'markdown';
  outputPath?: string;
  includeRawText?: boolean;
  headless?: boolean;
  detectIncomplete?: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const options: CliArgs = {
    url: '',
  };
  
  // First argument is always the URL
  options.url = args[0];
  
  // Process other arguments
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--language' || arg === '-l') {
      options.language = args[++i];
    } else if (arg === '--output-format' || arg === '-f') {
      options.outputFormat = args[++i] as any;
    } else if (arg === '--output-path' || arg === '-o') {
      options.outputPath = args[++i];
    } else if (arg === '--include-raw-text' || arg === '-r') {
      options.includeRawText = true;
    } else if (arg === '--no-headless') {
      options.headless = false;
    } else if (arg === '--no-incomplete') {
      options.detectIncomplete = false;
    } else if (arg === '--help' || arg === '-h') {
      showHelp();
      process.exit(0);
    }
  }
  
  return options;
}

function showHelp(): void {
  console.log(`
  Website Grammar Checker

  Usage: 
    npx ts-node src/cli.ts <url> [options]

  Options:
    --language, -l           Language code (default: en-US)
    --output-format, -f      Output format: console, json, html, markdown (default: console)
    --output-path, -o        Path to save the report (required for non-console outputs)
    --include-raw-text, -r   Include raw extracted text in the report
    --no-headless            Run browser in non-headless mode
    --no-incomplete          Disable detection of incomplete sentences
    --help, -h               Show this help message
  
  Examples:
    npx ts-node src/cli.ts https://example.com
    npx ts-node src/cli.ts https://example.com -f html -o ./reports/report.html
    npx ts-node src/cli.ts https://example.com -l de-DE --no-headless
  `);
}

async function main(): Promise<void> {
  const options = parseArgs();
  
  if (!options.url) {
    console.error('Error: URL is required');
    showHelp();
    process.exit(1);
  }
  
  if (options.outputFormat && options.outputFormat !== 'console' && !options.outputPath) {
    console.error(`Error: --output-path is required for ${options.outputFormat} output format`);
    process.exit(1);
  }
  
  try {
    await checkWebsiteGrammar(options);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}