import { UA_HEADER } from '@lib/const.ts'

export async function recoverPidImage(id: string) {
  let body: string | null = null
  const fns = [queryDanbooru, queryDanbooru2, queryGelbooru, queryYandere, queryYandere2]
  for (const fn of fns) {
    const res = await fn(id).catch(() => null)
    if (res && res.every(e => e.source.includes('pixiv') || e.source.includes('pximg'))) {
      body = JSON.stringify(res)
      break
    }
  }

  return body
}

const config = {
  headers: { ...UA_HEADER },
}

function checkRecoverRes(arr: any[]) {
  return arr.every(e => e.sampleUrl)
}

async function queryDanbooru(id: string) {
  const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=pixiv%3A${id}&limit=42`, config)
  if (!res.ok) return null
  const json: any[] = await res.json()
  if (!json.length) return null
  const arr = json.map(e => ({
    source: e.source,
    tags: e.tag_string.split(/\s/),
    createDate: new Date(e.created_at).toJSON(),
    fileUrl: e.file_url,
    sampleUrl: e.media_asset?.variants?.[2]?.url || e.large_file_url || e.file_url,
  }))
  return checkRecoverRes(arr) ? arr : null
}

async function queryDanbooru2(id: string) {
  const res = await fetch(`https://danbooru.donmai.us/posts.json?tags=source:*pximg*/${id}_*&limit=42`, config)
  if (!res.ok) return null
  const json: any[] = await res.json()
  if (!json.length) return null
  const arr = json.map(e => ({
    source: e.source,
    tags: e.tag_string.split(/\s/),
    createDate: new Date(e.created_at).toJSON(),
    fileUrl: e.file_url,
    sampleUrl: e.media_asset?.variants?.[2]?.url || e.large_file_url || e.file_url,
  }))
  return checkRecoverRes(arr) ? arr : null
}

async function queryGelbooru(id: string) {
  const res = await fetch(
    `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&tags=source:*pximg*/${id}_*&limit=42&api_key=c306a5981d1e0c50518df27dbbebcf027ca4763db6d24fd1b60021d43c6c76d7&user_id=1045457`,
    config
  )
  if (!res.ok) return null
  const json = await res.json()
  if (!json?.post?.length) return null
  const arr = (json.post as any[]).map(e => ({
    source: e.source,
    tags: e.tags.split(/\s/),
    createDate: new Date(e.created_at).toJSON(),
    fileUrl: e.file_url,
    sampleUrl: e.sample_url || e.file_url,
  }))
  return checkRecoverRes(arr) ? arr : null
}

async function queryYandere(id: string) {
  const res = await fetch(`https://yande.re/post.json?tags=source:*pximg*/${id}_*&limit=20`, config)
  if (!res.ok) return null
  const json: any[] = await res.json()
  if (!json.length) return null
  const arr = json.map(e => ({
    source: e.source,
    tags: e.tags.split(/\s/),
    createDate: new Date(e.created_at * 1000).toJSON(),
    fileUrl: e.file_url,
    sampleUrl: e.sample_url || e.jpeg_url || e.file_url,
  }))
  return checkRecoverRes(arr) ? arr : null
}

async function queryYandere2(id: string) {
  const res = await fetch(`https://yande.re/post.json?tags=source:*pixiv*/${id}*&limit=20`, config)
  if (!res.ok) return null
  const json: any[] = await res.json()
  if (!json.length) return null
  const arr = json.map(e => ({
    source: e.source,
    tags: e.tags.split(/\s/),
    createDate: new Date(e.created_at * 1000).toJSON(),
    fileUrl: e.file_url,
    sampleUrl: e.sample_url || e.jpeg_url || e.file_url,
  }))
  return checkRecoverRes(arr) ? arr : null
}
