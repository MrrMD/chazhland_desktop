// Всё env-driven (12-factor). MOCK по умолчанию включён — приложение запускается без живого бэка.
const env = import.meta.env

export const API_BASE: string = (env.VITE_API_BASE as string) || 'http://localhost:8080'
export const WS_URL: string =
  (env.VITE_WS_URL as string) || API_BASE.replace(/^http/, 'ws') + '/ws'

/** mock-режим: данные берутся из src/mocks. Выключить — VITE_MOCK=false при живом бэке. */
export const MOCK: boolean = (env.VITE_MOCK as string) !== 'false'
