/*
This file contains functions in order to caryy out size predictions, given 2 images
Assume that the 2 images are already taken, and that the
deepLab model (segmentation) and mnasNet (prediction) are already loaded somewhere
also assumes that tfjs is loaded in already
*/

// use tf.browser.fromPixels(canvas )


// yolo segmentation
const preprocess = (img, modelWidth, modelHeight) => {
  let xRatio, yRatio; // ratios for boxes

  const input = tf.tidy(() => {
    //const img = tf.browser.fromPixels(source);

    // padding image to square => [n, m] to [n, n], n > m
    const [h, w] = img.shape.slice(0, 2); // get source width and height
    const maxSize = Math.max(w, h); // get max size
    const imgPadded = img.pad([
      [0, maxSize - h], // padding y [bottom only]
      [0, maxSize - w], // padding x [right only]
      [0, 0],
    ]);

    xRatio = maxSize / w; // update xRatio
    yRatio = maxSize / h; // update yRatio

    return tf.image
      .resizeBilinear(imgPadded, [modelWidth, modelHeight]) // resize frame
      .div(255.0) // normalize
      .expandDims(0); // add batch
  });

  return [input, xRatio, yRatio];
};

const numClass = 80;
const PERSON_CLASS_INDEX = 0;

async function makeSilhouette(imageTensor, model) {
  const [modelHeight, modelWidth] = model.inputs[0].shape.slice(1, 3);
  const [input, xRatio, yRatio] = preprocess(imageTensor, modelHeight, modelWidth);

  const [res0, res1] = model.execute(input);
  const transRes = tf.tidy(() => res0.transpose([0, 2, 1]).squeeze());
  const transSegMask = tf.tidy(() => res1.transpose([0, 3, 1, 2]).squeeze());
  tf.dispose([res0, res1, input]);

  const boxes = tf.tidy(() => {
    const [x, y, w, h] = [0, 1, 2, 3].map(i => transRes.slice([0, i], [-1, 1]));
    const x1 = tf.sub(x, tf.div(w, 2));
    const y1 = tf.sub(y, tf.div(h, 2));
    const x2 = tf.add(x1, w);
    const y2 = tf.add(y1, h);
    return tf.concat([y1, x1, y2, x2], 1).squeeze();
  });

  const [scores, classes] = tf.tidy(() => {
    const rawScores = transRes.slice([0, 4], [-1, numClass]).squeeze();
    return [rawScores.max(1), rawScores.argMax(1)];
  });

  const nms = await tf.image.nonMaxSuppressionAsync(boxes, scores, 500, 0.45, 0.2);
  const detReady = tf.tidy(() => tf.concat([
    boxes.gather(nms, 0),
    scores.gather(nms, 0).expandDims(1),
    classes.gather(nms, 0).expandDims(1)
  ], 1));

  const masks = tf.tidy(() => {
    const segFeatures = transRes.slice([0, 4 + numClass], [-1, transSegMask.shape[0]]).squeeze();
    return segFeatures
      .gather(nms, 0)
      .matMul(transSegMask.reshape([transSegMask.shape[0], -1]))
      .reshape([nms.size, transSegMask.shape[1], transSegMask.shape[2]]);
  });

  tf.dispose([boxes, scores, classes, transRes]);

  let finalMask = tf.zeros([modelHeight, modelWidth]);

  for (let i = 0; i < detReady.shape[0]; i++) {
    const rowData = detReady.slice([i, 0], [1, 6]);
    const values = rowData.dataSync();
    tf.dispose(rowData);

    const [y1, x1, y2, x2, score, label] = values;
    if (label !== PERSON_CLASS_INDEX) continue;

    const ds = [
      Math.floor((y1 * transSegMask.shape[1]) / modelHeight),
      Math.floor((x1 * transSegMask.shape[2]) / modelWidth),
      Math.round(((y2 - y1) * transSegMask.shape[1]) / modelHeight),
      Math.round(((x2 - x1) * transSegMask.shape[2]) / modelWidth),
    ];

    const us = [
      Math.floor(y1 * yRatio),
      Math.floor(x1 * xRatio),
      Math.round((y2 - y1) * yRatio),
      Math.round((x2 - x1) * xRatio),
    ];

    const proto = tf.tidy(() => {
      const startY = Math.max(0, ds[0]);
      const startX = Math.max(0, ds[1]);

      const maxH = transSegMask.shape[1] - startY;
      const maxW = transSegMask.shape[2] - startX;

      const sizeH = Math.min(ds[2], maxH);
      const sizeW = Math.min(ds[3], maxW);

      if (sizeH <= 0 || sizeW <= 0) return tf.zeros([1, 1, 1]);  // skip invalid slice

      return masks
        .slice([i, startY, startX], [1, sizeH, sizeW])
        .squeeze()
        .expandDims(-1);
    });

    const upsample = tf.image.resizeBilinear(proto, [us[2], us[3]]);

    const padded = tf.tidy(() => upsample.pad([
      [us[0], modelHeight - (us[0] + us[2])],
      [us[1], modelWidth - (us[1] + us[3])],
      [0, 0]
    ]));

    const binary = padded.squeeze().greater(0.5).cast("float32");

    finalMask = tf.tidy(() => tf.maximum(finalMask, binary));

    tf.dispose([proto, upsample, padded, binary]);
  }

  tf.dispose([masks, detReady, transSegMask]);

  return finalMask.mul(255).cast("int32");
}

