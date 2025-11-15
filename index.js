import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { join, dirname, resolve } from 'path'
import { access, constants } from 'fs/promises'
import { readFileSync } from 'fs'
import { EventEmitter } from 'node:events'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const BIN_PATH = join(__dirname, 'bin', 'pulsar-publish' + (process.platform === 'win32' ? '.exe' : ''))

async function exists (path) {
  try {
    await access(path, constants.F_OK)
    return true
  } catch(e) {
    return false
  }
}

if (!(await exists(BIN_PATH))) {
  console.log(`${BIN_PATH} not found, attempting to download...`)

  // Attempt to download the required binary
  const { run } = await import('./scripts/binary.js')
  await run().catch(e => {
    throw new Error('the module is not installed correctly(binary not found at ' + BIN_PATH + ') - failed to auto-download binary during module import: ' + e.message)
  })

  if (!(await exists(BIN_PATH))) {
    throw new Error('the module is not installed correctly (binary not found at ' + BIN_PATH + ')')
  }

  console.log(`${BIN_PATH} downloaded successfully`)
}

/**
 * @typedef {string} ISODateString
 * @description ISO 8601 date string
 * @example "2025-04-05T12:34:56.789Z"
 */

/**
 * @typedef {Object} PublisherOptions
 * @description Configuration options for the Pulsar publisher.
 * @property {number} [timeout=30] - The timeout in seconds for publishing a message.
 * @property {string} [name='manual-producer'] - The name of the producer.
 * @property {Object} [properties={}] - Additional properties to set on the producer.
 */

/**
 * @typedef {Object} MessageOptions
 * @description Options to apply to the message.
 * @property {string} [key] - The message key.
 * @property {string} [orderingKey] - The ordering key for the message.
 * @property {number} [eventTime] - The event time for the message (ms since epoch).
 * @property {string[]} [replicationClusters] - The replication clusters for the message.
 * @property {boolean} [disableReplication] - Whether to disable replication for the message.
 * @property {number} [sequenceId] - The sequence ID for the message.
 * @property {number} [deliverAfter] - Delay delivery of the Shared or KeyShared subscription message by specified milliseconds.
 * @property {number} [deliverAt] - Deliver the message at a specific timestamp (ms since epoch).
 * @property {Object} [properties] - Additional properties to set on the message.
 */

/**
 * @typedef {Object} OAuth2Config
 * @description Configuration for OAuth2 authentication.
 * @property {string} issuer - The issuer URL.
 * @property {string} privateKey - The path to the private key file.
 * @property {string} audience - The audience for the token.
 * @property {string} clientId - The client ID for the token.
 */

/**
 * @typedef {Object} AthenzConfig
 * @description Configuration for Athenz authentication.
 * @property {string} domain - The Athenz domain.
 * @property {string} tenant - The Athenz tenant.
 * @property {string} service - The Athenz service.
 * @property {string} privateKey - The path to the private key file.
 * @property {string} url - The Athenz URL.
 * @property {string} [proxy] - The Athenz proxy URL.
 * @property {string} [keyId] - The Athenz key ID.
 * @property {string} [caCert] - The path to the CA certificate file.
 */

/**
 * @class Publisher
 * A Pulsar message publisher.
 */
export class Publisher {
  #connection_string
  #timeout
  #name
  #options
  #properties = {}
  #authentication = { type: null }

  /**
   * Creates a new Publisher instance.
   * @param {string} connection_string - The connection string to the Pulsar cluster.
   * @param {PublisherOptions} options - The options for the publisher.
   */
  constructor (connection_string, options = {}) {
    this.#connection_string = connection_string
    this.#timeout = options.timeout || 30
    this.#name = options.name || 'manual-producer'
    this.#properties = options.properties || {}

    // Remove timeout from options to avoid duplication in CLI args
    delete options.timeout
    delete options.name
    delete options.properties

    this.#options = options
  }

