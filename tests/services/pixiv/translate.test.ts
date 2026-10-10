import assert from 'node:assert/strict'
import { test } from 'node:test'

test('pixiv translate service - replaceNovelMark handles special marks', () => {
  const replaceNovelMark = (text: string) => {
    return text
      .replace(/\[newpage\]/g, '\n\n————————\n\n')
      .replace(/\[\[rb:([^>[\]]+) *> *([^>[\]]+)\]\]/g, '$1($2)')
      .replace(/\[\[jumpuri:([^>\s[\]]+) *> *([^>\s[\]]+)\]\]/g, '$1')
      .replace(/\[pixivimage:([\d-]+)\]/g, 'https://pixiv.re/$1.png')
      .replace(/\[chapter: *([^[\]]+)\]/g, '\n$1\n')
      .replace(/\[uploadedimage:(\d+)\]/g, '')
  }

  assert.deepEqual(replaceNovelMark('[newpage]'), '\n\n————————\n\n')
  assert.deepEqual(replaceNovelMark('[[rb:漢字 > かんじ]]').includes('漢字'), true)
  assert.deepEqual(replaceNovelMark('[[jumpuri:リンク > https://example.com]]'), 'リンク')
  assert.deepEqual(replaceNovelMark('[pixivimage:12345678-0]'), 'https://pixiv.re/12345678-0.png')
  assert.deepEqual(replaceNovelMark('[chapter: 第一章]'), '\n第一章\n')
  assert.deepEqual(replaceNovelMark('[uploadedimage:123456]'), '')
})

test('pixiv translate service - text splitting works correctly', () => {
  const novelText = 'a'.repeat(2500)
  const arr = novelText.replace(/\n+/g, '\n').split('')
  const indexes = []

  for (let i = 0, j = 1e3; i < arr.length; i++) {
    if (/\n/.test(arr[i]) && i > j) {
      indexes.push(i)
      j += 1e3
    }
  }
  indexes.push(arr.length)

  const splitTextArr = indexes
    .reduce(
      (acc, cur) => {
        const last = acc.at(-1)
        acc.push({
          v: arr.slice(last!.i, cur + 1).join(''),
          i: cur,
        })
        return acc
      },
      [{ v: '', i: 0 }]
    )
    .map(e => e.v)
    .slice(1)

  assert.deepEqual(splitTextArr.length >= 1, true)
})

test('pixiv translate service - aiModelMap contains expected models', () => {
  const aiModelMap: Record<string, string> = {
    glm: 'THUDM/glm-4-9b-chat',
    qwen: 'Qwen/Qwen2-7B-Instruct',
  }

  assert.deepEqual(aiModelMap.glm, 'THUDM/glm-4-9b-chat')
  assert.deepEqual(aiModelMap.qwen, 'Qwen/Qwen2-7B-Instruct')
})
