/**
 * Graph types — re-exports UA KnowledgeGraph for shared use.
 *
 * Prefer importing from @understand-anything/core directly;
 * this file provides Fieldguide-specific extensions.
 */
export type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphMeta,
  Tour,
  TourStep,
  Layer,
  DomainFlow,
} from '@understand-anything/core';

/**
 * Fieldguide extension: concept link between a paper and a graph node.
 */
export interface ConceptLink {
  id: string;
  paperId: string;
  projectId: string;
  paperAnchor: string;
  nodeId: string;
  note?: string;
  createdAt: string;
}
