/*
This file contains functions in order to caryy out size predictions, given 2 images
Assume that the 2 images are already taken, and that the
deepLab model (segmentation) and mnasNet (prediction) are already loaded somewhere
also assumes that tfjs is loaded in already
*/

// use tf.browser.fromPixels(canvas )

async function makeSilhouette(imageTensor, deepLabV3) {
  // Run segmentation
  console.log(imageTensor.dtype);
  console.log("PREDICTION: running segmentation...");
  //TODO Why is it failing here
  let result = await deepLabV3.segment(imageTensor);
  console.log("PREDICTION: segmentation successful!!!");

  // Convert segmentation map into tensor
  console.log(result.segmentationMap);
  let resultTensor = tf.tensor(Uint8Array.from(result.segmentationMap), [result.height, result.width, 4], "int32")
    .slice([0, 0, 0], [-1, -1, 3]);

  let r = resultTensor.slice([0, 0, 0], [-1, -1, 1]);
  let g = resultTensor.slice([0, 0, 1], [-1, -1, 1]);
  let b = resultTensor.slice([0, 0, 2], [-1, -1, 1]);

  let mask = r.equal(192).logicalAnd(g.equal(128)).logicalAnd(b.equal(128));
  mask = mask.cast("int32").mul(255);  // Convert to binary mask
  console.log("PREDICTION: make mask successful!!!");
  return mask;
}

function cropAndResizeSync(imgTensor) {
  const targetHeight = 640;
  const targetWidth = 480;
  //const targetWidth = 960;
  const resized = tf.image.resizeBilinear(imgTensor, [targetHeight, targetWidth]);
  return resized;
}


export async function predictSizes(
  frontImageTensor,
  sideImageTensor,
  heightCM,
  weightKG,
  //deepLabModel,
  //mnasNetModel,
) {
  /*
  function that takes in front and side image and returns the 13 measurements
  inputs:
  frontImageTensor: image tensor
  sideImageTensor: image tensor
  heightCM: int
  weightKG: int
  TODO
  These 2 below are models. Maybe find some way to load the models asynchronously
  through the worker threads. Or even port these functions over to be done by the workers
  //deepLabModel,
  //mnasNetModel,

  with loading and all it should take a total of 10 seconds to run

  output: length 13 tensor (converted to array)
  */
  console.log("PREDICTION: loading deeplab...");
  let deepLabV3 = null;
  try {
    deepLabV3 = await deeplab.load({ base: "pascal", quantizationBytes: 2 });
    console.log("PREDICTION: Deeplab loaded successfully");
  } catch (error) {
    console.error("PREDICTION: error loading deeplab: ", error);

  }
  console.log("PREDICTION: make silhouettes");
  let frontImageSilhouette = await makeSilhouette(frontImageTensor, deepLabV3);
  let sideImageSilhouette = await makeSilhouette(sideImageTensor, deepLabV3);
  //console.log("PREDICTION: check front img:", frontImageSilhouette);

  frontImageSilhouette = cropAndResizeSync(frontImageSilhouette);
  sideImageSilhouette = cropAndResizeSync(sideImageSilhouette);

  console.log("PREDICTION: start MNAS...");
  //const MNAS_URL = "./tf_models/jsModels/bmTest/model.json";
  const MNAS_URL = "https://huggingface.co/batmanBinSuparman/bmnet/resolve/main/bmTest/model.json"
  const mnasNet = await tf.loadGraphModel(MNAS_URL);
  console.log("PREDICTION: mnas loaded...");

  console.log("PREDICTION: check front img:", frontImageSilhouette);
  let combinedSilhouette = tf.concat([frontImageSilhouette, sideImageSilhouette], 1); // (640x960)
  combinedSilhouette = tf.concat(
    [
      tf.fill([640, 960, 1], weightKG),
      tf.fill([640, 960, 1], heightCM),
      combinedSilhouette
    ]
    , 2).expandDims(0); // add batch dimension

  console.log("PREDICTION: mnas inference...");
  const mnasResult = mnasNet.predict(combinedSilhouette).arraySync();
  return mnasResult;
}
