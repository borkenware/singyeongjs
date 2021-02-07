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

import EventEmitter from 'events'

type Events = Record<string | symbol, (...args: any[]) => void>

declare interface TypedEventEmitter<T extends Events> extends EventEmitter {
  emit: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, ...args: Parameters<T[TEvent]>) => boolean

  on: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, callback: T[TEvent]) => this
  once: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, callback: T[TEvent]) => this
  addListener: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, callback: T[TEvent]) => this
  prependListener: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, callback: T[TEvent]) => this
  prependOnceListener: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, callback: T[TEvent]) => this

  off: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, callback: T[TEvent]) => this
  removeListener: <TEvent extends Extract<keyof T, string | symbol>>(evt: TEvent, callback: T[TEvent]) => this
  removeAllListeners: (evt: Extract<keyof T, string | symbol>) => this

  getMaxListeners (): number
  setMaxListeners (n: number): this

  listeners: (evt: Extract<keyof T, string | symbol>) => Function[]
  rawListeners: (evt: Extract<keyof T, string | symbol>) => Function[]
  listenerCount: (evt: Extract<keyof T, string | symbol>) => number
  eventNames (): Array<Extract<keyof T, string | symbol>>
}

class TypedEventEmitter<T extends Events> extends EventEmitter {}

export default TypedEventEmitter
