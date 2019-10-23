# graylog

[![npm](https://img.shields.io/npm/v/@therockstorm/graylog.svg)](https://www.npmjs.com/package/@therockstorm/graylog)
[![Build Status](https://travis-ci.org/therockstorm/graylog.svg)](https://travis-ci.org/therockstorm/graylog)
[![license](https://img.shields.io/github/license/therockstorm/graylog.svg)]()

Send Graylog GELF log messages.

## Installing

```shell
npm install @therockstorm/utils --save
```

## Usage

```javascript
import { Graylog } from "@therockstorm/Graylog"

var log = new Graylog()

log.send("Hello, World.")
log.send({
  short_message: "Hello, World.",
  facility: "MyApp",
  level: Graylog.INFO
})

var complexLog = Graylog({
  host: "localhost",
  port: 12201,
  facility: "MyApp",
  level: Graylog.INFO
})

complexLog.send("Hello, World.")
```

## License

MIT © [Rocky Warren](https://www.rocky.dev)
