import { translate as msTranslate } from 'bing-translate-api'
import { translate as ggTranslate } from 'google-translate-api-x'
import { translate as ydTranslate } from '../youdao.ts'
import { SILICONClOUD_APT_KEY } from '@lib/const.ts'
import { pixivWebApi } from './web-api.ts'

export async function translatePixivNovel(id: string, query: Record<string, string>) {
  id = id.replace('.html', '')
  const { to, nots, srv = 'ms', aimd = 'glm' } = query
  const novelText = await getNovelText(id)
  const body = await fanyi(novelText, to, srv, nots?.split(',') || [], aimd)
  const headers = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'max-age=31536000',
  }
  return { body, headers }
}

async function getNovelText(id: any) {
  const json = await pixivWebApi.novel(id)
  return json.content
}

const srvDefMap = (to: string, aiModel: string) =>
  ({
    ms: async (text: string) => {
      const resp = await msTranslate(text, null, to || 'zh-Hans', { translateOptions: { textType: 'html' } })
      return resp?.translation
    },
    gg: async (text: string) => {
      const resp = await ggTranslate(text, { from: 'auto', to: to || 'zh-CN' })
      return resp?.text
    },
    yd: async (text: string) => {
      const resp = await ydTranslate(text)
      return resp
        .map(
          line =>
            `<p>${line.map(e => e.srcRuby || '').join('')}</p><p style="color:gray">${line.map(e => e.res || '').join('')}</p>`
        )
        .join('')
    },
    sc: async (text: string) => await siliconCloudTranslate(text, aiModel),
  }) as Record<string, (text: string) => Promise<string>>

async function fanyi(novelText: string, to: string, srv: string, nots: string[], aiModel: string): Promise<string> {
  if (!novelText?.trim()) throw new Error('Translate failed: empty text')
  const opt = srvDefMap(to, aiModel)[srv]
  if (!opt) throw new Error('Translate failed: no opt')

  if (srv === 'sc') {
    let n = replaceNovelMark(novelText)
    nots.forEach((e, i) => {
      n = n.replaceAll(e, `[名字${i}]`)
    })
    let resText = await opt(n)
    nots.forEach((e, i) => {
      resText = resText.replaceAll(`[名字${i}]`, e)
      resText = resText.replaceAll(`名字${i}`, e)
    })
    return resText.replace(/\n/g, '<br>')
  }

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
  const results: any[] = []
  for (const item of splitTextArr) {
    let text = replaceNovelMark(item)
    if (srv === 'ms') {
      nots.forEach(e => {
        text = text.replaceAll(e, `<span class="notranslate">${e}</span>`)
      })
    }
    const resp = await opt(text)
    results.push(resp)
    await sleep(500)
  }
  if (srv === 'yd') return results.join('\n')
  return splitTextArr
    .map((e, i) => {
      const ta = results[i].split('\n')
      return e.split('\n').map((f, j) => `${f}<p style="color:gray">${ta[j] || ''}</p>`)
    })
    .flat(Infinity)
    .join('\n')
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function replaceNovelMark(text: string) {
  return text
    .replace(/\[newpage\]/g, '\n\n————————\n\n')
    .replace(/\[\[rb:([^>[\]]+) *> *([^>[\]]+)\]\]/g, '$1($2)')
    .replace(/\[\[jumpuri:([^>\s[\]]+) *> *([^>\s[\]]+)\]\]/g, '$1')
    .replace(/\[pixivimage:([\d-]+)\]/g, 'https://pixiv.re/$1.png')
    .replace(/\[chapter: *([^[\]]+)\]/g, '\n$1\n')
    .replace(/\[uploadedimage:(\d+)\]/g, '')
}

const aiModelMap: Record<string, string> = {
  glm: 'THUDM/GLM-Z1-9B-0414',
  qwen: 'Qwen/Qwen2.5-7B-Instruct'
}
async function siliconCloudTranslate(text: string, aiModel: string) {
  aiModel = aiModel || 'glm'
  const resp = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${SILICONClOUD_APT_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: aiModelMap[aiModel],
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: `将下面的文本翻译为中文：\n${text}`,
        },
      ],
    }),
  })
  if (!resp.ok) throw new Error('Translate failed: ' + aiModel)
  const json = await resp.json()
  return json.choices[0].message.content
}
