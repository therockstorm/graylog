# graylog

[![npm](https://badgen.net/npm/v/@therockstorm/graylog)](https://www.npmjs.com/package/@therockstorm/graylog)
[![Build Status](https://travis-ci.org/therockstorm/graylog.svg?branch=master)](https://travis-ci.org/therockstorm/graylog)
[![MIT License](https://badgen.net/github/license/therockstorm/graylog)](https://github.com/therockstorm/graylog/blob/master/LICENSE)
[![Package Size](https://badgen.net/bundlephobia/minzip/@therockstorm/graylog)](https://bundlephobia.com/result?p=@therockstorm/graylog)

Tiny typed library to send compressed, chunked log messages to Graylog via GELF.

## Installing

```shell
npm install @therockstorm/graylog --save
```

## Usage

```javascript
import { Graylog, LogLevel } from "@therockstorm/graylog"
import { name } from "../package.json"

// Configure log to include project name at Info level
const log = new Graylog({
  host: "localhost", // default
  port: 12201, // default
  defaults: {
    host: name, // defaults to os.hostname()
    level: LogLevel.Alert, // default
    myCustomField: { hello: { there: "world" } }
  }
})

// Log logger errors to console
log.on("error", err => console.error("@therockstorm/graylog error", err))

const app = async (): Promise<void> => {
  log.info("Hello, info.")
  log.warning("Hello, warning.", { bugs: "bunny", facility: "MyApp" })
  log.error("Hello, error.", new Error("boom"))

  // Wait for messages to send and close Graylog connection
  await log.close()
}

app()
```

## License

MIT © [Rocky Warren](https://www.rocky.dev)
