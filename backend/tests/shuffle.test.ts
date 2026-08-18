import { describe, expect, it } from 'vitest';
import {
  deriveQuestionOrder,
  hashSeedToUint32,
  mulberry32,
} from '../src/utils/shuffle.js';

const IDS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'];

describe('hashSeedToUint32', () => {
  it('should_return_same_hash_when_seeds_are_identical', () => {
    expect(hashSeedToUint32('a1b2c3d4e5')).toBe(hashSeedToUint32('a1b2c3d4e5'));
  });

  it('should_return_uint32_when_seed_is_any_string', () => {
    const hash = hashSeedToUint32('deadbeef01');
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThanOrEqual(0xffffffff);
    expect(Number.isInteger(hash)).toBe(true);
  });
});

describe('mulberry32', () => {
  it('should_return_same_sequence_when_states_are_equal', () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it('should_return_floats_in_unit_range_when_invoked', () => {
    const rng = mulberry32(999);
    for (let i = 0; i < 1000; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('deriveQuestionOrder', () => {
  it('should_return_identical_order_when_seed_is_the_same', () => {
    const first = deriveQuestionOrder('a1b2c3d4e5', IDS, 6);
    const second = deriveQuestionOrder('a1b2c3d4e5', IDS, 6);
    expect(first).toEqual(second);
  });

  it('should_return_different_orders_when_seeds_differ', () => {
    const first = deriveQuestionOrder('a1b2c3d4e5', IDS, 6);
    const second = deriveQuestionOrder('f6e5d4c3b2', IDS, 6);
    expect(first).not.toEqual(second);
  });

  it('should_return_count_length_prefix_when_count_is_less_than_list_length', () => {
    const order = deriveQuestionOrder('a1b2c3d4e5', IDS, 3);
    expect(order).toHaveLength(3);
    expect(IDS).toEqual(expect.arrayContaining(order));
    expect(new Set(order).size).toBe(3);
  });

  it('should_return_empty_array_when_question_list_is_empty', () => {
    expect(deriveQuestionOrder('a1b2c3d4e5', [], 0)).toEqual([]);
    expect(deriveQuestionOrder('a1b2c3d4e5', [], 3)).toEqual([]);
  });

  it('should_return_single_element_when_list_has_one_element', () => {
    expect(deriveQuestionOrder('a1b2c3d4e5', ['only-q'], 1)).toEqual(['only-q']);
  });

  it('should_return_permutation_when_count_equals_list_length', () => {
    const order = deriveQuestionOrder('a1b2c3d4e5', IDS, IDS.length);
    expect(order).toHaveLength(IDS.length);
    expect([...order].sort()).toEqual([...IDS].sort());
  });
});