  #command (message, options = {}) {
    const command = [this.#connection_string]

    if (!options.test) {
      command.push(`${message.replace(/\"/g, '\\"')}`)

      // Serialize JSON & other non-string primitives
      switch (typeof message) {
        case 'object':
          message = JSON.stringify(message)
          break
        case 'string':
          break
        default:
          message = message.toString()
          break
      }

      // Apply message flags
      for (const [key, value] of Object.entries(options)) {
        switch (key.trim().toLowerCase()) {
          case 'key':
            command.unshift('--key', `"${value}"`)
            break
          case 'orderingkey':
            command.unshift('--ordering-key', `"${value}"`)
            break
          case 'eventtime':
            command.unshift('--event-time', `"${value}"`)
            break
          case 'replicationclusters':
            for (const cluster of value) {
              command.unshift('--replication-cluster', `"${cluster}"`)
            }
            break
          case 'disablereplication':
            command.unshift('--disable-replication')
            break
          case 'sequenceid':
            command.unshift('--sequence-id', `"${value}"`)
            break
          case 'deliverafter':
            command.unshift('--deliver-after', `"${value}"`)
            break
          case 'deliverat':
            command.unshift('--deliver-at', `"${value}"`)
            break
          case 'properties':
            for (const [k, v] of Object.entries(value)) {
              command.unshift('--property', `${k}="${v}"`)
            }
            break
          case 'producer-properties':
            for (const [k, v] of Object.entries(value)) {
              command.unshift('--producer-property', `${k}="${v}"`)
            }
            break
        }
      }

      // Apply producer flags
      for (const [key, value] of Object.entries(this.#properties)) {
        command.unshift('--producer-property', `${key}=${value}`)
      }
      command.unshift('--timeout', `${this.#timeout}`)
      command.unshift('--name', `"${this.#name}"`)
    }

    this.#authentication = options.authentication ?? options.auth ?? this.#authentication

    // Apply authorization flags
    if (this.#authentication) {
      switch (this.#authentication.type) {
        case 'oidc':
          if (this.#authentication.allowUnverified) {
            command.unshift('--allow-unverified')
          }
          this.#authentication.token && command.unshift('--jwt', `${this.#authentication.token}`)
          break
        case 'mtls':
          this.#authentication.certPath && command.unshift('--mtls-cert', `${this.#authentication.certPath}`)
          this.#authentication.keyPath && command.unshift('--mtls-key', `${this.#authentication.keyPath}`)
          this.#authentication.caCert && command.unshift('--mtls-ca-cert', `${this.#authentication.caCert}`)
          break
        case 'oauth2':
          this.#authentication.issuer && command.unshift('--oauth2-issuer', `${this.#authentication.issuer}`)
          this.#authentication.privateKey && command.unshift('--oauth2-private-key', `${this.#authentication.privateKey}`)
          this.#authentication.audience && command.unshift('--oauth2-audience', `${this.#authentication.audience}`)
          this.#authentication.clientID && command.unshift('--oauth2-client-id', `${this.#authentication.clientID}`)
          break
        case 'basic':
          this.#authentication.username && command.unshift('--username', `${this.#authentication.username}`)
          this.#authentication.password && command.unshift('--password', `${this.#authentication.password}`)
          break
        case 'athenz':
          this.#authentication.url && command.unshift('--athenz', `${this.#authentication.url}`)
          this.#authentication.domain && command.unshift('--athenz-domain', `${this.#authentication.domain}`)
          this.#authentication.tenant && command.unshift('--athenz-tenant', `${this.#authentication.tenant}`)
          this.#authentication.service && command.unshift('--athenz-service', `${this.#authentication.service}`)
          this.#authentication.privateKey && command.unshift('--athenz-private-key', `${this.#authentication.privateKey}`)
          this.#authentication.keyId && command.unshift('--athenz-key-id', `${this.#authentication.keyId}`)
          this.#authentication.caCert && command.unshift('--athenz-ca-cert', `${this.#authentication.caCert}`)
          if (this.#authentication.proxy) {
            command.unshift('--athenz-proxy', `${this.#authentication.proxy}`)
          }
          break
      }
    }

    if (options.test) {
      command.unshift('--test')
    }

    return command
  }

  #process (child, bus, setResponse, reject, test = false) {
    return function process(data) {
      const entry = JSON.parse(data.toString())
      const { msg, time } = entry
      delete entry.msg

      if (entry.error) {
        child.kill()
        if (test) {
          setResponse(false)
          return
        }
        const err = new Error(entry.error)
        if (bus) {
          bus.emit('error', err)
        }
        return reject(err)
      }

      if (bus) {
        entry.time = new Date(entry.time)
        bus.emit(msg, entry)
      }

      delete entry.time
      delete entry.level

      if (msg === 'done') {
        setResponse(entry.message_id)
        return
      } else if (msg === 'test') {
        setResponse(entry.success)
        return
      }

      console.log(`${time} ${msg}${(Object.keys(entry).length > 0 ? ': ' + JSON.stringify(entry) : '')}`)
    }
  }

