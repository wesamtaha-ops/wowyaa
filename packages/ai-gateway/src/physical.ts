/**
 * RESERVED (plan §21): post-MVP physical tile recognition. Interface only. P0 must not ship
 * a camera implementation, entitlement or runtime permission.
 */
export interface PhysicalTileRecognizer {
  initialize(manifestVersion: string): Promise<void>;
  recognizeFrame(frameHandle: unknown): Promise<{
    status: 'recognized' | 'uncertain' | 'unavailable';
    tiles: Array<{ tileId: string; x: number; y: number; confidence: number }>;
  }>;
  dispose(): Promise<void>;
}
