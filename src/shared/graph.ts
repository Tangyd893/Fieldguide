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
} from '@understand-anything/core';

// UA core types not yet exported — define locally for Phase 1
export interface GraphMeta {
  projectName?: string
  analyzedAt?: string
  language?: string
  fileCount?: number
  nodeCount?: number
  edgeCount?: number
}

export interface TourStep {
  id?: string
  title?: string
  description?: string
  nodeIds?: string[]
}

export interface Tour {
  id?: string
  name?: string
  description?: string
  steps?: TourStep[]
}

export interface Layer {
  id: string
  name: string
  description?: string
}

export interface DomainFlow {
  id: string
  name: string
  description?: string
  layers?: Layer[]
}

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
