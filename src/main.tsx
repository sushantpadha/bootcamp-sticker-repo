import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppRoot } from './ui/AppRoot'
import { engine, initAsync } from './bootstrap/composition'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppRoot engine={engine} />
  </StrictMode>,
)

initAsync().catch((err: unknown) => {
  console.error('[stickerdb] Failed to initialize database:', err);
});
