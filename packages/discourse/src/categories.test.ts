import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { flattenCategoryList } from './types'

describe('flattenCategoryList', () => {
  it('walks nested subcategory_list deeper than one level', () => {
    type Node = { id: number; subcategory_list?: Node[] }
    const tree: Node[] = [
      {
        id: 1,
        subcategory_list: [
          {
            id: 2,
            subcategory_list: [{ id: 3 }],
          },
        ],
      },
    ]
    assert.deepEqual(
      flattenCategoryList(tree).map((c) => c.id),
      [1, 2, 3]
    )
  })
})
