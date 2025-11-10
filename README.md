# @pulsar-js/producer

`@pulsar-js/producer` provides a simple way to send messages to Apache Pulsar topics from Node.js.

_Isn't there already an official module for this?_

Yes, but it's hard to use. The [official pulsar node client](https://www.npmjs.com/package/pulsar-client) is a C++ addon requiring a build step. This means a C++ compiler and node-gyp are prerequisites. This can be a barrier to entry for systems that just want to publish messages from your own systems.

_How does `@pulsar-js/producer` simplify my life?_

This module ships with the appropriate pre-built binary, similar to how tools like [esbuild](https://esbuild.io) are installed. The native binary is written in Go, leveraging the [official Pulsar Go package](https://pkg.go.dev/github.com/apache/pulsar-client-go). Instead of compiling, `@pulsar-js/producer` downloads the right binary for your OS during install/update.

## Installation

`npm install @pulsar-js/producer -S`

## Usage

```js
import publish from '@pulsar-js/producer'

await publish('pulsar://my_server:5678/persistent/namespace/topic', message/*, options*/)
```

The connection string accepts `pulsar://` or `pulsar+ssl://` protocols. The syntax is `protocol://server:port/[non-]persistent/namespace/topic`

## Options

This module accepts several authentication options.

## Use Cases

This module is designed primarily for node apps/scripts that need to publish occassional messages.

A new connection is established for each message/batch sent (no connection pooling). Once the message(s) are sent, the connection is dropped. This is not ideal for platforms that send a constant stream of messages or need the absolute least possible latency. However; if you need to send <60 messages per minute, the latency is negligble (<1ms) and the connections are lightweight.

> The underlying go binary is structured as a standalone CLI. You could use it to easily/manually send messages from the console.