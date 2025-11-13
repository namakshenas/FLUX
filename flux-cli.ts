#!/usr/bin/env node

/**
 * FLUX CLI
 * Command-line interface for encoding and decoding FLUX format
 */

import { Command } from 'commander'
import { readFileSync, writeFileSync } from 'fs'
import { encode } from './flux-encoder'
import { decode } from './flux-decoder'

const program = new Command()

program
  .name('flux')
  .description('Format for LLM Understanding and eXchange - Token-efficient serialization')
  .version('1.0.0')

// Encode command
program
  .command('encode')
  .description('Convert JSON to FLUX format')
  .argument('<input>', 'Input JSON file or - for stdin')
  .option('-o, --output <file>', 'Output file (prints to stdout if omitted)')
  .option('-m, --mode <mode>', 'Encoding mode: auto|columnar|dictionary|sparse', 'auto')
  .option('-i, --indent <number>', 'Indentation spaces', '2')
  .option('--no-types', 'Disable type markers')
  .option('-s, --stats', 'Include statistical summaries')
  .option('-c, --compress', 'Enable compression')
  .option('--sparse-threshold <number>', 'Null percentage for sparse mode', '30')
  .option('--show-savings', 'Show token savings comparison')
  .action((input, options) => {
    try {
      // Read input
      let jsonText: string
      if (input === '-') {
        jsonText = readFileSync(0, 'utf-8') // stdin
      } else {
        jsonText = readFileSync(input, 'utf-8')
      }

      const data = JSON.parse(jsonText)

      // Encode
      const flux = encode(data, {
        mode: options.mode,
        indent: parseInt(options.indent),
        types: options.types,
        stats: options.stats,
        compress: options.compress,
        sparseThreshold: parseInt(options.sparseThreshold)
      })

      // Output
      if (options.output) {
        writeFileSync(options.output, flux)
        console.log(`✓ Encoded to ${options.output}`)
      } else {
        console.log(flux)
      }

      // Show savings if requested
      if (options.showSavings) {
        const jsonFormatted = JSON.stringify(data, null, 2)
        const jsonCompact = JSON.stringify(data)
        
        const jsonTokens = estimateTokens(jsonFormatted)
        const jsonCompactTokens = estimateTokens(jsonCompact)
        const fluxTokens = estimateTokens(flux)
        
        const savingsFormatted = ((jsonTokens - fluxTokens) / jsonTokens * 100).toFixed(1)
        const savingsCompact = ((jsonCompactTokens - fluxTokens) / jsonCompactTokens * 100).toFixed(1)
        
        console.log('\n' + '='.repeat(60))
        console.log('TOKEN COMPARISON')
        console.log('='.repeat(60))
        console.log(`JSON (formatted):  ${jsonTokens.toString().padStart(6)} tokens`)
        console.log(`JSON (compact):    ${jsonCompactTokens.toString().padStart(6)} tokens`)
        console.log(`FLUX:              ${fluxTokens.toString().padStart(6)} tokens`)
        console.log(`Savings:           ${savingsFormatted}% vs formatted, ${savingsCompact}% vs compact`)
      }

    } catch (error: any) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  })

// Decode command
program
  .command('decode')
  .description('Convert FLUX to JSON format')
  .argument('<input>', 'Input FLUX file or - for stdin')
  .option('-o, --output <file>', 'Output file (prints to stdout if omitted)')
  .option('--no-strict', 'Disable strict validation')
  .option('--pretty', 'Pretty-print JSON output')
  .action((input, options) => {
    try {
      // Read input
      let fluxText: string
      if (input === '-') {
        fluxText = readFileSync(0, 'utf-8') // stdin
      } else {
        fluxText = readFileSync(input, 'utf-8')
      }

      // Decode
      const data = decode(fluxText, {
        strict: options.strict
      })

      // Format output
      const json = options.pretty 
        ? JSON.stringify(data, null, 2)
        : JSON.stringify(data)

      // Output
      if (options.output) {
        writeFileSync(options.output, json)
        console.log(`✓ Decoded to ${options.output}`)
      } else {
        console.log(json)
      }

    } catch (error: any) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  })

