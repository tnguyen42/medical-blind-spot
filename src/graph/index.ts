/**
 * Main LangGraph graph definition
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { GraphState } from "./state.js";
import { inputAgent } from "../agents/inputAgent.js";
import { literatureSearchAgent } from "../agents/literatureSearchAgent.js";
import { qualityAssessmentAgent } from "../agents/qualityAssessmentAgent.js";
import { populationAnalysisAgent } from "../agents/populationAnalysisAgent.js";
import { synthesisAgent } from "../agents/synthesisAgent.js";

/**
 * Build and compile the graph
 */
function buildGraph() {
  const workflow = new StateGraph(GraphState)
    // Add agent nodes
    .addNode("input_agent", inputAgent)
    .addNode("literature_search", literatureSearchAgent)
    .addNode("quality_assessment", qualityAssessmentAgent)
    .addNode("population_analysis", populationAnalysisAgent)
    .addNode("synthesis", synthesisAgent)
    // Wire: START -> input_agent -> literature_search -> quality_assessment -> population_analysis -> synthesis -> END
    .addEdge(START, "input_agent")
    .addEdge("input_agent", "literature_search")
    .addEdge("literature_search", "quality_assessment")
    .addEdge("quality_assessment", "population_analysis")
    .addEdge("population_analysis", "synthesis")
    .addEdge("synthesis", END);

  return workflow.compile();
}

// Export the compiled graph
export const graph = buildGraph();
