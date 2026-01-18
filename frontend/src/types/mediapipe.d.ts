// TypeScript type definitions for MediaPipe Face Detection (CDN-loaded)
// These are stub definitions since the actual library is loaded from CDN

declare module "@mediapipe/face_detection" {
  export class FaceDetection {
    constructor(config: { locateFile: (file: string) => string });
    setOptions(options: {
      model?: "short" | "full";
      minDetectionConfidence?: number;
    }): void;
    onResults(callback: (results: FaceDetectionResults) => void): void;
    send(inputs: { image: HTMLVideoElement | HTMLImageElement }): Promise<void>;
    close(): void;
  }

  export interface FaceDetectionResults {
    detections: Detection[];
    image: HTMLCanvasElement;
  }

  export interface Detection {
    boundingBox: {
      xCenter: number;
      yCenter: number;
      width: number;
      height: number;
      rotation: number;
    };
    landmarks: Array<{ x: number; y: number; z?: number }>;
    score: number;
  }
}

declare module "@mediapipe/camera_utils" {
  export class Camera {
    constructor(
      videoElement: HTMLVideoElement,
      options: {
        onFrame: () => Promise<void>;
        width?: number;
        height?: number;
      }
    );
    start(): Promise<void>;
    stop(): void;
  }
}
