/**
 * Build spaced-repetition cards from the artefacts the app already produced.
 *
 * Knowledge cards and interview questions are generated once and then never seen
 * again; turning them into review cards is what closes that loop (B3). Notes are
 * included too, so a reader's own observations come back round.
 *
 * Pure mapping logic (no DB access) → unit-testable.
 */
import { listKnowledgeNodes, listQuestions, listCodeNotes, type ReviewCardInput } from './db'

/** Trim a long answer so the card back stays readable. */
function clip(text: string, max = 600): string {
  const trimmed = String(text ?? '').trim()
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max)}…`
}

/** Build review cards for a project from knowledge, questions and notes. */
export function buildReviewCards(projectId: string): ReviewCardInput[] {
  const cards: ReviewCardInput[] = []

  for (const knowledge of listKnowledgeNodes(projectId)) {
    const back = [
      knowledge.principle ? `**原理**：${knowledge.principle}` : '',
      knowledge.tradeoffs ? `**取舍**：${knowledge.tradeoffs}` : '',
      knowledge.examples ? `**示例**：${knowledge.examples}` : '',
    ].filter(Boolean).join('\n\n')
    if (!back) continue
    cards.push({
      project_id: projectId,
      source_type: 'knowledge',
      source_id: knowledge.id,
      front: `解释一下：${knowledge.concept}`,
      back: clip(back),
      node_ids: knowledge.relatedNodeIds.slice(0, 5),
    })
  }

  for (const question of listQuestions(projectId)) {
    if (!question.answer?.trim()) continue
    cards.push({
      project_id: projectId,
      source_type: 'question',
      source_id: question.id,
      front: question.problem,
      back: clip([
        question.context ? `**背景**：${question.context}` : '',
        question.answer,
      ].filter(Boolean).join('\n\n')),
      node_ids: question.relatedNodeIds.slice(0, 5),
    })
  }

  // Only substantial notes become cards — a one-line reminder is not a question.
  for (const note of listCodeNotes(projectId)) {
    if (note.body.trim().length < 40) continue
    cards.push({
      project_id: projectId,
      source_type: 'note',
      source_id: note.id,
      front: `你在 ${note.file_path}${note.line_start ? `:${note.line_start}` : ''} 记了什么？`,
      back: clip(note.body),
      node_ids: note.node_id ? [note.node_id] : [],
    })
  }

  return cards
}
