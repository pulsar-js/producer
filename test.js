const { platform, arch } = process

console.log({ platform, arch })

// import { EventEmitter } from 'node:events'
// import { publish, test } from './index.js'

// const [connection_string, ...args] = process.argv.slice(2)
// const message = args.join(' ')

// // Supports events
// const bus = new EventEmitter()
// bus.on('end', (info) => {
//   console.log('all done', info)
// })

// const authorization = {
//   type: 'oidc',
//   token: './admin.jwt'
// }

// const messageId = await publish(connection_string, message, {
//   timeout: 30,
//   name: 'test-producer',
//   authorization
// }, bus)

// // const accessible = await test(connection_string, { authorization }, bus)
// // console.log({accessible})

// console.log({messageId})