import { searchLiterature, saveToJSON } from './agents/literatureSearch.js';
import { analyzePopulation, saveAnalysisToJSON } from './agents/populationAnalysis.js';

async function main() {
  try {
    const disease = 'Alzheimer';
    
    // Step 1: Literature Search Agent (B)
    console.log('='.repeat(60));
    console.log('AGENT B: LITERATURE SEARCH');
    console.log('='.repeat(60));
    console.log(`Searching for papers on: ${disease}...`);
    
    const searchResult = await searchLiterature(disease);
    
    const papersFilename = `${disease}_papers.json`;
    await saveToJSON(searchResult, papersFilename);
    
    console.log(`\n✓ Search completed successfully!`);
    console.log(`  Query: ${searchResult.query}`);
    console.log(`  Total results available: ${searchResult.total_results}`);
    console.log(`  Papers retrieved: ${searchResult.papers.length}`);
    console.log(`  Output saved to: ${papersFilename}`);

    // Step 2: Population Analysis Agent (D)
    console.log('\n' + '='.repeat(60));
    console.log('AGENT D: POPULATION ANALYSIS');
    console.log('='.repeat(60));
    
    const analysisResult = await analyzePopulation(searchResult.papers);
    
    const analysisFilename = `${disease}_population_analysis.json`;
    await saveAnalysisToJSON(analysisResult, analysisFilename);
    
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`✓ Analyzed ${analysisResult.total_papers_analyzed} papers`);
    console.log(`✓ Identified ${analysisResult.blind_spots.length} blind spots`);
    console.log(`✓ Analysis saved to: ${analysisFilename}`);
    
    // Display blind spots
    if (analysisResult.blind_spots.length > 0) {
      console.log('\nKey Blind Spots:');
      for (const spot of analysisResult.blind_spots) {
        const emoji = spot.severity === 'critical' ? '🔴' : spot.severity === 'high' ? '🟠' : '🟡';
        console.log(`  ${emoji} [${spot.severity.toUpperCase()}] ${spot.gap}`);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ Pipeline completed successfully!');
    console.log('='.repeat(60) + '\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();