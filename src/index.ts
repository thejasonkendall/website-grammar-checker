import { chromium } from '@playwright/test';
import { GrammarChecker } from './grammarChecker';
import fetch from 'node-fetch';

// Polyfill global fetch for Node.js environment
if (!global.fetch) {
  (global as any).fetch = fetch;
}

interface CheckerOptions {
  url: string;
  language?: string;
  motherTongue?: string;
  disabledRules?: string[];
  outputFormat?: 'console' | 'json' | 'html' | 'markdown';
  outputPath?: string;
  includeRawText?: boolean;
  headless?: boolean;
  detectIncomplete?: boolean;
}

/**
 * Main function to check grammar on a website
 */
async function checkWebsiteGrammar(options: CheckerOptions): Promise<void> {
  const { 
    url, 
    language = 'en-US',
    motherTongue, 
    disabledRules = [],
    outputFormat = 'console',
    outputPath,
    includeRawText = false,
    headless = true,
    detectIncomplete = true
  } = options;
  
  console.log(`Starting grammar check for: ${url}`);
  console.log('Launching browser...');
  
  const browser = await chromium.launch({ headless });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    console.log('Navigating to website...');
    await page.goto(url, { waitUntil: 'networkidle' });
    console.log('Page loaded. Extracting text...');
    
    const grammarChecker = new GrammarChecker({
      language,
      motherTongue,
      disabledRules,
      detectIncomplete
    });
    
    const result = await grammarChecker.checkPage(page);
    console.log(`Extracted ${result.rawText.length} characters. Found ${result.totalErrors} issues.`);
    
    // Output the results according to the specified format
    outputResults(result, outputFormat, outputPath, includeRawText);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

/**
 * Output results in the specified format
 */
function outputResults(result: any, format: string, outputPath?: string, includeRawText = false): void {
  switch (format) {
    case 'json':
      outputJsonResults(result, outputPath, includeRawText);
      break;
    case 'html':
      outputHtmlResults(result, outputPath, includeRawText);
      break;
    case 'markdown':
      outputMarkdownResults(result, outputPath, includeRawText);
      break;
    case 'console':
    default:
      outputConsoleResults(result, includeRawText);
  }
}

/**
 * Output results to console
 */
function outputConsoleResults(result: any, includeRawText = false): void {
  console.log(`\n=== Grammar Check Results for ${result.url} ===`);
  console.log(`Found ${result.totalErrors} issues\n`);
  
  result.errors.forEach((error: any, index: number) => {
    console.log(`Issue #${index + 1}: ${error.message}`);
    console.log(`Context: "${error.context}"`);
    console.log(`Suggestions: ${error.suggestions.join(', ')}`);
    console.log(`Rule ID: ${error.ruleId}`);
    console.log('---');
  });
  
  if (includeRawText) {
    console.log('\nExtracted Text:');
    console.log(result.rawText);
  }
  
  console.log('\nCheck complete!');
}

/**
 * Output results to JSON file
 */
function outputJsonResults(result: any, outputPath?: string, includeRawText = false): void {
  if (!outputPath) {
    console.error('Error: Output path is required for JSON format');
    return;
  }
  
  const fs = require('fs');
  const path = require('path');
  
  const outputData = includeRawText ? result : { ...result, rawText: undefined };
  
  try {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    console.log(`JSON report saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving JSON report:', error);
  }
}

/**
 * Output results to HTML file
 */
function outputHtmlResults(result: any, outputPath?: string, includeRawText = false): void {
  if (!outputPath) {
    console.error('Error: Output path is required for HTML format');
    return;
  }
  
  const fs = require('fs');
  const path = require('path');
  
  const html = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Grammar Check Results for ${result.url}</title>
    <style>
      body { font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 20px; color: #333; }
      h1 { color: #2c3e50; }
      .summary { background: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
      .error { background: #fff; border-left: 4px solid #e74c3c; padding: 15px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      .suggestions { color: #27ae60; }
      .context { background: #f1f1f1; padding: 10px; border-radius: 3px; font-family: monospace; white-space: pre-wrap; }
      .rule { color: #7f8c8d; font-size: 0.9em; }
      .raw-text { background: #f9f9f9; padding: 15px; border-radius: 5px; white-space: pre-wrap; font-family: monospace; font-size: 0.9em; }
    </style>
  </head>
  <body>
    <h1>Grammar Check Results</h1>
    <div class="summary">
      <p><strong>URL:</strong> ${result.url}</p>
      <p><strong>Total Issues:</strong> ${result.totalErrors}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <h2>Issues Found:</h2>
    ${result.errors.map((error: any, index: number) => `
      <div class="error">
        <h3>Issue #${index + 1}: ${error.message}</h3>
        <div class="context">${error.context}</div>
        <p class="suggestions"><strong>Suggestions:</strong> ${error.suggestions.join(', ')}</p>
        <p class="rule"><strong>Rule ID:</strong> ${error.ruleId}</p>
      </div>
    `).join('')}
    
    ${includeRawText ? `
      <h2>Raw Text Content:</h2>
      <div class="raw-text">${result.rawText}</div>
    ` : ''}
  </body>
  </html>
  `;
  
  try {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html);
    console.log(`HTML report saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving HTML report:', error);
  }
}

/**
 * Output results to Markdown file
 */
function outputMarkdownResults(result: any, outputPath?: string, includeRawText = false): void {
  if (!outputPath) {
    console.error('Error: Output path is required for Markdown format');
    return;
  }
  
  const fs = require('fs');
  const path = require('path');
  
  const markdown = `
# Grammar Check Results for ${result.url}

**Total Issues:** ${result.totalErrors}  
**Date:** ${new Date().toLocaleString()}

## Issues Found:

${result.errors.map((error: any, index: number) => `
### Issue #${index + 1}: ${error.message}

**Context:** \`${error.context}\`  
**Suggestions:** ${error.suggestions.join(', ')}  
**Rule ID:** ${error.ruleId}
`).join('\n')}

${includeRawText ? `
## Raw Text Content:

\`\`\`
${result.rawText}
\`\`\`
` : ''}
  `;
  
  try {
    // Ensure directory exists
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, markdown);
    console.log(`Markdown report saved to ${outputPath}`);
  } catch (error) {
    console.error('Error saving Markdown report:', error);
  }
}

// If this file is run directly
if (require.main === module) {
  // Process command line arguments
  const args = process.argv.slice(2);
  const url = args[0];
  
  if (!url) {
    console.log('Usage: npx ts-node src/index.ts <url> [options]');
    process.exit(1);
  }
  
  // Parse additional options (simplified version)
  const options: CheckerOptions = { url };
  
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
    }
  }
  
  checkWebsiteGrammar(options)
    .catch(err => {
      console.error('Fatal error:', err);
      process.exit(1);
    });
}

export { checkWebsiteGrammar };