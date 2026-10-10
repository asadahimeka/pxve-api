import { parentPort } from 'node:worker_threads'

parentPort.on('message', data => {
  parentPort.postMessage(data * 2)
})
