import { CheckResult } from './grammarChecker';
import * as fs from 'fs';
import * as path from 'path';

export interface ReportOptions {
  outputFormat?: 'console' | 'json' | 'html' | 'markdown';
  outputPath?: string;
  includeRawText?: boolean;
}

export class Reporter {
  constructor(private options: ReportOptions = {}) {
    this.options.outputFormat = this.options.outputFormat || 'console';
    this.options.includeRawText = this.options.includeRawText || false;
  }
  
  /**
   * Generate a report for the grammar check results
   */
  async generateReport(result: CheckResult): Promise<void> {
    switch (this.options.outputFormat) {
      case 'json':
        await this.generateJsonReport(result);
        break;
      case 'html':
        await this.generateHtmlReport(result);
        break;
      case 'markdown':
        await this.generateMarkdownReport(result);
        break;
      case 'console':
      default:
        this.generateConsoleReport(result);
    }
  }
  
  /**
   * Print results to console
   */
  generateConsoleReport(result: CheckResult): void {
    console.log(`\n=== Grammar Check Results for ${result.url} ===`);
    console.log(`Found ${result.totalErrors} issues\n`);
    
    result.errors.forEach((error, index) => {
      console.log(`Issue #${index + 1}: ${error.message}`);
      console.log(`Context: "${error.context}"`);
      console.log(`Suggestions: ${error.suggestions.join(', ')}`);
      console.log(`Rule ID: ${error.ruleId}`);
      console.log('---');
    });
    
    console.log('\nCheck complete!');
  }
  
  /**
   * Generate JSON report file
   */
  async generateJsonReport(result: CheckResult): Promise<void> {
    if (!this.options.outputPath) {
      throw new Error('Output path is required for JSON reports');
    }
    
    const outputData = this.options.includeRawText ? result : { 
      url: result.url,
      totalErrors: result.totalErrors,
      errors: result.errors
    };
    
    // Make sure the directory exists
    const dirName = path.dirname(this.options.outputPath);
    await fs.promises.mkdir(dirName, { recursive: true }).catch(err => {
      // Directory might already exist, which is fine
      if (err.code !== 'EEXIST') throw err;
    });
    
    await fs.promises.writeFile(
      this.options.outputPath,
      JSON.stringify(outputData, null, 2),
      'utf8'
    );
    
    console.log(`JSON report saved to ${this.options.outputPath}`);
  }
  
  /**
   * Generate HTML report file
   */
  async generateHtmlReport(result: CheckResult): Promise<void> {
    if (!this.options.outputPath) {
      throw new Error('Output path is required for HTML reports');
    }
    
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
      ${result.errors.map((error, index) => `
        <div class="error">
          <h3>Issue #${index + 1}: ${error.message}</h3>
          <div class="context">${error.context}</div>
          <p class="suggestions"><strong>Suggestions:</strong> ${error.suggestions.join(', ')}</p>
          <p class="rule"><strong>Rule ID:</strong> ${error.ruleId}</p>
        </div>
      `).join('')}
      
      ${this.options.includeRawText ? `
        <h2>Raw Text Content:</h2>
        <pre>${result.rawText}</pre>
      ` : ''}
    </body>
    </html>
    `;
    
    await fs.promises.mkdir(path.dirname(this.options.outputPath), { recursive: true });
    await fs.promises.writeFile(this.options.outputPath, html, 'utf8');
    
    console.log(`HTML report saved to ${this.options.outputPath}`);
  }
  
  /**
   * Generate Markdown report file
   */
  async generateMarkdownReport(result: CheckResult): Promise<void> {
    if (!this.options.outputPath) {
      throw new Error('Output path is required for Markdown reports');
    }
    
    const markdown = `
# Grammar Check Results for ${result.url}

**Total Issues:** ${result.totalErrors}  
**Date:** ${new Date().toLocaleString()}

## Issues Found:

${result.errors.map((error, index) => `
### Issue #${index + 1}: ${error.message}

**Context:** \`${error.context}\`  
**Suggestions:** ${error.suggestions.join(', ')}  
**Rule ID:** ${error.ruleId}
`).join('\n')}

${this.options.includeRawText ? `
## Raw Text Content:

\`\`\`
${result.rawText}
\`\`\`
` : ''}
    `;
    
    await fs.promises.mkdir(path.dirname(this.options.outputPath), { recursive: true });
    await fs.promises.writeFile(this.options.outputPath, markdown, 'utf8');
    
    console.log(`Markdown report saved to ${this.options.outputPath}`);
  }
}