  /**
   * Sends a message to the specified topic.
   * @param {string|Object} message - The message to send. Accepts string or object. Objects must be serializable to JSON.
   * @param {MessageOptions} options - The options for sending the message.
   * @param {EventEmitter} bus - The bus to send the message to.
   * @returns {Promise<string>} A promise that resolves with the message ID when successful.
   */
  async publish (message, options = {}, bus) {
    return new Promise((done, reject) => {
      const command = this.#command(message, options)
      const child = spawn(BIN_PATH, command)

      let messageId
      const setResponse = id => { messageId = id }
      child.stdout.on('data', this.#process(child, bus, setResponse, reject, options.test ?? false))
      child.stderr.on('data', this.#process(child, bus, setResponse, reject, options.test ?? false))

      child.on('close', (code) => {
        if (options.test && messageId !== undefined && messageId !== null) {
          return done(messageId)
        }

        if (code !== 0) {
          return reject(new Error('pulsar-publish process exited with code ' + code))
        }

        if (!messageId) {
          return reject(new Error(`message ID (${messageId}) was not returned from pulsar-publish (unknown error)`))
        }

        if (bus) {
          bus.emit('end', { messageId })
        }

        return done(messageId)
      })
    })
  }

  /**
   * Tests the connection to the Pulsar cluster.
   * @param {Object} options - The options for testing the connection.
   * @param {EventEmitter} bus - The bus to send the message to.
   */
  async test(options = {}, bus) {
    options.test = true
    return this.publish('_', options, bus)
  }

  /**
   * Sets the JWT configuration for the publisher.
   * Overrides any pre-existing authorization configuration.
   * @param {string} token - The path to the JWT file or the raw JWT
   * @param {bool} [allowUnverified=false] - Ignores verification errors.
   */
  setJWT (token, allowUnverified = false) {
    if (!token || token.trim().length === 0) {
      throw new Error('a valid JWT token must be provided')
    }

    if (!token.startsWith('eyJ')) {
      token = readFileSync(resolve(__dirname, token))
    }

    this.#authentication = {
      type: 'oidc',
      token,
      allowUnverified
    }
  }

  /**
   * Sets the mTLS configuration for the publisher.
   * Overrides any pre-existing authorization configuration.
   * @param {string} certPath - The path to the certificate file.
   * @param {string} keyPath - The path to the private key file.
   * @param {string} caCert - The path to the CA certificate file.
   */
  setmTLS (certPath, keyPath, caCert) {
    this.#authentication = {
      certPath,
      keyPath,
      caCert
    }
  }

