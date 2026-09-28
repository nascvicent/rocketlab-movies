import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// O jsdom não implementa rolagem; as páginas chamam scrollTo ao navegar.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo

afterEach(() => cleanup())
