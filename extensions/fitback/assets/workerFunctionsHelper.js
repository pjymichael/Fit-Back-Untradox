// workerFunctions.js
let workerInstance = null;

/**
 * Set the worker instance for these functions.
 * @param {Worker} worker - The tf1Worker instance.
 */
function setWorkerInstance(worker) {
  workerInstance = worker;
}

/**
 * Requests the worker's TFJS version.
 */
function requestVersion() {
  if (!workerInstance) throw new Error("Worker instance not set");
  workerInstance.postMessage({ command: "version" });
}

/**
 * Loads the model into the worker.
 * @param {string} modelURL - URL to model.json.
 * @param {string} metadataURL - URL to metadata.json.
 */
function loadModel(modelURL, metadataURL) {
  if (!workerInstance) throw new Error("Worker instance not set");
  console.log("Main thread: Loading model with", modelURL, metadataURL);
  workerInstance.postMessage({
    command: "LOAD_MODEL",
    data: { modelURL, metadataURL },
  });
}

/**
 * Sends an image frame to the worker for classification.
 * @param {number} width - The width of the frame.
 * @param {number} height - The height of the frame.
 * @param {ArrayBuffer} buffer - The RGBA pixel buffer.
 * @returns {Promise<Object>} - Resolves with classification result.
 */
function classifyFrame(width, height, buffer) {
  if (!workerInstance) throw new Error("Worker instance not set");
  return new Promise((resolve) => {
    const handleMessage = (event) => {
      if (event.data.type === "classification") {
        resolve(event.data);
        workerInstance.removeEventListener("message", handleMessage);
      }
    };
    workerInstance.addEventListener("message", handleMessage);
    workerInstance.postMessage({
      command: "CLASSIFY_FRAME",
      data: { width, height, buffer },
    });
  });
}

/**
 * Example function that gets image data from a canvas and asks the worker to classify it.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 */
/**
 * Gets image data from a canvas and asks the worker to classify it.
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @returns {Promise<Object>} Object containing poseName and poseConfidence.
 */

export { setWorkerInstance, requestVersion, loadModel, classifyFrame };
