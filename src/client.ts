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

import { URL } from 'url'
import WebSocket from 'ws'
import EventEmitter from './events.js'

const DSN_REGEX = /^s?singyeong:\/\/.+(:.+)?@[\w-]+(:\d{1,5})?\/?(\?encoding=(json|etf|msgpack))?$/

type ClientEvents = {
  connected: () => void // todo
  reconnected: () => void // todo
  disconnected: () => void // todo
  message: () => void // todo
  error: () => void // todo
}

export type SingyeongClientOptions = {
  clientId?: string
  auth?: string
  reconnect?: boolean
  tags?: string[]
}

export default class SingyeongClient extends EventEmitter<ClientEvents> {
  private readonly secure: boolean
  private readonly baseUrl: URL
  private isRestricted: boolean
  private ws: WebSocket

  public readonly applicationId: string
  public readonly clientId: string

  get url () {
    return this.baseUrl.href
  }

  get restricted () {
    return this.isRestricted
  }

  constructor (dsn: string, opts: SingyeongClientOptions) {
    super()

    if (!DSN_REGEX.test(dsn)) {
      throw new URIError('The provided DSN is not a valid singyeong DSN.')
    }

    this.baseUrl = new URL(dsn)
    this.secure = this.baseUrl.protocol === 'ssingyeong:'

    if (!opts.clientId) {
      // todo: generate one
    }
  }

  async connect (): Promise<void> {} // todo

  disconnect (): void {} // todo
}
