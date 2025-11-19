/**
 * Main LangGraph graph definition
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphState } from "./state.js";
import { inputAgent } from "../agents/inputAgent.js";
import { literatureSearchAgent } from "../agents/literatureSearchAgent.js";
import { qualityAssessmentAgent } from "../agents/qualityAssessmentAgent.js";
import { populationAnalysisAgent } from "../agents/populationAnalysisAgent.js";
import { llmPopulationAnalysisAgent } from "../agents/llmPopulationAnalysisAgent.js";
import { synthesisAgent } from "../agents/synthesisAgent.js";

// Configuration: Use LLM for population analysis if enabled
const USE_LLM_POPULATION_ANALYSIS =
  process.env.USE_LLM_POPULATION_ANALYSIS === "true";

/**
 * Build and compile the graph
 */
function buildGraph() {
  // Choose population analysis agent based on configuration
  const populationAnalysisNode = USE_LLM_POPULATION_ANALYSIS
    ? llmPopulationAnalysisAgent
    : populationAnalysisAgent;

  const analysisNodeName = USE_LLM_POPULATION_ANALYSIS
    ? "llm_population_analysis"
    : "population_analysis";

  console.log(
    `[Graph] Using ${USE_LLM_POPULATION_ANALYSIS ? "LLM-powered" : "heuristic"} population analysis`
  );

  const workflow = new StateGraph(GraphState)
    // Add agent nodes
    .addNode("input_agent", inputAgent)
    .addNode("literature_search", literatureSearchAgent)
    .addNode("quality_assessment", qualityAssessmentAgent)
    .addNode(analysisNodeName, populationAnalysisNode)
    .addNode("synthesis", synthesisAgent)
    // Wire: START -> input_agent -> literature_search -> quality_assessment -> population_analysis -> synthesis -> END
    .addEdge(START, "input_agent")
    .addEdge("input_agent", "literature_search")
    .addEdge("literature_search", "quality_assessment")
    .addEdge("quality_assessment", analysisNodeName)
    .addEdge(analysisNodeName, "synthesis")
    .addEdge("synthesis", END);

  return workflow.compile();
}

// Export the compiled graph
export const graph = buildGraph();
