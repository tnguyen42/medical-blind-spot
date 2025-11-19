import { searchLiterature, saveToCSV } from './agents/literatureSearch';

async function main() {
  try {
    const disease = 'Alzheimer';
    const papers = await searchLiterature(disease);
    await saveToCSV(papers, `${disease}_papers.csv`);
    console.log(`Found ${papers.length} papers. Saved to ${disease}_papers.csv`);
  } catch (error) {
    console.error('Error:', error);
  }
}

main();