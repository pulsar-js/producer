const { publish } = require('./index.cjs');
const [connection_string, ...args] = process.argv.slice(2)
const message = args.join(' ')
const authorization = {
  type: 'oidc',
  token: './admin.jwt'
}

const messageId = publish(connection_string, message, {
  timeout: 30,
  name: 'test-producer-cjs',
  authorization
})

console.log({ messageId })