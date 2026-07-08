import '@testing-library/jest-dom'

// Polyfill fetch for Node.js environment
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// WHATWG web classes for the jsdom environment: next/server (NextRequest/
// NextResponse) extends Request/Response at import time, and jsdom ships
// neither. Node's own fetch globals aren't injected into the jsdom sandbox,
// so pull the same implementations from undici.
if (typeof globalThis.ReadableStream === 'undefined') {
  const { ReadableStream, WritableStream, TransformStream } = require('node:stream/web')
  globalThis.ReadableStream = ReadableStream
  globalThis.WritableStream = WritableStream
  globalThis.TransformStream = TransformStream
}
// NOTE: deliberately NOT polyfilling MessageChannel/MessagePort from
// node:worker_threads — real worker_threads ports are active libuv handles
// that keep the process alive, and React's scheduler grabs MessageChannel
// when it exists (24 leaked ports = jest hanging at exit). Nothing in the
// suites needs a real port; scheduler falls back to setTimeout without it.
if (typeof globalThis.Request === 'undefined') {
  const { Request, Response, Headers, FormData, File } = require('undici')
  globalThis.Request = Request
  globalThis.Response = Response
  globalThis.Headers = Headers
  if (typeof globalThis.FormData === 'undefined') globalThis.FormData = FormData
  if (typeof globalThis.File === 'undefined') globalThis.File = File
}

// Mock fetch for tests
global.fetch = jest.fn()

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

// Mock window.scrollTo
Object.defineProperty(window, 'scrollTo', {
  writable: true,
  value: jest.fn(),
})

// Mock next/router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    }
  },
  useSearchParams() {
    return {
      get: jest.fn(() => null),
      getAll: jest.fn(() => []),
      has: jest.fn(() => false),
      keys: jest.fn(() => []),
      values: jest.fn(() => []),
      entries: jest.fn(() => []),
      forEach: jest.fn(),
      toString: jest.fn(() => ''),
    }
  },
  usePathname() {
    return '/'
  },
}))

// Suppress console errors during tests
const originalError = console.error
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})