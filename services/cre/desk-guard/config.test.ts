import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { z } from "zod"
import { configSchema } from "./main"

// The CRE WASM engine has no global URL constructor. Bun does, so the rest of the suite never noticed that
// zod's z.string().url() depends on it. These tests remove URL to reproduce the engine.
function withoutUrl<T>(fn: () => T): T {
  const saved = globalThis.URL
  Reflect.deleteProperty(globalThis, "URL")
  try {
    return fn()
  } finally {
    globalThis.URL = saved
  }
}

const read = (name: string) => JSON.parse(readFileSync(`${import.meta.dir}/${name}`, "utf8"))

describe("config validation in a runtime without URL (CRE WASM engine)", () => {
  test("root cause: zod url() rejects a valid URL once URL is gone", () => {
    const result = withoutUrl(() => z.string().url().safeParse("https://api.coinbase.com/v2/prices/USDT-USDC/spot"))
    expect(result.success).toBe(false)
  })

  test("committed configs parse without URL", () => {
    const example = read("config.example.json")
    const sepolia = read("config.unichain-sepolia.json")
    withoutUrl(() => {
      expect(configSchema.safeParse(example).success).toBe(true)
      expect(configSchema.safeParse(sepolia).success).toBe(true)
    })
  })

  test("source urls must still be https", () => {
    const base = read("config.example.json")
    const withUrl = (url: string) => ({ ...base, sources: [{ ...base.sources[0], url }] })
    withoutUrl(() => {
      expect(configSchema.safeParse(withUrl("http://api.coinbase.com/x")).success).toBe(false)
      expect(configSchema.safeParse(withUrl("not a url")).success).toBe(false)
      expect(configSchema.safeParse(withUrl("https://")).success).toBe(false)
      expect(configSchema.safeParse(withUrl("https://api.kraken.com/0/public/Ticker?pair=USDCUSDT")).success).toBe(true)
    })
  })
})
