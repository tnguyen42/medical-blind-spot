import { searchLiterature, saveToJSON } from './agents/literatureSearch.js';

async function main() {
  try {
    const disease = 'Alzheimer';
    console.log(`Searching for papers on: ${disease}...`);
    
    const result = await searchLiterature(disease);
    
    const filename = `${disease}_papers.json`;
    await saveToJSON(result, filename);
    
    console.log(`\n✓ Search completed successfully!`);
    console.log(`  Query: ${result.query}`);
    console.log(`  Total results available: ${result.total_results}`);
    console.log(`  Papers retrieved: ${result.papers.length}`);
    console.log(`  Output saved to: ${filename}\n`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();