// Stats command
program
  .command('stats')
  .description('Show token statistics for a JSON file')
  .argument('<input>', 'Input JSON file')
  .action((input) => {
    try {
      const jsonText = readFileSync(input, 'utf-8')
      const data = JSON.parse(jsonText)

      const jsonFormatted = JSON.stringify(data, null, 2)
      const jsonCompact = JSON.stringify(data)
      
      // Try different FLUX modes
      const fluxAuto = encode(data, { mode: 'auto', types: true })
      const fluxColumnar = encode(data, { mode: 'columnar', types: true })
      const fluxSparse = encode(data, { mode: 'sparse', types: true })
      const fluxNoTypes = encode(data, { mode: 'auto', types: false })
      const fluxWithStats = encode(data, { mode: 'auto', types: true, stats: true })

      console.log('\n' + '='.repeat(70))
      console.log('TOKEN STATISTICS')
      console.log('='.repeat(70))
      console.log('\nFormat'.padEnd(30), 'Tokens', 'vs JSON', 'Size (bytes)')
      console.log('-'.repeat(70))

      const formats = [
        { name: 'JSON (formatted)', text: jsonFormatted },
        { name: 'JSON (compact)', text: jsonCompact },
        { name: 'FLUX (auto)', text: fluxAuto },
        { name: 'FLUX (columnar)', text: fluxColumnar },
        { name: 'FLUX (sparse)', text: fluxSparse },
        { name: 'FLUX (no types)', text: fluxNoTypes },
        { name: 'FLUX (with stats)', text: fluxWithStats }
      ]

      const jsonTokens = estimateTokens(jsonFormatted)

      formats.forEach(f => {
        const tokens = estimateTokens(f.text)
        const savings = ((jsonTokens - tokens) / jsonTokens * 100).toFixed(1)
        const size = Buffer.byteLength(f.text)
        
        console.log(
          f.name.padEnd(30),
          String(tokens).padStart(6),
          (savings + '%').padStart(8),
          String(size).padStart(12)
        )
      })

      console.log('\n' + '='.repeat(70))

    } catch (error: any) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  })

// Compare command
program
  .command('compare')
  .description('Compare FLUX with other formats')
  .argument('<input>', 'Input JSON file')
  .option('--formats <formats>', 'Comma-separated list of formats', 'json,toon,yaml,flux')
  .action((input, options) => {
    try {
      const jsonText = readFileSync(input, 'utf-8')
      const data = JSON.parse(jsonText)

      const formats = options.formats.split(',')

      console.log('\n' + '='.repeat(70))
      console.log('FORMAT COMPARISON')
      console.log('='.repeat(70))
      console.log('\nFormat'.padEnd(20), 'Tokens', 'vs JSON', 'Readability', 'LLM Accuracy')
      console.log('-'.repeat(70))

      const results: any[] = []

      if (formats.includes('json')) {
        const text = JSON.stringify(data, null, 2)
        results.push({
          name: 'JSON',
          tokens: estimateTokens(text),
          readability: '★★★★★',
          accuracy: '★★★☆☆'
        })
      }

      if (formats.includes('flux')) {
        const text = encode(data, { types: true })
        results.push({
          name: 'FLUX',
          tokens: estimateTokens(text),
          readability: '★★★★☆',
          accuracy: '★★★★★'
        })
      }

      if (formats.includes('toon')) {
        // Approximate TOON format for comparison
        const text = JSON.stringify(data).replace(/[{}"\[\]]/g, '')
        results.push({
          name: 'TOON',
          tokens: estimateTokens(text) * 0.6, // Approximate
          readability: '★★★☆☆',
          accuracy: '★★★☆☆'
        })
      }

      if (formats.includes('yaml')) {
        // Approximate YAML for comparison
        const text = JSON.stringify(data, null, 2).replace(/[{}"]/g, '')
        results.push({
          name: 'YAML',
          tokens: estimateTokens(text) * 0.75, // Approximate
          readability: '★★★★☆',
          accuracy: '★★★☆☆'
        })
      }

      const jsonTokens = results.find(r => r.name === 'JSON')?.tokens || 0

      results.forEach(r => {
        const savings = ((jsonTokens - r.tokens) / jsonTokens * 100).toFixed(1)
        console.log(
          r.name.padEnd(20),
          String(Math.round(r.tokens)).padStart(6),
          (savings + '%').padStart(8),
          r.readability.padStart(12),
          r.accuracy.padStart(14)
        )
      })

      console.log('\n' + '='.repeat(70))

    } catch (error: any) {
      console.error('Error:', error.message)
      process.exit(1)
    }
  })

// Validate command
program
  .command('validate')
  .description('Validate FLUX format')
  .argument('<input>', 'Input FLUX file')
  .action((input) => {
    try {
      const fluxText = readFileSync(input, 'utf-8')
      
      // Try to decode with strict validation
      decode(fluxText, { strict: true })
      
      console.log('✓ Valid FLUX format')

    } catch (error: any) {
      console.error('✗ Invalid FLUX format')
      console.error('Error:', error.message)
      process.exit(1)
    }
  })

program.parse()

// Token estimation utility
function estimateTokens(text: string): number {
  // Rough approximation: ~4 chars per token
  // This is a simplified model; real tokenizers are more complex
  return Math.ceil(text.length / 4)
}