async function makeSilhouetteTiled(fullImageTensor, model, tileSize = 640, stride = 480) {
  const [H, W] = fullImageTensor.shape.slice(0, 2);
  let finalMask = tf.zeros([H, W]);

  for (let y = 0; y < H; y += stride) {
    for (let x = 0; x < W; x += stride) {
      await tf.nextFrame(); // avoid UI freeze

      const h = Math.min(tileSize, H - y);
      const w = Math.min(tileSize, W - x);

      const tile = tf.tidy(() => {
        const raw = fullImageTensor.slice([y, x, 0], [h, w, -1]);
        return h < tileSize || w < tileSize
          ? raw.pad([[0, tileSize - h], [0, tileSize - w], [0, 0]])
          : raw;
      });

      const maskTile = await makeSilhouette(tile, model);
      tf.dispose(tile);

      const maskCropped = maskTile.slice([0, 0], [h, w]);

      const maskPadded = tf.tidy(() => {
        const top = y, bottom = H - (y + h);
        const left = x, right = W - (x + w);
        return maskCropped.expandDims(-1).pad([[top, bottom], [left, right], [0, 0]]).squeeze();
      });

      finalMask = tf.tidy(() => tf.maximum(finalMask, maskPadded));
      tf.dispose([maskTile, maskCropped, maskPadded]);
    }
  }

  return finalMask;
}


async function smartCropAndResize(maskTensor, targetHeight = 640, targetWidth = 480, marginRatio = 0.15) {
  const [height, width] = maskTensor.shape;

  // Step 1: Compute bounding box of the mask
  const nonZero = await tf.whereAsync(maskTensor.greater(0)); // [[y, x], ...]

  if (nonZero.shape[0] === 0) {
    // No person detected, return blank
    return tf.zeros([targetHeight, targetWidth]);
  }

  const yCoords = nonZero.slice([0, 0], [-1, 1]).squeeze();
  const xCoords = nonZero.slice([0, 1], [-1, 1]).squeeze();

  const yMin = yCoords.min().dataSync()[0];
  const yMax = yCoords.max().dataSync()[0];
  const xMin = xCoords.min().dataSync()[0];
  const xMax = xCoords.max().dataSync()[0];

  const boxHeight = yMax - yMin;
  const boxWidth = xMax - xMin;

  // Step 2: Add margin
  const marginY = Math.round(boxHeight * marginRatio);
  const marginX = Math.round(boxWidth * marginRatio);

  const top = Math.max(0, yMin - marginY);
  const bottom = Math.min(height, yMax + marginY);
  const left = Math.max(0, xMin - marginX);
  const right = Math.min(width, xMax + marginX);

  const cropHeight = bottom - top;
  const cropWidth = right - left;

  // Step 3: Crop the region
  const cropped = maskTensor.slice([top, left], [cropHeight, cropWidth]);

  // Step 4: Resize with aspect ratio padding
  const aspectRatio = cropWidth / cropHeight;
  const targetAspectRatio = targetWidth / targetHeight;

  let padded;
  if (aspectRatio > targetAspectRatio) {
    // Wider than target — pad height
    const newHeight = Math.round(cropWidth / targetAspectRatio);
    const padTotal = newHeight - cropHeight;
    const padTop = Math.floor(padTotal / 2);
    const padBottom = padTotal - padTop;
    padded = cropped.pad([[padTop, padBottom], [0, 0]]);
  } else {
    // Taller than target — pad width
    const newWidth = Math.round(cropHeight * targetAspectRatio);
    const padTotal = newWidth - cropWidth;
    const padLeft = Math.floor(padTotal / 2);
    const padRight = padTotal - padLeft;
    padded = cropped.pad([[0, 0], [padLeft, padRight]]);
  }


  // tf dispose
  tf.dispose([cropped, xCoords, yCoords, nonZero]);

  // Step 5: Resize to target dimensions
  return tf.image.resizeBilinear(padded.expandDims(-1), [targetHeight, targetWidth]);
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
  // start scope
  tf.engine().startScope();

  console.log("PREDICTION: loading YOLO11...");
  const YOLO_URL = "https://huggingface.co/batmanBinSuparman/bmnet/resolve/main/yolo11n-seg_web_model/model.json";
  const yoloV11 = await tf.loadGraphModel(YOLO_URL);

  console.log("PREDICTION: make silhouettes");
  let frontImageSilhouette = await makeSilhouetteTiled(frontImageTensor, yoloV11);
  let sideImageSilhouette = await makeSilhouetteTiled(sideImageTensor, yoloV11);

  frontImageSilhouette = await smartCropAndResize(frontImageSilhouette);
  sideImageSilhouette = await smartCropAndResize(sideImageSilhouette);

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

  // delete all unneeded tensors/models
  // tf.dispose([]);
  tf.dispose([
    frontImageSilhouette,
    sideImageSilhouette,
    combinedSilhouette,
    mnasNet,
    yoloV11
  ]);
  //
  // end scope
  tf.engine().endScope();
  return mnasResult;
}