  /**
   * Sets the OAuth2 configuration for the publisher.
   * Overrides any pre-existing authorization configuration.
   * @param {OAuth2Config} config - The OAuth2 configuration.
   */
  setOauth2 (config = {}) {
    this.#authentication = {
      type: 'oauth2',
      issuer: config.issuer,
      privateKey: config.privateKey,
      audience: config.audience,
      clientId: config.clientId,
    }
  }

  /**
   * Sets the basic authentication configuration for the publisher.
   * Overrides any pre-existing authorization configuration.
   * @param {string} username - The username for basic authentication.
   * @param {string} password - The password for basic authentication.
   */
  setBasicAuth (username, password) {
    this.#authentication = {
      type: 'basic',
      username,
      password
    }
  }

  /**
   * Sets the Athenz configuration for the publisher.
   * Overrides any pre-existing authorization configuration.
   * @param {AthenzConfig} config
   */
  setAthenz (config = {}) {
    this.#authentication = {
      type: 'athenz',
      domain: config.domain,
      tenant: config.tenant,
      service: config.service,
      privateKey: config.privateKey,
      url: config.url,
      proxy: config.proxy,
      keyId: config.keyId,
      caCert: config.caCert
    }
  }
}

function getPublisher(connection_string, opts = {}) {
  const publisher = new Publisher(connection_string, {
    timeout: opts.timeout ?? 30,
    name: opts.name ?? 'manual-producer',
    properties: opts.properties || {}
  })

  opts.authorization = opts.authorization ?? opts.auth ?? null

  // Config
  if (opts.authorization) {
    switch ((opts.authorization.type ?? '').trim().toLowerCase()) {
      case 'oidc':
        publisher.setJWT(opts.authorization?.token ?? 'none', opts.authorization?.allowUnverified ?? false)
        break
      case 'mtls':
        publisher.setmTLS(
          opts.authorization?.certPath ?? undefined,
          opts.authorization?.keyPath ?? undefined,
          opts.authorization?.caCert ?? undefined
        )
        break
      case 'oauth2':
        publisher.setOauth2({
          issuer: opts.authorization?.issuer ?? undefined,
          privateKey: opts.authorization?.privateKey ?? undefined,
          audience: opts.authorization?.audience ?? undefined,
          clientId: opts.authorization?.clientId ?? undefined,
        })
        break
      case 'basic':
        publisher.setBasicAuth(opts.authorization?.username, opts.authorization?.password)
        break
      case 'athenz':
        publisher.setAthenz({
          domain: opts.authorization?.domain ?? undefined,
          tenant: opts.authorization?.tenant ?? undefined,
          service: opts.authorization?.service ?? undefined,
          privateKey: opts.authorization?.privateKey ?? undefined,
          url: opts.authorization?.url ?? undefined,
          proxy: opts.authorization?.proxy ?? undefined,
          keyId: opts.authorization?.keyId ?? undefined,
          caCert: opts.authorization?.caCert ?? undefined,
        })
        break
    }
  }

  delete opts.authorization
  delete opts.auth

  return publisher
}

/**
 * Publishes a message to a Pulsar topic.
 * @param {string} connection_string - The Pulsar connection string.
 * @param {string|Object} message - The message to send. Accepts string or object. Objects must be serializable to JSON.
 * @param {MessageOptions} opts - The options for sending the message.
 * @param {EventEmitter} bus - The bus to use for sending the message.
 * @returns {Promise<string>} A promise that resolves with the message ID.
 */
export default async function publish(connection_string, message, opts = {}, bus) {
  return getPublisher(connection_string, opts).publish(message, opts, bus)
}

export { publish }

/**
 * Tests the connection to a Pulsar cluster.
 * @param {string} connection_string - The Pulsar connection string.
 * @param {MessageOptions} opts - The options for sending the message.
 * @param {EventEmitter} bus - The bus to use for sending the message.
 * @returns {Promise<string>} A promise that resolves with the message ID.
 */
export async function test(connection_string, opts = {}, bus) {
  return getPublisher(connection_string, opts).test(opts, bus)
}