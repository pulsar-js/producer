// import { EventEmitter } from 'node:events'
import publish from './index.js'

const [connection_string, ...args] = process.argv.slice(2)
const message = args.join(' ')

// Supports events
// const bus = new EventEmitter()
// bus.on('end', (info) => {
//   console.log('all done', info)
// })

const messageId = await publish(connection_string, message, {
  timeout: 30,
  name: 'test-producer',
  authorization: {
    type: 'oidc',
    token: './admin.jwt'
  }
}, bus)

console.log({messageId})