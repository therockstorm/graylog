import { gzip, InputType } from "zlib"
import { hostname } from "os"
import { createSocket, Socket } from "dgram"
import { randomBytes } from "crypto"
import { promisify } from "util"

const gzipProm: (buf: InputType) => Promise<Buffer> = promisify(gzip)

const gelfId = [0x1e, 0x0f]
const reservedKeys = new Set<string>()
reservedKeys.add("version")
reservedKeys.add("host")
reservedKeys.add("short_message")
reservedKeys.add("full_message")
reservedKeys.add("timestamp")
reservedKeys.add("level")
reservedKeys.add("facility")
reservedKeys.add("line")
reservedKeys.add("file")

type Func = (...args: unknown[]) => unknown
type Defaults = { [key: string]: string | number | object | undefined | Func }

interface Options {
  host: string
  port: number
  defaults?: Defaults
}

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
} & Defaults

export class Graylog {
  private host: string
  private port: number
  private defaults?: Defaults
  private client: Socket

  public static EMERGENCY = 0
  public static ALERT = 1
  public static CRITICAL = 2
  public static ERROR = 3
  public static WARNING = 4
  public static NOTICE = 5
  public static INFO = 6
  public static DEBUG = 7

  constructor(
    { host, port, defaults }: Options = {
      host: "localhost",
      port: 12201
    }
  ) {
    this.host = host
    this.port = port
    this.defaults = defaults

    this.client = createSocket("udp4")
    this.client.on("error", err => {
      console.error("Graylog socket error", err)
      this.close()
    })
  }

  public send = async (msg: GelfMessage): Promise<void> => {
    await Promise.all(
      (await this.zipAndChunk(this.build(msg))).map(this.sendBuffer)
    )
  }

  public close = (): void => this.client.close()

  private sendBuffer = async (b: Buffer): Promise<void> =>
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
      k => (m[reservedKeys.has(k) && k !== "_id" ? k : `_${k}`] = msg[k])
    )

    return m
  }

  private zipAndChunk = async (msg: GelfMessage): Promise<Buffer[]> => {
    const chunkSize = 10
    const data = await gzipProm(Buffer.from(JSON.stringify(msg)))
    console.log("GRAYLOG", data.length, chunkSize)
    if (data.length <= chunkSize) return [data]

    const num = Math.ceil(data.length / chunkSize)
    console.log("GRAYLOG", num)
    const chunks = new Array(num)
    const id = [].slice.call(randomBytes(8))
    for (let i = 0; i < num; i++) {
      const dataStart = i * chunkSize
      chunks[i] = Buffer.from(
        gelfId.concat(
          id,
          i,
          num,
          [].slice.call(data, dataStart, dataStart + chunkSize)
        )
      )
    }

    return chunks
  }
}
