import { searchLiterature, saveToJSON } from './agents/literatureSearch.js';
import { analyzePopulation, saveAnalysisToJSON } from './agents/populationAnalysis.js';
import { generateSynthesisReport, saveSynthesisReport } from './agents/synthesisReporting.js';

async function main() {
  try {
    const disease = 'Crohn\'s disease';
    
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
    console.log('INTERMEDIATE RESULTS');
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

    // Step 3: Synthesis & Reporting Agent (E)
    console.log('\n' + '='.repeat(60));
    console.log('AGENT E: SYNTHESIS & REPORTING');
    console.log('='.repeat(60));
    
    const synthesisReport = await generateSynthesisReport(
      disease,
      searchResult,
      analysisResult
    );
    
    const reportFilename = `${disease}_final_report`;
    await saveSynthesisReport(synthesisReport, reportFilename);
    
    console.log('='.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`✓ Executive summary generated`);
    console.log(`✓ ${synthesisReport.recommendations.length} recommendations created`);
    console.log(`✓ Interactive HTML report: ${reportFilename}.html`);
    console.log(`✓ JSON report: ${reportFilename}.json`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✓ COMPLETE PIPELINE FINISHED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log(`\n📄 Open ${reportFilename}.html in your browser to view the full report.\n`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();