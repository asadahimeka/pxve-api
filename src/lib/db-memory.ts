interface Data<T> {
  data?: T
  expires: number
}

const _memdbMap = new Map<string, any>()

export const memdb = {
  get<T = unknown>(key: string, def?: T) {
    const result: Data<T> = _memdbMap.get(key)
    if (result) {
      if (Math.floor(+new Date() / 1000) >= result.expires && result.expires !== -1) {
        result.data = def
        _memdbMap.delete(key)
      }
      return result.data
    } else {
      return def
    }
  },

  set<T = unknown>(key: string, val: T, expires = -1) {
    if (val === undefined) {
      _memdbMap.delete(key)
      return
    }
    if (typeof expires === 'number' && expires >= 0) {
      expires = Math.floor(+new Date() / 1000) + expires
    } else {
      expires = -1
    }
    _memdbMap.set(key, { data: val, expires })
  },
}
