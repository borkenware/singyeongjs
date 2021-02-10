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

export enum OpCode {
  HELLO = 0, // recv
  IDENTIFY = 1, // send
  READY = 2, // recv
  INVALID = 3, // recv
  DISPATCH = 4, // both
  HEARTBEAT = 5, // send
  HEARTBEAT_ACK = 6, // recv
  GOODBYE = 7, // recv
  ERROR = 8, // recv
}

export type DispatchEvent =
 | 'UPDATE_METADATA' // send
 | 'SEND' // both
 | 'BROADCAST' // both
 | 'QUERY_NODES' // send (warn)
 | 'QUEUE' // both
 | 'QUEUE_CONFIRM' // recv
 | 'QUEUE_REQUEST' // send
 | 'QUEUE_ACK' // send

export type Metadata = 
  | { type: 'string', value: string }
  | { type: 'integer', value: number }
  | { type: 'float', value: number }
  | { type: 'version', value: string }
  | { type: 'list', value: any[] }
  | { type: 'boolean', value: boolean }
  | { type: 'map', value: Record<string, any> }

export type MetadataType = Metadata['type']

export type PayloadData = {
  [OpCode.HELLO]: {
    heartbeat_interval: number
  }
  [OpCode.IDENTIFY]: {
    client_id: string
    application_id: string
    auth?: string
    ip?: string
    namespace?: string
  }
  [OpCode.READY]: {
    client_id: string
    restricted: boolean
  }
  [OpCode.INVALID]: {
    error: string
    extra_info?: null | any
    d?: any // [Cynthia] message_dispatcher.ex L38 seems to create a payload with a `d` attr?
  }
  [OpCode.HEARTBEAT]: {
    client_id: string
  }
  [OpCode.HEARTBEAT_ACK]: {
    client_id: string
  }
  [OpCode.GOODBYE]: {
    reason: string
  }
  [OpCode.ERROR]: {
    error: string
    extra_info?: null | any
  }
}

export type Payload = {
  op: OpCode
  d: any
  ts: number
  t: DispatchEvent | null
}
