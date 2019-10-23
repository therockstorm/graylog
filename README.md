# graylog

[![npm](https://img.shields.io/npm/v/@therockstorm/graylog.svg)](https://www.npmjs.com/package/@therockstorm/graylog)
[![Build Status](https://travis-ci.org/therockstorm/graylog.svg)](https://travis-ci.org/therockstorm/graylog)
[![license](https://img.shields.io/github/license/therockstorm/graylog.svg)]()

Tiny typed library to send compressed, chunked log messages to Graylog via GELF.

## Installing

```shell
npm install @therockstorm/graylog --save
```

## Usage

```javascript
import { Graylog } from "@therockstorm/graylog"

const log = new Graylog()
log.send({ short_message: "Hello, World." })
log.send({
  short_message: "Hello, World.",
  facility: "MyApp",
  level: Graylog.INFO
})

const configuredLog = new Graylog({
  host: "localhost",
  port: 12201,
  defaults: {
    facility: "MyApp",
    level: Graylog.INFO
  }
})
configuredLog.send({ short_message: "Hello, World." })
```

## License

MIT © [Rocky Warren](https://www.rocky.dev)
