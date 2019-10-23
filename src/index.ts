import { gzip } from "zlib"
import { hostname } from "os"
import { createSocket } from "dgram"
import { randomBytes } from "crypto"
import { promisify } from "util"

type Custom = { [key: string]: string | number | object | undefined }
type GelfMessage = {
  host?: string
  full_message?: string
  timestamp?: number
  level?: number
  facility?: string
  line?: number
  file?: string
  short_message?: string
  version?: string
} & Custom

interface Options {
  host: string
  port: number
  defaults?: Custom
}

export class Graylog {
  private host: string
  private port: number
  private defaults?: Custom

  private chunkSize = 8100
  private client = createSocket("udp4")
  private gelfKeys = new Set<string>()

  public static EMERGENCY = 0
  public static ALERT = 1
  public static CRITICAL = 2
  public static ERROR = 3
  public static WARNING = 4
  public static NOTICE = 5
  public static INFO = 6
  public static DEBUG = 7

  constructor(
    { host, port, defaults }: Options = { host: "localhost", port: 12201 }
  ) {
    this.host = host
    this.port = port
    this.defaults = defaults
    this.client.on("error", err => {
      console.error("@therockstorm/graylog socket error", err)
      this.close()
    })
    ;[
      "version",
      "host",
      "short_message",
      "full_message",
      "timestamp",
      "level",
      "facility",
      "line",
      "file"
    ].forEach(k => this.gelfKeys.add(k))
  }

  public send = async (msg: GelfMessage): Promise<void> => {
    await Promise.all(
      (await this.zipAndChunk(this.build(msg))).map(this.sendChunk)
    )
  }

  public close = (): void => this.client.close()

  private sendChunk = async (b: Buffer): Promise<void> =>
    new Promise((res, rej) =>
      this.client.send(b, 0, b.length, this.port, this.host, err =>
        err ? rej(err) : res()
      )
    )

  private build = (msg: GelfMessage): GelfMessage => {
    const m: GelfMessage = {
      host: hostname(),
      short_message: JSON.stringify(msg),
      timestamp: new Date().getTime() / 1000,
      version: "1.1",
      ...this.defaults
    }
    Object.keys(msg).forEach(
      k => (m[this.gelfKeys.has(k) && k !== "_id" ? k : `_${k}`] = msg[k])
    )

    return m
  }

  private zipAndChunk = async (msg: GelfMessage): Promise<Buffer[]> => {
    const buf = Buffer.from(JSON.stringify(msg))
    const data = (await promisify(gzip)(buf)) as Buffer
    if (data.length <= this.chunkSize) return [data]

    const total = Math.ceil(data.length / this.chunkSize)
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
  }
}
