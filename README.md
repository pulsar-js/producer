# @pulsar-js/producer

`@pulsar-js/producer` provides a simple way to send messages to Apache Pulsar topics from Node.js.

**Isn't there already an official module for this?**

Yes, but it's _hard to install_. The [official pulsar node client](https://www.npmjs.com/package/pulsar-client) is a wrapper around the Pulsar C++ library. Using this in Node.js means your system must have a compiler and node-gyp. This can be an unnecessary barrier in environments that can't extra have build tools installed.

**How does `@pulsar-js/producer` simplify my life?**

This module downloads a [pre-built binary](https://github.com/pulsar-js/producer-bin) for you. As a result, the npm install process does not need a build step or a compiler.

The pre-built binary was designed specifically for producing messages (not consuming). It was designed specifically for this node module, but it is a standalone CLI app that could be used independently of this module if desired.

## Installation

`npm install @pulsar-js/producer -S`

## Usage

```js
import publish from '@pulsar-js/producer'

await publish('pulsar://my_server:5678/persistent/namespace/topic', message/*, options*/)
```

The connection string accepts `pulsar://` or `pulsar+ssl://` protocols. The syntax is `protocol://server:port/[non-]persistent/namespace/topic`

## Options

The optional third argument to `publish(connectionString, message, options)` controls the producer configuration, message metadata, and authentication. The object is case-insensitive for the keys shown below.

### Producer configuration

- `timeout` *(number, default: 30)* – Seconds to wait for the underlying CLI to complete.
- `name` *(string, default: `manual-producer`)* – Pulsar producer name.
- `properties` *(object)* – Key/value pairs forwarded as Pulsar producer properties.

### Message metadata

- `key` *(string)* – Message key.
- `orderingKey` *(string)* – Ordering key for KeyShared subscriptions.
- `eventTime` *(number)* – Milliseconds since epoch representing the event timestamp.
- `replicationClusters` *(string[])* – One or more cluster names to replicate the message to.
- `disableReplication` *(boolean)* – Skip cross-cluster replication.
- `sequenceId` *(number)* – Explicit sequence identifier.
- `deliverAfter` *(number)* – Delay delivery by N milliseconds.
- `deliverAt` *(number)* – Deliver at the exact millisecond timestamp provided.
- `properties` *(object)* – Message-level properties; each key/value is forwarded with `--property`.

### Authentication (`options.authorization` or `options.auth`)

Provide an object with a `type` field plus the fields required by that mechanism:

- **OIDC / JWT** (`type: 'oidc'`)
	- `token` *(string)* – Raw JWT or path to a file containing the token.
	- `allowUnverified` *(boolean, default: false)* – Ignore JWT verification failures.
- **mTLS** (`type: 'mtls'`)
	- `certPath` *(string)* – Path to client certificate.
	- `keyPath` *(string)* – Path to client private key.
	- `caCert` *(string)* – Path to CA certificate bundle.
- **OAuth2 Client Credentials** (`type: 'oauth2'`)
	- `issuer` *(string)* – OAuth2 issuer / token URL.
	- `privateKey` *(string)* – Path to the service account private key.
	- `audience` *(string)* – Audience claim for issued tokens.
	- `clientId` *(string)* – OAuth2 client identifier.
- **Basic auth** (`type: 'basic'`)
	- `username` *(string)*
	- `password` *(string)*
- **Athenz** (`type: 'athenz'`)
	- `domain` *(string)*
	- `tenant` *(string)*
	- `service` *(string)*
	- `privateKey` *(string)* – Path to the Athenz service key.
	- `url` *(string)* – Athenz ZTS endpoint.
	- `proxy` *(string, optional)* – Proxy URL.
	- `keyId` *(string, optional)* – Key identifier header value.
	- `caCert` *(string, optional)* – Path to CA certificate bundle.

Any remaining properties in `options` are treated as message metadata. Authorization objects are removed before sending, so nested message data will not leak into the CLI invocation.

## Use Cases

This module is designed primarily for node apps/scripts that need to publish occassional messages.

A new connection is established for each message/batch sent (no connection pooling). Once the message(s) are sent, the connection is dropped. This is not ideal for platforms that send a constant stream of messages or need the absolute least possible latency. However; if you need to send <60 messages per minute, the latency is negligble (<1ms) and the connections are lightweight.

> The underlying go binary is structured as a standalone CLI. You could use it to easily/manually send messages from the console.