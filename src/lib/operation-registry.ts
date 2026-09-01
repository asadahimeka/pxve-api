import { setImmediate } from 'node:timers'

// ref: https://github.com/nelsongomes/reliable-caching
export class OperationRegistry {
  operationRegistry: Map<string, any[]>

  constructor() {
    this.operationRegistry = new Map()
  }

  initKey(key: string) {
    if (!this.operationRegistry.get(key)) {
      this.operationRegistry.set(key, [])
    }
  }

  existsKey(key: string) {
    return this.operationRegistry.has(key)
  }

  triggerAwaitingResolves(key: string, value: any) {
    const promises = this.operationRegistry.get(key)
    // we reset promises for next iteration
    this.operationRegistry.delete(key)
    if (promises?.length) {
      // cut first element
      promises.slice(1).forEach(([resolve]) => {
        // trigger waiting promises on next eventloop
        setImmediate(() => {
          resolve(value)
        })
      })
    }
  }

  triggerAwaitingRejects(key: string, error: any) {
    const promises = this.operationRegistry.get(key)
    // we reset promises for next iteration
    this.operationRegistry.delete(key)
    if (promises?.length) {
      // cut first element
      promises.slice(1).forEach(([_, reject]) => {
        // trigger waiting promises on next eventloop
        setImmediate(() => {
          reject(error)
        })
      })
    }
  }

  isExecuting(key: string) {
    // initialize registry for key, not existent
    this.initKey(key)
    const keyRegistry = this.operationRegistry.get(key)!
    if (keyRegistry.length === 0) {
      // first entry marks that a promise is fetching the key
      keyRegistry.push([null, null])
    } else {
      // next entries will wait for response of the first promise
      const promise = new Promise((resolve, reject) => {
        keyRegistry.push([resolve, reject])
      })
      return promise
    }
  }
}
