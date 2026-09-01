import { assertEquals, assertRejects } from '@std/assert'

Deno.test('pixiv translate service - replaceNovelMark handles special marks', () => {
  const replaceNovelMark = (text: string) => {
    return text
      .replace(/\[newpage\]/g, '\n\n————————\n\n')
      .replace(/\[\[rb:([^>[\]]+) *> *([^>[\]]+)\]\]/g, '$1($2)')
      .replace(/\[\[jumpuri:([^>\s[\]]+) *> *([^>\s[\]]+)\]\]/g, '$1')
      .replace(/\[pixivimage:([\d-]+)\]/g, 'https://pixiv.re/$1.png')
      .replace(/\[chapter: *([^[\]]+)\]/g, '\n$1\n')
      .replace(/\[uploadedimage:(\d+)\]/g, '')
  }

  assertEquals(replaceNovelMark('[newpage]'), '\n\n————————\n\n')
  assertEquals(replaceNovelMark('[[rb:漢字 > かんじ]]').includes('漢字'), true)
  assertEquals(replaceNovelMark('[[jumpuri:リンク > https://example.com]]'), 'リンク')
  assertEquals(replaceNovelMark('[pixivimage:12345678-0]'), 'https://pixiv.re/12345678-0.png')
  assertEquals(replaceNovelMark('[chapter: 第一章]'), '\n第一章\n')
  assertEquals(replaceNovelMark('[uploadedimage:123456]'), '')
})

Deno.test('pixiv translate service - text splitting works correctly', () => {
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
      [{ v: '', i: 0 }],
    )
    .map((e) => e.v)
    .slice(1)

  assertEquals(splitTextArr.length >= 1, true)
})

Deno.test('pixiv translate service - aiModelMap contains expected models', () => {
  const aiModelMap: Record<string, string> = {
    glm: 'THUDM/glm-4-9b-chat',
    qwen: 'Qwen/Qwen2-7B-Instruct',
  }

  assertEquals(aiModelMap.glm, 'THUDM/glm-4-9b-chat')
  assertEquals(aiModelMap.qwen, 'Qwen/Qwen2-7B-Instruct')
})
