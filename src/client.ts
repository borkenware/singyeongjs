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

type ClientEvents = {
  connected: (restricted: boolean) => void
  reconnected: () => void // todo
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
  private encoding: 'json'
  private ws?: WebSocket
  private pings: number[]

  public readonly applicationId: string
  public readonly clientId: string
  public readonly websocketUrl: URL
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

    // todo: support msgpack encoding (and maybe etf?)
    // - etf is non-restricted only, and performs very poorly on js (even using native bindings like Discord's erlpack).
    // - unsure if it's worth the effort here (except maybe to reduce stress on singyeong because erlang is good at (de)serializing etf?)
    this.encoding = 'json'
    this.websocketUrl = new URL(`${this.secure ? 'wss' : 'ws'}://${this.dsn.hostname}:${this.dsn.port ?? 80}/gateway/websocket?encoding=${this.encoding}`)
    this.opts = opts

    this.isRestricted = false
    this.pings = []
  }

  connect (): void {
    if (this.isConnected || this.isConnecting) throw new Error('Already connected!')
    this.createSocket()
  }

  disconnect (): void {
    if (!this.isConnected) throw new Error('Not connected!')
    this.ws?.close()
  }

  private createSocket () {
    this.pings = Array(5).fill(0)
    this.ws = new WebSocket(this.websocketUrl, { checkServerIdentity: this.opts.checkServerIdentity })
    this.ws.on('message', (msg) => this.handleMessage(msg))

    this.ws.on('close', () => {
      // todo: reconnect
      // todo: don't emit if closure was expected (e.g. singyeong requested reconnect)
      this.emit('close')
    })
    this.ws.on('error', (e) => this.emit('error', e))
  }

  private handleMessage (msg: WebSocket.Data) {
    // todo: proper de-serialization based on the format
    if (typeof msg !== 'string') {
      this.emit('error', new Error('Received binary data, expected string'))
      this.disconnect()
      return
    }

    const payload = JSON.parse(msg)
    this.pings.push(Date.now() - payload.ts)
    this.pings.shift()

    switch (payload.op) {
      default:
        this.emit('error', new Error(`Received an unexpected payload: unrecognized OP code ${payload.op}`))
        this.disconnect()
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
