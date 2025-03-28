/**
 * Initializes TensorFlow and the pose detection model.
 * In your case, it creates a MoveNet (or PoseNet) detector.
 * @returns {Promise<Object>} detector - The initialized pose detector.
 */
export async function initializePoseDetector() {
  await tf.ready();
  await tf.setBackend("webgl");
  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    }
  );
  console.log("Pose detector has been initialized:", detector);
  return detector;
}

/**
 * Estimates poses from the given video element using the provided detector.
 * @param {Object} detector - The initialized pose detector.
 * @param {HTMLVideoElement} video - The video element to analyze.
 * @returns {Promise<Array>} - An array of detected poses.
 */
export async function estimatePoses(detector, video) {
  try {
    // console.log("Detector is estimating poses...", detector);
    const poses = await detector.estimatePoses(video, {
      flipHorizontal: false,
    });
    return poses;
  } catch (error) {
    console.error("Error during pose estimation:", error);
    throw error;
  }
}
