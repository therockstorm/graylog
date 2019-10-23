import { gzip } from "zlib"
import { hostname } from "os"
import { createSocket } from "dgram"
import { randomBytes } from "crypto"
import { promisify } from "util"
import { EventEmitter } from "events"

// See https://docs.graylog.org/en/3.1/pages/gelf.html#gelf-payload-specification
export enum LogLevel {
  Emergency = 0,
  Alert = 1,
  Critical = 2,
  Error = 3,
  Warning = 4,
  Notice = 5,
  Info = 6,
  Debug = 7
}
export type GelfMessage = {
  host?: string
  full_message?: string
  timestamp?: number
  level?: LogLevel
  short_message?: string
  version?: string
} & CustomMap
export type Custom = string | number | object | undefined
export type CustomMap = { [key: string]: Custom }
export interface Options {
  host: string
  port: number
  defaults?: CustomMap
}

export class Graylog extends EventEmitter {
  private host: string
  private port: number
  private defaults?: CustomMap
  private chunkSize = 1400
  private sends = 0
  private client = createSocket("udp4")
  private gelfKeys = new Set<string>([
    "version",
    "host",
    "short_message",
    "full_message",
    "timestamp",
    "level",
    "facility",
    "line",
    "file"
  ])

  constructor(
    { host, port, defaults }: Options = { host: "localhost", port: 12201 }
  ) {
    super()
    this.host = host
    this.port = port
    this.defaults = this.format(defaults)
    this.client.on("error", err => {
      this.emit("error", err)
      this.close()
    })
  }

  public debug = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Debug, additional)

  public info = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Info, additional)

  public notice = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Notice, additional)

  public warning = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Warning, additional)

  public error = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Error, additional)

  public critical = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Critical, additional)

  public alert = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Alert, additional)

  public emergency = async (
    short: string,
    additional?: CustomMap | Error
  ): Promise<void> => this.log(short, LogLevel.Emergency, additional)

  public close = async (): Promise<void> => {
    const done = (): void => {
      this.client.close()
      this.client.removeAllListeners()
    }

    return this.sends <= 0
      ? done()
      : await new Promise(res => this.once("done", () => res(done())))
  }

  private log = async (
    short: string,
    level: LogLevel,
    additional?: CustomMap | Error
  ): Promise<void> => {
    this.send({
      short_message: short,
      level: level,
      ...(additional instanceof Error
        ? this.parseError(additional)
        : additional)
    })
  }

  private parseError = (err: Error): GelfMessage => {
    const msg = err.message
    const stack = err.stack
    delete err.message
    delete err.stack
    return {
      errorMessage: msg,
      errorStack: stack,
      full_message: Object.keys(err).length ? this.stringify(err) : undefined
    }
  }

  private send = async (msg: GelfMessage): Promise<void> => {
    this.sends++
    await Promise.all(
      (await this.zipAndChunk(this.build(msg))).map(this.sendChunk)
    )
    this.sends--
    if (this.sends <= 0) this.emit("done")
  }

  private sendChunk = async (b: Buffer): Promise<void> =>
    new Promise((res, rej) =>
      this.client.send(b, 0, b.length, this.port, this.host, err =>
        err ? rej(err) : res()
      )
    )

  private build = (msg: GelfMessage): GelfMessage => ({
    host: hostname(),
    level: LogLevel.Alert,
    short_message: this.stringify(msg),
    timestamp: new Date().getTime() / 1000,
    version: "1.1",
    ...this.defaults,
    ...this.format(msg)
  })

  private format = (msg?: CustomMap): CustomMap => {
    const c: CustomMap = {}
    if (!msg) return c

    Object.keys(msg).forEach(key => {
      const k = this.gelfKeys.has(key) || key.startsWith("_") ? key : `_${key}`
      const val = msg[key]
      c[k === "_id" ? `_${k}` : k] = this.stringify(val)
    })
    return c
  }

  private stringify = (val: Custom): string =>
    val instanceof Error
      ? JSON.stringify(val, Object.getOwnPropertyNames(val))
      : typeof val === "string"
      ? val
      : JSON.stringify(val)

  private zipAndChunk = async (msg: GelfMessage): Promise<Buffer[]> => {
    try {
      const buf = Buffer.from(this.stringify(msg))
      const data = (await promisify(gzip)(buf)) as Buffer
      if (data.length <= this.chunkSize) return [data]

      // See https://docs.graylog.org/en/3.1/pages/gelf.html#chunking
      const total = Math.ceil(data.length / this.chunkSize)
      if (total > 128) {
        this.emit("error", "Cannot log messages larger than 128 chunks.")
        return []
      }

      const msgId = [0x1e, 0x0f].concat(...randomBytes(8))
      return [...Array(total).keys()].map(k => {
        const dataStart = k * this.chunkSize
        return Buffer.from(
          msgId.concat(
            k,
            total,
            ...data.slice(dataStart, dataStart + this.chunkSize)
          )
        )
      })
    } catch (err) {
      this.emit("error", err)
      return []
    }
  }
}
