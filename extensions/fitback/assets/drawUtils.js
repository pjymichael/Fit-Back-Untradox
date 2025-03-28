/**
 * Draws a filled circle (point) on the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas 2D context.
 * @param {number} x - The x-coordinate of the point.
 * @param {number} y - The y-coordinate of the point.
 * @param {number} r - The radius of the point.
 * @param {string} color - The fill color.
 */
export function drawPoint(ctx, x, y, r, color) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();
}

/**
 * Draws a line between two points on the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx - The canvas 2D context.
 * @param {number} aX - The x-coordinate of the starting point.
 * @param {number} aY - The y-coordinate of the starting point.
 * @param {number} bX - The x-coordinate of the ending point.
 * @param {number} bY - The y-coordinate of the ending point.
 * @param {string} linecolor - The color of the line.
 * @param {number} lineWidth - The width of the line.
 */
export function connectPoints(ctx, aX, aY, bX, bY, linecolor, lineWidth) {
  ctx.beginPath();
  ctx.moveTo(aX, aY);
  ctx.lineTo(bX, bY);
  ctx.strokeStyle = linecolor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

/**
 * Draws a skeleton based on a given pose estimation.
 *
 * It transforms keypoint coordinates from the video to canvas space, draws keypoints,
 * and connects them according to predefined connections.
 *
 * @param {Object} pose - Pose object containing keypoints.
 * @param {CanvasRenderingContext2D} ctx - The canvas 2D context.
 * @param {HTMLVideoElement} video - The video element for scaling reference.
 */
export const drawSkeleton = (pose, ctx, video) => {
  const minConfidence = 0.6; // Minimum score to consider keypoint valid

  // Transforms video coordinates to canvas coordinates with horizontal flip.
  const transformPoint = (x, y) => {
    return {
      x: (ctx.canvas.width - x) * (ctx.canvas.width / video.videoWidth),
      y: y * (ctx.canvas.height / video.videoHeight),
    };
  };

  // Computes the midpoint between two points.
  const getMidpoint = (a, b) => {
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  };

  // Draw keypoints if they exceed the confidence threshold.
  pose.keypoints.forEach((keypoint) => {
    if (keypoint.score >= minConfidence) {
      const { x, y } = transformPoint(keypoint.x, keypoint.y);
      drawPoint(ctx, x, y, 5, "red");
    }
  });

  // Retrieves a keypoint by its name.
  const getKeypoint = (name) => {
    return pose.keypoints.find((kp) => kp.name === name);
  };

  // Get keypoints for shoulders and hips.
  const leftShoulder = getKeypoint("left_shoulder");
  const rightShoulder = getKeypoint("right_shoulder");
  const leftHip = getKeypoint("left_hip");
  const rightHip = getKeypoint("right_hip");

  // Process shoulders to calculate midpoint.
  if (leftShoulder && rightShoulder) {
    const leftShoulderT = transformPoint(leftShoulder.x, leftShoulder.y);
    const rightShoulderT = transformPoint(rightShoulder.x, rightShoulder.y);
    const midPointShoulder = getMidpoint(leftShoulderT, rightShoulderT);
    drawPoint(ctx, midPointShoulder.x, midPointShoulder.y, 5, "green");

    // Process hips if available to calculate midpoint and draw connection.
    if (leftHip && rightHip) {
      const leftHipT = transformPoint(leftHip.x, leftHip.y);
      const rightHipT = transformPoint(rightHip.x, rightHip.y);
      const midPointHip = getMidpoint(leftHipT, rightHipT);
      drawPoint(ctx, midPointHip.x, midPointHip.y, 5, "green");
      connectPoints(
        ctx,
        midPointShoulder.x,
        midPointShoulder.y,
        midPointHip.x,
        midPointHip.y,
        "green",
        2
      );
    } else {
      console.log("hips not detected");
    }
  } else {
    console.log("shoulders not detected");
  }

  // Predefined connections between keypoints to form the skeleton.
  const connections = [
    ["left_shoulder", "right_shoulder"],
    ["left_shoulder", "left_elbow"],
    ["left_elbow", "left_wrist"],
    ["right_shoulder", "right_elbow"],
    ["right_elbow", "right_wrist"],
    ["left_shoulder", "left_hip"],
    ["right_shoulder", "right_hip"],
    ["left_hip", "right_hip"],
    ["left_hip", "left_knee"],
    ["left_knee", "left_ankle"],
    ["right_hip", "right_knee"],
    ["right_knee", "right_ankle"],
  ];

  // Draw connections between valid keypoints.
  connections.forEach(([partA, partB]) => {
    const a = getKeypoint(partA);
    const b = getKeypoint(partB);
    if (a && b && a.score >= minConfidence && b.score >= minConfidence) {
      const aT = transformPoint(a.x, a.y);
      const bT = transformPoint(b.x, b.y);
      connectPoints(ctx, aT.x, aT.y, bT.x, bT.y, "blue", 2);
    }
  });

  // Unused code block for drawing a bounding rectangle (kept for future use).
  // const horizontalPadding = 50;
  // const verticalPadding = 50;
  // const leftBound = horizontalPadding;
  // const rightBound = ctx.canvas.width - horizontalPadding;
  // const topBound = verticalPadding;
  // const bottomBound = ctx.canvas.height - verticalPadding;
  //
  // ctx.beginPath();
  // // Mirror the x-coordinate of the right bound.
  // ctx.rect(ctx.canvas.width - rightBound, topBound, rightBound - leftBound, bottomBound - topBound);
  // ctx.strokeStyle = "green";
  // ctx.lineWidth = 2;
  // ctx.stroke();
};
