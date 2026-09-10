'use client';

/** Lifts the uploaded frame's analysis from ingestion into the pipeline run. */

import { useState } from 'react';
import VisionIngest from './VisionIngest';
import PipelineConsole from './PipelineConsole';

export default function OperationsConsole({ zones, shape, reasoningLive }) {
  const [visionResult, setVisionResult] = useState(null);

  return (
    <>
      <VisionIngest onResult={setVisionResult} />
      <PipelineConsole zones={zones} shape={shape} reasoningLive={reasoningLive} visionResult={visionResult} />
    </>
  );
}
