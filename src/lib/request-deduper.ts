export class RequestDeduper {
  map: Map<string, Promise<Response>>

  constructor() {
    this.map = new Map()
  }

  run(key: string, fn: (...args: any[]) => Response | Promise<Response>) {
    if (this.map.has(key)) {
      return this.map.get(key)!.then(res => res.clone())
    }

    const p = (async () => {
      try {
        const res = await fn()
        return res
      } catch (err: any) {
        console.error(new Date().toLocaleString('zh'), key, 'ERROR:', err)
        return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        })
      } finally {
        this.map.delete(key)
      }
    })()

    this.map.set(key, p)

    return p
  }
}
