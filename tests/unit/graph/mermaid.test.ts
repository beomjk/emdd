import { describe, it, expect } from 'vitest';
import { generateMermaid } from '../../../src/graph/mermaid.js';
import type { Graph, Node } from '../../../src/graph/types.js';

function makeNode(overrides: Partial<Node> & { id: string; type: Node['type'] }): Node {
  return {
    title: 'Test Node',
    status: 'PROPOSED',
    links: [],
    tags: [],
    path: '',
    meta: {},
    ...overrides,
  };
}

function makeGraph(nodes: Node[]): Graph {
  const map = new Map<string, Node>();
  for (const n of nodes) map.set(n.id, n);
  return { nodes: map, errors: [], warnings: [] };
}

describe('generateMermaid', () => {
  it('graph TD 헤더로 시작한다', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Test' }),
    ]);
    expect(generateMermaid(graph)).toMatch(/^graph TD/);
  });

  it('모든 노드가 포함된다', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Hypothesis A' }),
      makeNode({ id: 'exp-001', type: 'experiment', title: 'Experiment A' }),
      makeNode({ id: 'fnd-001', type: 'finding', title: 'Finding A' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toContain('hyp-001');
    expect(output).toContain('exp-001');
    expect(output).toContain('fnd-001');
  });

  it('노드 라벨에 id와 title이 포함된다', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Surface Defect Detection' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toContain('hyp-001');
    expect(output).toContain('Surface Defect Detection');
  });

  it('엣지가 관계명으로 표시된다', () => {
    const graph = makeGraph([
      makeNode({
        id: 'exp-001', type: 'experiment', title: 'Exp',
        links: [{ target: 'hyp-001', relation: 'supports' }],
      }),
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Hyp' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toContain('exp-001');
    expect(output).toContain('hyp-001');
    expect(output).toContain('supports');
  });

  it('긴 제목을 잘라낸다 (40자 기준)', () => {
    const longTitle = 'A'.repeat(60);
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: longTitle }),
    ]);
    const output = generateMermaid(graph);
    expect(output).not.toContain(longTitle);
    expect(output).toContain('A'.repeat(40));
  });

  it('빈 그래프에서도 유효한 Mermaid를 반환한다', () => {
    const graph: Graph = { nodes: new Map(), errors: [], warnings: [] };
    const output = generateMermaid(graph);
    expect(output.trim()).toBe('graph TD');
  });

  it('CONFIRMED 상태 노드에 스타일이 적용된다', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Confirmed', status: 'CONFIRMED' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toMatch(/style.*hyp-001/);
  });

  it('REFUTED 상태 노드에 스타일이 적용된다', () => {
    const graph = makeGraph([
      makeNode({ id: 'hyp-001', type: 'hypothesis', title: 'Refuted', status: 'REFUTED' }),
    ]);
    const output = generateMermaid(graph);
    expect(output).toMatch(/style.*hyp-001/);
  });
});
