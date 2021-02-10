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
import Connection from './connection.js'
import { TypedEmitter } from 'tiny-typed-emitter'
import { OpCode, PayloadData } from './payload.js'

type ClientEvents = {
  ready: (restricted: boolean) => void
  message: () => void // todo
  close: () => void
  error: (e: Error) => void
}

type DSN = string | URL /* | Array<string | URL> */

export enum State {
  CONNECTING = 'connected',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DISCONNECTED = 'disconnected',
}

export type SingyeongOpts = {
  dsn: DSN
  authentication?: string
  proxiedIp?: string
  namespace?: string
  reconnect?: boolean
  checkServerIdentity?: (servername: string, cert: CertMeta) => boolean
}

export default class SingyeongClient extends TypedEmitter<ClientEvents> {
  private readonly dsn: URL /* | URL[] */
  private readonly opts: SingyeongOpts
  private connection?: Connection
  private heartbeatTimer?: NodeJS.Timeout
  private heartbeatAck: boolean
  private state: State

  public readonly applicationId: string
  public readonly clientId: string
  public websocketUrl?: URL
  public isRestricted: boolean

  get isConnected () {
    return this.connection?.isConnected ?? false
  }

  get isConnecting () {
    return this.connection?.isConnecting ?? false
  }

  get ping () {
    return this.connection?.ping ?? -1
  }

  // todo: accept a pool of dsn for load balancing
  constructor (opts: DSN | SingyeongOpts) {
    super()

    if (typeof opts !== 'object' || !('dsn' in opts)) opts = { dsn: opts }
    this.opts = opts

    // todo: validate dsn arrays
    this.dsn = typeof opts.dsn === 'string' ? new URL(opts.dsn) : opts.dsn
  
    if (this.dsn.protocol !== 'singyeong:' && this.dsn.protocol !== 'ssingyeong:') {
      throw new URIError('Invalid DSN: The protocol must be singyeong or ssingyeong.')
    }
  
    if (!this.dsn.username) {
      throw new URIError('Invalid DSN: You mst specify a username. This represents your application ID on singyeong.')
    }

    this.applicationId = this.dsn.username
    this.clientId = this.generateClientId() // todo: allow the user to set their own client id?

    this.heartbeatAck = true
    this.isRestricted = false
    this.state = State.DISCONNECTED
  }

  connect (): void { // todo: connect as soon as the Client is initialized?
    if (this.state === State.CONNECTED) throw new Error('Already connected!')
    if (this.state !== State.RECONNECTING) this.state = State.CONNECTING
    this.connection?.close()

    const dsn = this.getRandomDsn()
    this.websocketUrl = new URL(`${dsn.protocol === 'ssingyeong:' ? 'wss' : 'ws'}://${dsn.hostname}:${dsn.port ?? 80}/gateway/websocket?encoding=json`)
    this.connection = new Connection({
      url: this.websocketUrl,
      encoding: 'json',
      checkServerIdentity: this.opts.checkServerIdentity
    })

    this.connection.once('hello', (d) => this.handleHello(d))
    this.connection.once('ready', (d) => this.handleReady(d))
    this.connection.on('heartbeatAck', () => this.handleHeartbeatAck())
    this.connection.on('goodbye', () => this.handleGoodbye())
    this.connection.on('dispatch', (d, t) => this.handleDispatch(d, t))

    this.connection.once('close', () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
      if (this.state !== State.RECONNECTING) {
        this.state = State.DISCONNECTED
        this.emit('close')
      }
    })
  }

  disconnect (): void {
    if (!this.connection || !this.isConnected) throw new Error('Not connected!')
    this.connection.close()
  }

  private reconnect () {
    this.state = State.RECONNECTING
    this.connect()

    // todo: if reconnect failed, try again
  }

  private handleHello (payload: PayloadData[OpCode.HELLO]) {
    this.heartbeatTimer = setInterval(() => this.heartbeat(), payload.heartbeat_interval)
    this.connection!.send(OpCode.IDENTIFY, {
      client_id: this.clientId,
      application_id: this.applicationId,
      auth: this.opts.authentication,
      ip: this.opts.proxiedIp,
      namespace: this.opts.namespace,
    })
  }

  private handleReady (payload: PayloadData[OpCode.READY]) {
    this.state = State.CONNECTED
    this.isRestricted = payload.restricted
    this.emit('ready', payload.restricted)
  }

  private handleHeartbeatAck () {
    this.heartbeatAck = true
  }

  private handleGoodbye () {
    this.reconnect()
  }

  private handleDispatch (payload: any, event: string) {
    console.log(payload, event)
  }

  private heartbeat (): void {
    if (!this.heartbeatAck) {
      // todo: try reconnecting?
      this.disconnect()
      return
    }

    this.heartbeatAck = false
    this.connection?.send(OpCode.HEARTBEAT, { client_id: this.clientId })
  }

  private getRandomDsn (): URL {
    if (Array.isArray(this.dsn)) {
      return this.dsn[Math.floor(Math.random() * this.dsn.length)]
    }
    return this.dsn
  }

  private generateClientId () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }
}
