/*
 * Copyright (c) 2021 Borkenware, All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 * 3. Neither the name of the copyright holder nor the names of its contributors
 *    may be used to endorse or promote products derived from this software without
 *    specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

import type { CertMeta } from 'ws'
import type { Payload, PayloadData } from './payload.js'

import { URL } from 'url'
import WebSocket from 'ws'
import { TypedEmitter } from 'tiny-typed-emitter'
import { OpCode } from './payload.js'

type SocketEvents = {
  hello: (payload: PayloadData[OpCode.HELLO]) => void
  ready: (payload: PayloadData[OpCode.READY]) => void
  dispatch: (payload: Record<string, any>, evt: string) => void
  heartbeatAck: (payload: PayloadData[OpCode.HEARTBEAT_ACK]) => void
  goodbye: (payload: PayloadData[OpCode.GOODBYE]) => void
  error: (e: Error) => void
  close: () => void
}

export type ConnectionEncoding = 'json' | 'msgpack' // todo: etf?

export type SocketOpts = {
  url: URL
  encoding: ConnectionEncoding
  checkServerIdentity?: (servername: string, cert: CertMeta) => boolean
}

export default class SingyeongSocket extends TypedEmitter<SocketEvents> {
  private readonly ws: WebSocket
  private pings: number[]

  get isConnected () {
    return this.ws.readyState === WebSocket.OPEN
  }

  get isConnecting () {
    return this.ws.readyState === WebSocket.CONNECTING
  }

  get ping () {
    return this.isConnected
      ? this.pings.reduce((a, b) => a + b, 0) / this.pings.length
      : -1
  }

  constructor (private readonly opts: SocketOpts) {
    super()

    this.ws = new WebSocket(this.opts.url, { checkServerIdentity: opts.checkServerIdentity })
    this.ws.on('message', (msg) => this.handleMessage(msg))
    this.ws.on('error', (e) => this.emit('error', e))
    this.ws.on('close', () => this.emit('close'))
    this.pings = Array(5).fill(0)
  }

  send (op: OpCode, data: PayloadData[keyof PayloadData], evt?: string): void {
    // todo: msgpack
    this.ws.send(
      JSON.stringify({
        op: op,
        d: data,
        ts: Date.now(),
        t: evt,
      })
    )
  }

  close (code?: number, data?: string): void {
    return this.ws.close(code, data)
  }

  private handleMessage (msg: WebSocket.Data) {
    // todo: msgpack, validate payload
    if (typeof msg !== 'string') {
      this.emit('error', new Error('Received binary data, expected string'))
      return
    }

    const payload = JSON.parse(msg) as Payload
    this.pings.push(Date.now() - payload.ts)
    this.pings.shift()

    switch (payload.op) {
      case OpCode.HELLO:
        this.emit('hello', payload.d)
        break
      case OpCode.READY:
        this.emit('ready', payload.d)
        break
      case OpCode.DISPATCH:
        this.emit('dispatch', payload.d, payload.t!)
        break
      case OpCode.HEARTBEAT_ACK:
        this.emit('heartbeatAck', payload.d)
        break
      case OpCode.GOODBYE:
        this.emit('goodbye', payload.d)
        break
      case OpCode.INVALID:
      case OpCode.ERROR:
        this.emit('error', new Error(`Singyeong server raised an error: ${payload.d.error}`))
        break
      default:
        this.emit('error', new Error(`Received an unexpected payload: unrecognized OP code ${payload.op}`))
        this.close()
        break
    }    
  }
}
