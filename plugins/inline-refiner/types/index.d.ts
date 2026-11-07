export type Change = { from: string; to: string }

declare module 'claude-code' {
  interface PluginState {
    // One list of changes per refined message, newest first. Messages that
    // needed no fixes are not kept.
    //
    // `queued` remembers queued messages already refined (your words -> refined
    // words), so a reload or a rebuilt request never refines or lists one twice.
    'inline-refiner': { messages: Shaped<Change[][]>; queued: Shaped<Record<string, string>> }
  }
}
