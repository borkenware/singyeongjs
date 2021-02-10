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
import { URL } from 'url'
import WebSocket from 'ws'
import EventEmitter from './events.js'
import { OpCode } from './payload.js'

type ClientEvents = {
  ready: (restricted: boolean) => void
  message: () => void // todo
  close: () => void
  error: (e: Error) => void
}

export type SingyeongOpts = {
  reconnect?: boolean
  checkServerIdentity?: (servername: string, cert: CertMeta) => boolean
}

export default class SingyeongClient extends EventEmitter<ClientEvents> {
  private readonly secure: boolean
  private readonly dsn: URL
  private readonly opts: SingyeongOpts
  // @ts-ignore
  private encoding: 'json'
  private ws?: WebSocket
  private pings: number[]
  private heartbeatTimer?: NodeJS.Timeout
  private heartbeatAck: boolean

  public readonly applicationId: string
  public readonly clientId: string
  public websocketUrl: URL
  public isRestricted: boolean

  get isConnected () {
    return this.ws?.readyState === WebSocket.OPEN
  }

  get isConnecting () {
    return this.ws?.readyState === WebSocket.CONNECTING
  }

  get ping () {
    if (!this.isConnected) {
      return 0
    }

    return this.pings.reduce((a, b) => a + b, 0) / this.pings.length
  }

  // todo: accept a pool of dsn for load balancing
  constructor (dsn: string, opts: SingyeongOpts = {}) {
    super()

    this.dsn = new URL(dsn)
    if (this.dsn.protocol !== 'singyeong:' && this.dsn.protocol !== 'ssingyeong:') {
      throw new URIError('Invalid DSN: The protocol must be singyeong or ssingyeong.')
    }
  
    if (!this.dsn.username) {
      throw new URIError('Invalid DSN: You mst specify a username. This represents your application ID on singyeong.')
    }

    this.secure = this.dsn.protocol === 'ssingyeong:'
    this.applicationId = this.dsn.username
    this.clientId = this.generateClientId() // todo: allow the user to set their own client id?

    // todo: support msgpack encoding
    this.encoding = 'json'
    this.websocketUrl = new URL(`${this.secure ? 'wss' : 'ws'}://${this.dsn.hostname}:${this.dsn.port ?? 80}/gateway/websocket?encoding=json`)
    this.opts = opts

    this.pings = []
    this.isRestricted = false
    this.heartbeatAck = false
  }

  connect (): void {
    if (this.isConnected || this.isConnecting) throw new Error('Already connected!')
    this.createSocket()
  }

  disconnect (): void {
    if (!this.ws || !this.isConnected) throw new Error('Not connected!')
    this.ws.close()
  }

  private createSocket () {
    this.pings = Array(5).fill(0)
    this.ws = new WebSocket(this.websocketUrl, { checkServerIdentity: this.opts.checkServerIdentity })
    this.ws.on('message', (msg) => this.handleMessage(msg))

    this.ws.on('close', () => {
      if (this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer)
      }

      // todo: reconnect
      this.emit('close')
    })
    this.ws.on('error', (e) => this.emit('error', e))
  }

  private send (op: OpCode, data: unknown, evt?: string): void {
    // todo: handle msgpack
    if (!this.ws || !this.isConnected) throw new Error('Not connected!') // todo: queue if we're reconnecting
    this.ws.send(JSON.stringify({
      op: op,
      d: data,
      ts: Date.now(),
      t: evt
    }))
  }

  private sendIdentify (): void {
    this.send(OpCode.IDENTIFY, { client_id: this.clientId, application_id: this.applicationId })
  }

  private sendHeartbeat (): void {
    if (!this.heartbeatAck) {
      // todo: try reconnecting?
      this.disconnect()
      return
    }

    this.heartbeatAck = false
    this.send(OpCode.HEARTBEAT, { client_id: this.clientId })
  }

  private handleMessage (msg: WebSocket.Data) {
    // todo: handle msgpack
    if (typeof msg !== 'string') {
      this.emit('error', new Error('Received binary data, expected string'))
      this.disconnect()
      return
    }

    const payload = JSON.parse(msg)
    this.pings.push(Date.now() - payload.ts)
    this.pings.shift()

    console.log(payload)
    switch (payload.op) {
      case OpCode.HELLO:
        this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), payload.d.heartbeat_interval)
        this.heartbeatAck = true
        this.sendIdentify()
        break
      case OpCode.READY:
        // todo: if this is a reconnect, don't re-emit READY and restore metadata
        this.isRestricted = payload.d.restricted
        this.emit('ready', payload.d.restricted)
        break
      case OpCode.INVALID:
        this.emit('error', new Error(`Singyeong server raised an error: ${payload.d.error}`))
        break
      case OpCode.DISPATCH:
        break
      case OpCode.HEARTBEAT_ACK:
        // todo: check if the client_id matches?
        this.heartbeatAck = true
        break
      case OpCode.GOODBYE:
        this.ws?.removeAllListeners('close') // Avoid emitting 'close' event
        this.ws?.close()
        this.createSocket()
        break
      case OpCode.ERROR:
        this.emit('error', new Error(`Singyeong server raised an unrecoverable error: ${payload.d.error}`))
        // todo: singyeong will always abort the connection for this class of error. should we try to automatically reconnect?
        break
      default:
        this.emit('error', new Error(`Received an unexpected payload: unrecognized OP code ${payload.op}`))
        this.disconnect()
        break
    }    
  }

  private generateClientId () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}
