import { describe, it, expect } from 'vitest';
import {
  ceremonies,
  episodeEntity,
  statusCategories,
} from '../../../src/schema/schema.config.js';
import {
  CEREMONIES,
  CEREMONY_RHYTHMS,
} from '../../../src/graph/derive-constants.js';
import { validateCeremonies, type CeremonyShape } from '../../../src/schema/validator.js';

describe('schema.config.ts — ceremonies', () => {
  it('consolidation rhythm is PER_SESSION', () => {
    expect(ceremonies.consolidation.rhythm).toBe('PER_SESSION');
  });

  it('all five ceremonies present with valid rhythm', () => {
    const expected = [
      'consolidation',
      'context_loading',
      'episode_creation',
      'health_review',
      'gap_acknowledgment',
    ];
    for (const name of expected) {
      expect(Object.keys(ceremonies)).toContain(name);
    }
    for (const def of Object.values(ceremonies)) {
      expect(['PER_SESSION', 'CONDITIONAL', 'PERIODIC']).toContain(def.rhythm);
    }
  });

  it('CEREMONIES re-export matches ceremonies SSOT', () => {
    expect(CEREMONIES).toBe(ceremonies);
  });

  it('CEREMONY_RHYTHMS map matches each ceremony rhythm', () => {
    for (const [name, def] of Object.entries(ceremonies)) {
      expect(CEREMONY_RHYTHMS[name as keyof typeof CEREMONY_RHYTHMS]).toBe(def.rhythm);
    }
  });
});

describe('episodeEntity — IN_PROGRESS status', () => {
  it('statuses include IN_PROGRESS, ACTIVE, COMPLETED', () => {
    expect(episodeEntity.statuses).toEqual(['IN_PROGRESS', 'ACTIVE', 'COMPLETED']);
  });

  it('statusCategories.in_progress includes IN_PROGRESS', () => {
    expect(statusCategories.in_progress).toContain('IN_PROGRESS');
  });

  it('manualTransitions contains IN_PROGRESS → COMPLETED', () => {
    const manuals = (episodeEntity as { manualTransitions?: readonly { from: string; to: string }[] })
      .manualTransitions ?? [];
    expect(manuals.some(t => t.from === 'IN_PROGRESS' && t.to === 'COMPLETED')).toBe(true);
  });
});

describe('validator — ceremony cross-field rules', () => {
  it('happy path: default ceremonies object passes', () => {
    expect(validateCeremonies()).toEqual([]);
  });

  it('rejects CONDITIONAL ceremony without triggers', () => {
    const broken: Record<string, CeremonyShape> = {
      bad: { rhythm: 'CONDITIONAL', execution_point: 'manual', triggers: {}, trigger_role: 'depth_hint' },
    };
    const errors = validateCeremonies(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe('ceremonies.bad');
    expect(errors[0].message).toContain('CONDITIONAL');
    expect(errors[0].message).toContain('trigger');
  });

  it('rejects PER_SESSION ceremony with trigger_role: prompt_guard', () => {
    const broken: Record<string, CeremonyShape> = {
      bad: { rhythm: 'PER_SESSION', execution_point: '/x', triggers: {}, trigger_role: 'prompt_guard' },
    };
    const errors = validateCeremonies(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe('ceremonies.bad');
    expect(errors[0].message).toContain('PER_SESSION');
    expect(errors[0].message).toContain('prompt_guard');
  });
});
