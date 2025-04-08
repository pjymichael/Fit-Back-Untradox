//array to store screen id
import { drawSkeleton } from "./drawUtils.js";
import {
  setWorkerInstance,
  requestVersion,
  loadModel,
  classifyFrame,
} from "./workerFunctionsHelper.js";
import { initializePoseDetector, estimatePoses } from "./poseDetector.js";
import { predictSizes } from "./predictSize.js";

console.log("Running v6");
console.log("Running v1.0.10");

let currentSize;
let sizingData;
let glider;

let makingMeasurementPrediction = false; // use this to ensure that the

const workerCode = `
// Load external scripts inside a try/catch.
try {
  importScripts(
    "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js",
    "https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8/dist/teachablemachine-pose.min.js"
  );
  console.log(
    "TF1 Worker: External scripts loaded. TFJS version:",
    tf.version.tfjs
  );
  // Confirm TFJS version to main thread
  self.postMessage({ type: "version", version: tf.version.tfjs });
} catch (e) {
  console.error("Error loading external scripts:", e);
  // Notify main thread of load failure
  self.postMessage({
    type: "error",
    errorMessage:"Failed to load external scripts." + e.toString(),
  });
  // You may want to return here if scripts are critical
}

// Confirm worker loaded.
self.postMessage({
  type: "info",
  message: "TF1 Worker: Loaded successfully with external scripts!",
});

// Variable to store the loaded model.
let tmModel = null;

// Listen for messages from the main thread.
self.onmessage = async (e) => {
  const { command, data } = e.data;

  switch (command) {
    case "version":
      // Return the TFJS version
      self.postMessage({ type: "version", version: tf.version.tfjs });
      break;

    case "LOAD_MODEL":
      // Load the Teachable Machine pose model
      try {
        tmModel = await tmPose.load(data.modelURL, data.metadataURL);
        self.postMessage({ type: "model_loaded", success: true });
      } catch (err) {
        self.postMessage({
          type: "error",
          errorMessage: "Failed to load model"+err.toString(),
        });
      }
      break;

    case "CLASSIFY_FRAME":
      if (!tmModel) {
        // If model not loaded, treat it as an error
        self.postMessage({
          type: "error",
          errorMessage: " No model loaded. Please load a model first. ",
        });
        return;
      }
      try {
        const { width, height, buffer } = data;
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");

        // Create an ImageData from the buffer.
        const imageData = new ImageData(
          new Uint8ClampedArray(buffer),
          width,
          height
        );
        ctx.putImageData(imageData, 0, 0);

        // Estimate pose and classify.
        const { pose: tmPoseOutput, posenetOutput } =
          await tmModel.estimatePose(canvas);
        const predictions = await tmModel.predict(posenetOutput);

        // Find the best prediction
        const best = predictions.reduce((a, b) =>
          a.probability > b.probability ? a : b
        );

        // Post classification success
        self.postMessage({
          type: "classification",
          bestClass: best.className,
          probability: best.probability,
        });
      } catch (err) {
        // Post error if classification throws
        self.postMessage({
          type: "error",
          errorMessage: "Classification error:" + err.toString()
        });
      }
      break;

    default:
      // Handle unknown commands
      self.postMessage({
        type: "error",
        errorMessage:"Unknown command: "
      });
      break;
  }
};


`;
const blob = new Blob([workerCode], { type: "application/javascript" });
const workerUrl = URL.createObjectURL(blob);
const tf1Worker = new Worker(workerUrl);

tf1Worker.onmessage = (event) => {
  // console.log("Main thread received:", event.data);
};

// Optionally, listen for errors.
tf1Worker.onerror = (error) => {
  console.error("Worker error:", error);
};

setWorkerInstance(tf1Worker);

requestVersion();

// async function collapsePose(video) {
//   // Get intrinsic video dimensions.
//   const width = video.videoWidth;
//   const height = video.videoHeight;
//   console.log("collapsePose: normal dimensions =", width, height);

//   // Create a temporary canvas with normal dimensions.
//   const normalCanvas = document.createElement("canvas");
//   normalCanvas.width = width;
//   normalCanvas.height = height;
//   const ctx = normalCanvas.getContext("2d", { willReadFrequently: true });

//   // Draw the current video frame onto the canvas.
//   ctx.drawImage(video, 0, 0, width, height);

//   // Retrieve the image data from the canvas.
//   const imageData = ctx.getImageData(0, 0, width, height);

//   // Convert the canvas content to a Data URL for debugging.
//   const normalDataURL = normalCanvas.toDataURL("image/png");
//   console.log("collapsePose: Normal frame (Data URL) →", normalDataURL);

//   // Pass the image data buffer to the classifier.
//   try {
//     const result = await classifyFrame(width, height, imageData.data.buffer);
//     return {
//       poseName: result.bestClass,
//       poseConfidence: result.probability,
//       normalDataURL, // Debug URL for verification.
//     };
//   } catch (error) {
//     console.error("Error in classification:", error);
//     return {
//       poseName: null,

//       poseConfidence: 0,
//       normalDataURL,
//     };
//   }
// }

async function collapsePose(video) {
  // Use displayed size, not intrinsic size
  const displayedWidth = video.clientWidth;
  const displayedHeight = video.clientHeight;
  console.log(
    "collapsePose: displayed dimensions =",
    displayedWidth,
    displayedHeight,
  );

  // Create a temporary canvas with displayed dimensions
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = displayedWidth;
  normalCanvas.height = displayedHeight;
  const ctx = normalCanvas.getContext("2d", { willReadFrequently: true });

  // If your <video> is mirrored in CSS with transform: scaleX(-1),
  // replicate that transform:
  ctx.save();
  ctx.translate(displayedWidth, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, displayedWidth, displayedHeight);
  ctx.restore();

  // Retrieve the image data from the canvas
  const imageData = ctx.getImageData(0, 0, displayedWidth, displayedHeight);

  // Convert the canvas content to a Data URL for debugging
  const normalDataURL = normalCanvas.toDataURL("image/png");
  console.log("collapsePose: Normal frame (Data URL) →", normalDataURL);

  // Pass image data to your classifier
  try {
    const result = await classifyFrame(
      displayedWidth,
      displayedHeight,
      imageData.data.buffer,
    );
    return {
      poseName: result.bestClass,
      poseConfidence: result.probability,
    };
  } catch (error) {
    console.error("Error in classification:", error);
    return {
      poseName: null,
      poseConfidence: 0,
    };
  }
}
// By using this approach,
requestVersion();
// const TM_URL = "https://teachablemachine.withgoogle.com/models/bOkXKhLNs/";
const TM_URL = "https://teachablemachine.withgoogle.com/models/l5GZBzm0W/";

loadModel(TM_URL + "model.json", TM_URL + "metadata.json");

let userInfo = {
  gender: null,
  height: null,
  weight: null,
  age: null,
  shoulder: null,
  hip: null,
  arm: null,
  leg: null,
  chest: null,
  waist: null,
  torso: null,
  thigh: null,
};

document.addEventListener("DOMContentLoaded", () => {
  const elements = initializeElements();
  const {
    camerascanclass1,
    camerascanclass2,
    productInfo,
    canvas,
    video,
    overlay,
    mainContent,
    openButton,
    onboardWelcome,
    onboardUserInput,
    onboardCameraPrompt,
    onboardCameraGuidelines,
    onboardCameraPosition,
    recommendationContent,
    CameraScan,
    userDetailForm,
    onboardWelcomeNext,
    onboardUserInputNext,
    onboardCameraPromptNext,
    onboardCameraPromptManual,
    onboardCameraGuidelinesNext,
    onboardCameraPositionNext,
    CameraScanNext,
    genderInput,
    heightInput,
    weightInput,
    ageInput,
    sizingCardContainer,
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
    userMeasurementForm,
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
    shoulderInput,
    chestInput,
    hipInput,
    waistInput,
    torsoInput,
    armInput,
    legInput,
    thighInput,
  } = elements;
  

  // -- NEW: Append overlay to <body> so it's not nested in a limiting container --
  document.body.appendChild(overlay);

  setupModalOpenClose(openButton, overlay);

  //sizes: keys of the sizes object (eg s,m,l etc...) (used to generate carousel)
  let sizes;
  //categories: category of sizing (chest, shoulder, leg, waist etc...) (use to generate recommender card, with )
  let categories;
  //ensure product info exist
  if (productInfo) {
    try {
      let scriptTag = document.getElementById("sizing-data");
      sizingData = JSON.parse(scriptTag.textContent);
      const sizeObj = sizingData.sizes;
      console.log(sizingData);
      sizes = Object.keys(sizingData.sizes);
      categories = Object.keys(sizeObj[sizes[0]]); // ["torso", "shoulder", "chest", "sleeve"]

      console.log("Sizes:", sizes);
      console.log("Categories:", categories);
    } catch (error) {
      console.error("Failed to parse sizing JSON", error);
    }
  }

  const constructRecommenderCard = (productSizeCategory) => {
    //product size category will be an array of categories (e.g) [chest, torso, shoulder]
    //loop through and create a sizing card like the following (with h5 using category, set p text content as NA first )
    // <div class="sizing-card">
    // <h5>Shoulder</h5>
    // <p>Just Right</p>
    // </div>
    //construct the sizing card with the title based on category
    //and then append in to <div id="sizing-cards-container" class="sizing-cards-container">
    //afterwards, any information update will be handled by another function
    console.log("running construct recommender card function");
    const container = document.getElementById("sizing-cards-container");

    // Make sure the container exists
    if (!container) {
      console.warn("sizing-cards-container not found");
      return;
    }

    // Clear previous cards (optional, depending on behavior you want)
    container.innerHTML = "";

    productSizeCategory.forEach((category) => {
      // Create the card wrappercameraS
      const card = document.createElement("div");
      card.classList.add("sizing-card");
      card.setAttribute("data-category", category.toLowerCase());

      // Create the title element
      const title = document.createElement("h5");
      title.textContent = category.charAt(0).toUpperCase() + category.slice(1); // Capitalize

      // Create the placeholder text
      const valueText = document.createElement("p");
      valueText.textContent = "N/A"; // Placeholder to update later

      // Append title + text to card, then card to container
      card.appendChild(title);
      card.appendChild(valueText);
      container.appendChild(card);
    });
  };

  const onboardScreensArray = [
    onboardWelcome,
    onboardUserInput,
    onboardCameraPrompt,
    onboardCameraGuidelines,
    onboardCameraPosition,
    CameraScan,
    recommendationContent,
  ];

  //Grab reference to buttons
  //store as array
  const onboardNextBtnsArray = [
    onboardWelcomeNext,
    onboardUserInputNext,
    onboardCameraPromptNext,
    onboardCameraGuidelinesNext,
    onboardCameraPositionNext,
    CameraScanNext,
    onboardCameraPromptManual
  ];
  //EVENTS

  // const userDetailArray = [genderInput, heightInput, weightInput, ageInput];

  const cameraController = {
    isActive: false,
    stream: null,
    async startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        isDetecting = true;
        video.srcObject = stream;
        video.play();
        video.style.display = "block";

        // video.style.setProperty("width", "1920px", "important");
        // video.style.setProperty("height", "auto", "important");

        video.style.display = "block"; // Makes sure the video is visible
        video.onloadeddata = () => {
          console.log("Video loaded, starting pose detection...");
          // TODO : convert this to a function to initialize the silhoutte
          const silhouette = document.getElementById("expected-silhouette");
          console.log("Silhouette element:", silhouette.src);
          silhouette.style.height = video.offsetHeight * 0.95 + "px";
          console.log(video.clientHeight, video.clientWidth);
          // canvas.width = video.clientWidth;
          // canvas.height = video.clientHeight;
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          startPoseDetection();
        };
      } catch (error) {
        console.error("Error starting camera:", error);
      }
    },
    deactivateCamera() {
      console.log("Deactivating camera... outer loop");
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      isDetecting = false;
      isReady = false;
    },
    DisplayFeedback(message) {
      userFeedback.innerHTML = message;
    },
    getVideoElement() {
      return video;
    },
  };
  const userDetailArray = [genderInput, heightInput, weightInput, ageInput];
  
  const measurementInputArray = [
    shoulderInput,
    chestInput,
    hipInput,
    waistInput,
    torsoInput,
    armInput,
    legInput,
    thighInput,
  ];
  const recommendationScreenArray = [
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
  ];
  const recommendationScreenBtn = [
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
  ];

  // Package the extra elements into an object for clarity
  const extraElements = {
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
  };

  setupOnboardingNavigation(
    onboardScreensArray,
    onboardNextBtnsArray,
    userDetailForm,
    userDetailArray,
    cameraController,
    sizes,
    categories,
    recommendationScreenArray,
    extraElements,
  );


  setupRecommendationNavigation(
    recommendationScreenBtn,
    extraElements,
    userMeasurementForm,
    measurementInputArray,
    userInfo, // only to pass values to saveProfileMeasurementDetails
    userDetailArray, // only to pass values to saveProfileMeasurementDetails
  );

  constructRecommenderCard(categories);
  //Interactivity of recommender card and svg
  const cards = document.querySelectorAll(".sizing-card");
  cards.forEach((card) => {
    const category = card.getAttribute("data-category");
    const targetSvg = document.getElementById(`${category}-recommendation-svg`);

    if (targetSvg) {
      card.addEventListener("mouseover", () => {
        const shapeElements = targetSvg.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.add("fill-black"));
      });

      card.addEventListener("mouseout", () => {
        const shapeElements = targetSvg.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.remove("fill-black"));
      });
    }

    //special Cases (sleeve, leg)
    //Special case:"sleeve" = forearm + bicep + shoulder
    if (category === "sleeve") {
      const relatedIds = [
        "forearm-recommendation-svg",
        "bicep-recommendation-svg",
        "shoulder-recommendation-svg",
      ];

      card.addEventListener("mouseover", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.add("fill-black"));
          }
        });
      });

      card.addEventListener("mouseout", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.remove("fill-black"));
          }
        });
      });
    }

    //Special case: "leg" = thigh + calf
    if (category === "leg") {
      const relatedIds = [
        "thigh-recommendation-svg",
        "calf-recommendation-svg",
      ];

      card.addEventListener("mouseover", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.add("fill-black"));
          }
        });
      });

      card.addEventListener("mouseout", () => {
        relatedIds.forEach((id) => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll(
              "path, ellipse, line, circle, polygon, rect",
            );
            shapes.forEach((shape) => shape.classList.remove("fill-black"));
          }
        });
      });
    }
  });

  //update the recommendation card values (loose, justright, tight) based on user data and size chosen
  /*updateRecommmenderCardValues(userData)

  */
  //My Profile
  //Interactivity of svg and measurement card in myprofile tab
  document.querySelectorAll(".measurement-card").forEach((card) => {
    card.addEventListener("mouseover", () => {
      const targetId = card.getAttribute("data-target");
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        // Select all common SVG shape elements within the target group
        const shapeElements = targetElement.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.add("highlight"));
      }
    });

    card.addEventListener("mouseout", () => {
      const targetId = card.getAttribute("data-target");
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const shapeElements = targetElement.querySelectorAll(
          "path, ellipse, line, circle, polygon, rect",
        );
        shapeElements.forEach((shape) => shape.classList.remove("highlight"));
      }
    });
  });

  // Assuming sizes is an array like ["s", "m", "l"]
  // if (sizes && sizes.length > 0) {
  //   const gliderElement = document.querySelector('.glider');
  //   gliderElement.innerHTML = ""; // Clear any existing slides

  //   sizes.forEach((size, index) => {
  //     const slide = document.createElement('div');
  //     slide.classList.add('slide');
  //     slide.setAttribute('data-slide', index + 1);
  //     slide.setAttribute('tabindex', '0');
  //     slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
  //     gliderElement.appendChild(slide);
  //   });
  // } else {
  //     // Otherwise, initialize it
  //     glider = new Glider(gliderElement, {
  //       slidesToShow: 1,
  //       dots: '.dots',
  //       draggable: true,
  //       scrollLock: true,
  //       rewind: true,
  //       arrows: {
  //         prev: '.glider-prev',
  //         next: '.glider-next'
  //       }
  //     });
  // }

  // let numberOfSliders = document.querySelectorAll('.glider-slide').length

  // function getPreviousSlide(currentSlide) {
  //   if (currentSlide === 1) {
  //     return numberOfSliders;
  //   } else {
  //     return currentSlide - 1;
  //   }
  // }

  // function goToPreviousSlide(currentSlide) {
  //     var previousSlide = getPreviousSlide(currentSlide);
  //     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
  //     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
  // }

  // function getNextSlide(currentSlide) {
  //   if (currentSlide === numberOfSliders) {
  //     return 1;
  //   } else {
  //     return currentSlide + 1;
  //   }
  // }

  // function goToNextSlide(currentSlide) {
  //     var previousSlide = getNextSlide(currentSlide);
  //     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
  //     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
  // }

  // document.querySelector('.glider-prev').addEventListener("click", function() {
  //   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
  //   goToPreviousSlide(currentSlide)
  // });

  // document.querySelector('.glider-next').addEventListener("click", function() {
  //   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
  //   goToNextSlide(currentSlide)
  // });

  // // Listen for the 'glider-slide-visible' event to know when the slide changes
  // document.querySelector('.glider').addEventListener('glider-slide-visible', function(event) {
  //   // event.detail.slide gives the index of the new active slide.
  //   // This index might start at 0 or 1 based on Glider.js configuration.
  //   console.log('New active slide is:', event.detail.slide);
  // });

  //Camera Scan code

  //initFirebase(firebaseConfig);

  let stream;
  let detector;
  let isDetecting = false;
  let isReady = false;

  async function startPoseDetection() {
    if (!detector) {
      detector = await initializePoseDetector();
    }
    isReady = true;
    requestAnimationFrame(detectPose);
  }

  const THROTTLE_DELAY = 120; // ms
  let lastTime = 0;

  async function detectPose(timestamp) {
    if (!isDetecting) return;

    // Wait for video readiness
    if (!isReady || !video || video.readyState < 2) {
      requestAnimationFrame(detectPose);
      return;
    }

    // Throttle
    if (timestamp - lastTime < THROTTLE_DELAY) {
      requestAnimationFrame(detectPose);
      return;
    }
    lastTime = timestamp;

    try {
      const poses = await estimatePoses(detector, video);
      drawPose(canvas, video, poses);
    } catch (error) {
      console.error("Error in pose estimation:", error);
    }

    requestAnimationFrame(detectPose);
  }

  function drawPose(canvas, video, poses) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Mirror the canvas so it looks more natural
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // ctx.clearRect(0, 0, canvas.width, canvas.height); // ← Problem is here!
    ctx.restore();
    video.display = "none";
    poses.forEach((pose) => {
      drawSkeleton(pose, ctx, video);
      analysePose(pose, ctx);
    });
  }

  async function runMeasurementPrediction() {
    if (makingMeasurementPrediction) {
      return;
    }
    makingMeasurementPrediction = true;
    console.log("PREDICTION: Running  runMeasurementPrediction function");

    let measurements = await predictSizes(
      analysisState.frontImageTensor,
      analysisState.sideImageTensor,
      Math.round(userInfo.height),
      Math.round(userInfo.weight),
    );
    // turn measurements into an update object
    // let gender = "";
    //let height = 0;
    //let weight = 0;
    //let age = 0;
    //
    //let shoulder = 0;
    //let hip = 0;
    //let arm = 0;
    //let leg = 0;
    //let chest = 0;
    //let waist = 0;
    //let torso = 0;
    //let thigh = 0;
    // measurement-columns = ['ankle', 'arm-length', 'bicep', 'calf', 'chest', 'forearm', 'hip', 'leg-length', 'shoulder-breadth', 'shoulder-to-crotch', 'thigh', 'waist', 'wrist']
    // take out the array from the result (which is a [array]) and round
    // to the nearest 0.5
    measurements = measurements[0];
    measurements = measurements.map((num) => Math.round(num * 2) / 2);
    const updates = {
      shoulder: measurements[8],
      hip: measurements[6],
      arm: measurements[1],
      leg: measurements[7],
      chest: measurements[4],
      waist: measurements[11],
      torso: measurements[9],
      thigh: measurements[10],
    };
    // update the user details
    updateUserInfo(updates);
    console.log("PREDICTION: Updated User Info:", userInfo);
    updateMeasurementCards();
    console.log("PREDICTION: obtained MNAS measurements: ", measurements);
    // make the `next` button visible
    CameraScanNext.classList.remove("hidden");
  }

  const analysisState = {
    state: "start",
    validSince: null,
    lastFeedback: "",
    imageBlobArray: [],
    photosTaken: 0,
    uploadInProgress: false,
    frontImageTensor: null, // image tensors for the size prediction
    sideImageTensor: null,
    firstTime: true,
  };
  const REQUIRED_TIME = 3000;
  let isClassifying = false;

  function calculateIsInsideFrame(pose, ctx) {
    // Define your keypoint groups and confidence thresholds.
    const headPoints = [
      "nose",
      "left_eye",
      "right_eye",
      "left_ear",
      "right_ear",
    ];
    const bodyPoints = [
      "left_shoulder",
      "right_shoulder",
      "left_elbow",
      "right_elbow",
      "left_wrist",
      "right_wrist",
      "left_hip",
      "right_hip",
      "left_knee",
      "right_knee",
      "left_ankle",
      "right_ankle",
    ];
    const bodyMinConfidence = 0.5;
    const headMinConfidence = 0.4;

    // Filter keypoints by confidence.
    const confidentHeadKeypoints = pose.keypoints.filter(
      (kp) => headPoints.includes(kp.name) && kp.score > headMinConfidence,
    );
    const confidentBodyKeypoints = pose.keypoints.filter(
      (kp) => bodyPoints.includes(kp.name) && kp.score > bodyMinConfidence,
    );

    // Combine the keypoints for further position checks.
    const filteredKeypoints = [
      ...confidentHeadKeypoints,
      ...confidentBodyKeypoints,
    ];

    // Ensure every body keypoint is present.
    const allBodyPresent = bodyPoints.every((point) =>
      confidentBodyKeypoints.some((kp) => kp.name === point),
    );

    // Ensure at least one head keypoint is present.
    const isHead = headPoints.some((point) =>
      confidentHeadKeypoints.some((kp) => kp.name === point),
    );

    // Define padded boundaries.
    const horizontalPadding = 10;
    const verticalPadding = 10;
    const left = horizontalPadding;
    const right = ctx.canvas.width - horizontalPadding;
    const top = verticalPadding;
    const bottom = ctx.canvas.height - verticalPadding;

    // Adjust x coordinate because the canvas is mirrored.
    const pointsOutsidePadding = filteredKeypoints.filter((kp) => {
      const x = ctx.canvas.width - kp.x;
      const y = kp.y;
      return x < left || x > right || y < top || y > bottom;
    });

    // Final check: inside if no filtered keypoint is outside AND all body and at least one head keypoint are present.
    const isInsideFrame =
      pointsOutsidePadding.length === 0 && allBodyPresent && isHead;

    return {
      isInsideFrame,
      filteredKeypoints,
      allBodyPresent,
      isHead,
      pointsOutsidePadding,
    };
  }

  function calculateIsSideInsideFrame(pose, ctx) {
    // Define groups for the side view check.
    const sideHead = ["nose", "left_eye", "right_eye", "left_ear", "right_ear"];
    const sideShoulders = ["left_shoulder", "right_shoulder"];
    const sideWrists = ["left_wrist", "right_wrist"];
    const sideKnees = ["left_knee", "right_knee"];
    const sideHipsAnkles = [
      "left_hip",
      "right_hip",
      "left_ankle",
      "right_ankle",
    ];

    // Use a lower confidence threshold for side view.
    const minConfidence = 0.3;

    // Filter out keypoints that meet the minimum confidence.
    const validKeypoints = pose.keypoints.filter(
      (kp) => kp.score >= minConfidence,
    );

    // Define padded boundaries.
    const horizontalPadding = 10;
    const verticalPadding = 10;
    const leftBound = horizontalPadding;
    const rightBound = ctx.canvas.width - horizontalPadding;
    const topBound = verticalPadding;
    const bottomBound = ctx.canvas.height - verticalPadding;

    // Helper function to check if a keypoint is inside the padded boundaries.
    function isInside(kp) {
      // Adjust x coordinate because the canvas is mirrored.
      const x = ctx.canvas.width - kp.x;
      const y = kp.y;
      return (
        x >= leftBound && x <= rightBound && y >= topBound && y <= bottomBound
      );
    }

    // For each group, check that at least one keypoint is inside the boundaries.
    const headInside = validKeypoints.some(
      (kp) => sideHead.includes(kp.name) && isInside(kp),
    );
    const shouldersInside = validKeypoints.some(
      (kp) => sideShoulders.includes(kp.name) && isInside(kp),
    );
    const wristsInside = validKeypoints.some(
      (kp) => sideWrists.includes(kp.name) && isInside(kp),
    );
    const kneesInside = validKeypoints.some(
      (kp) => sideKnees.includes(kp.name) && isInside(kp),
    );
    const hipsAnklesInside = validKeypoints.some(
      (kp) => sideHipsAnkles.includes(kp.name) && isInside(kp),
    );

    // isSideInsideFrame is true only if each group has at least one keypoint inside.
    return (
      headInside &&
      shouldersInside &&
      wristsInside &&
      kneesInside &&
      hipsAnklesInside
    );
  }

  async function analysePose(pose, ctx) {
    const {
      isInsideFrame,
      filteredKeypoints,
      allBodyPresent,
      isHead,
      pointsOutsidePadding,
    } = calculateIsInsideFrame(pose, ctx);

    const isSideInsideFrame = calculateIsSideInsideFrame(pose, ctx);

    const horizontalPadding = 10;
    const verticalPadding = 10;
    const left = horizontalPadding;
    const right = ctx.canvas.width - horizontalPadding;
    const top = verticalPadding;
    const bottom = ctx.canvas.height - verticalPadding;

    // console.log(
    //   "confident head keypoints:",
    //   confidentHeadKeypoints.length,
    //   "confident body keypoints:",
    //   confidentBodyKeypoints.length,
    //   "total filtered keypoints:",
    //   filteredKeypoints.length,
    //   "points outside padding:",
    //   pointsOutsidePadding.length,
    //   "all body points present:",
    //   allBodyPresent,
    //   "at least one head point present:",
    //   isHead,
    //   "is inside frame:",
    //   isInsideFrame,
    // );
    const now = Date.now();

    // analysisState.state = "final_state"; // debugging statement
    if (analysisState.state === "upload_photo") {
      //DisplayFeedback("Uploading photos to firebase...");
      DisplayFeedback("Predicting measurements...");
      updateSilhouette("disable");
      analysisState.state = "final_state";
      return;
    } else if (analysisState.state === "final_state") {
      // Completed
      DisplayFeedback("Measurement Process completed!");
      // Example: auto-switch to Fit tab
      cameraController.deactivateCamera();
      setTimeout(() => {
        // tabFitBtn.click();
        console.log("Switched to Fit tab after detection completed");
        camerascanclass1.style.display = "none";
        console.log(camerascanclass2);
        camerascanclass2.classList.remove("hidden");
        document.querySelector(".modal-content").classList.remove("cameraScan");
        console.log(camerascanclass2);
        //cameraController.deactivateCamera();
      }, 1000);

      // wait for measurements to be done, then go to the display user
      // size page
      runMeasurementPrediction();
      return;
    }

    // move this to the else condition
    if (analysisState.firstTime) {
      updateSilhouette("start");
      analysisState.firstTime = false;
    }
    if (analysisState.imageBlobArray.length == 0) {
      if (!isInsideFrame) {
        console.log("Front pose but not inside frame");
        analysisState.state = "detecting_one";
        analysisState.validSince = null;
        DisplayFeedback("Please stand inside the frame");
      } else {
        console.log("Front Pose inside Frame");
        if (!analysisState.validSince) {
          analysisState.validSince = now;
        }
        if (now - analysisState.validSince >= REQUIRED_TIME) {
          switch (analysisState.state) {
            case "start":
              updateSilhouette("start");
              console.log("Transitioning to detecting_one");
              analysisState.state = "detecting_one";
              analysisState.validSince = now;
              DisplayFeedback("Detecting your pose...");
              break;
            case "detecting_one":
              if (isClassifying) break;
              isClassifying = true;

              const result1 = await collapsePose(video);
              if (
                result1.poseName &&
                result1.poseName.toLowerCase() === "front-view".toLowerCase() &&
                result1.poseConfidence > 0.7
              ) {
                DisplayFeedback("Pose Detected, taking photo");
                analysisState.state = "ready_one";
                analysisState.validSince = now;
              } else {
                console.log("result1", result1);
                DisplayFeedback("Please match the silhouette with your body");
                isClassifying = false;
                return;
              }
              isClassifying = false;
              break;

            case "ready_one":
              DisplayFeedback("Taking front photo...");
              returnPhotoRef("front", (err, result) => {
                if (err) {
                  console.error("Capture Photo method failed", err);
                } else {
                  console.log("Saved front image:", result);
                  analysisState.imageBlobArray.push(result);
                  analysisState.state = "start_2";
                  analysisState.validSince = now;
                  analysisState.frontImageTensor = result.tensor;
                }
              });
              break;

            default:
              console.log("analysisState", analysisState.state);
              DisplayFeedback("Resetting detection. Please stand still.");
              break;
          }
        } else {
          DisplayFeedback("Detection in progress, remain still...");
        }
      }
    } else if (analysisState.imageBlobArray.length == 1) {
      // instead of 1 have something else to calculate inside frame
      if (!isSideInsideFrame) {
        console.log("sidePose but not inside frame ********");
        analysisState.state = "start_2";
        analysisState.validSince = null;
        DisplayFeedback("Please stand inside the frame");
      } else {
        if (!analysisState.validSince) {
          analysisState.validSince = now;
        }
        if (now - analysisState.validSince >= REQUIRED_TIME) {
          switch (analysisState.state) {
            case "start_2":
              updateSilhouette("start_2");
              analysisState.state = "detecting_two";
              DisplayFeedback("Please rotate 90° to your left");
              analysisState.validSince = now;
              // We'll rely on the user physically rotating
              break;

            case "detecting_two":
              if (isClassifying) break;
              isClassifying = true;
              const result2 = await collapsePose(video);
              if (
                result2.poseName === "side-view" &&
                result2.poseConfidence > 0.7
              ) {
                DisplayFeedback("Pose Detected, taking photo");
                analysisState.state = "ready_two";
                analysisState.validSince = now;
              } else {
                console.log("result2", result2);
                DisplayFeedback("Please match the silhouette with your body");
                isClassifying = false;
                return;
              }
              isClassifying = false;
              break;

            case "ready_two":
              DisplayFeedback("Taking side photo...");
              returnPhotoRef("side", (err, result) => {
                if (err) {
                  console.error("Capture Photo method failed", err);
                } else {
                  console.log("Saved side image:", result);
                  analysisState.imageBlobArray.push(result);
                  analysisState.state = "upload_photo";
                  analysisState.validSince = now;
                  analysisState.sideImageTensor = result.tensor;
                  DisplayFeedback("Ready to upload photos...");
                }
              });
              break;

            default:
              // If state is unrecognized, reset to “start”
              // deadcode will never happen
              console.log("analysisState", analysisState.state);
              analysisState.state = "start_2";
              analysisState.validSince = now;
              DisplayFeedback("Resetting detection. Please stand still.");
              break;
          }
        } else {
          // DisplayFeedback("Detection in progress, remain still...");
        }
      }
    } else {
      console.log("all pictures are taken ");
    }
  }

  function returnPhotoRef(url_modifier, callback) {
    console.log("Capturing photo for", url_modifier);
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;

    const ctx = tempCanvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-");
    const filename = `${url_modifier}_${timestamp}.jpg`;

    tempCanvas.toBlob(
      (blob) => {
        if (!blob) {
          console.error("Failed to capture image as Blob.");
          if (callback) callback(new Error("Failed to create Blob"), null);
          return;
        }
        console.log("Photo captured:", filename);
        if (callback) {
          callback(null, {
            filename,
            blob,
            tensor: tf.browser.fromPixels(tempCanvas),
          });
        }
      },
      "image/jpeg",
      0.99,
    );
  }
});

const showElement = (ele) => {
  ele.classList.add("visible");

  ele.classList.remove("hidden");
};

const hideElement = (ele) => {
  ele.classList.add("hidden");
  ele.classList.remove("visible");
};

function initializeElements() {
  return {
    camerascanclass2: document.getElementById("CameraScan-class2"),
    camerascanclass1: document.getElementById("CameraScan-class1"),
    productInfo: document.getElementById("sizing-data"),
    canvas: document.getElementById("camera-output"),
    video: document.getElementById("camera-preview"),
    overlay: document.getElementById("modal-overlay"),
    mainContent: document.getElementById("modal-content"),
    openButton: document.getElementById("open-modal"),
    onboardWelcome: document.getElementById("onboard-welcome"),
    onboardUserInput: document.getElementById("onboard-user-input"),
    onboardCameraPrompt: document.getElementById("onboard-camera-prompt"),
    onboardCameraGuidelines: document.getElementById(
      "onboard-camera-guidelines",
    ),
    onboardCameraPosition: document.getElementById("onboard-camera-position"),
    recommendationContent: document.getElementById("recommendation-content"),
    CameraScan: document.getElementById("CameraScan"),
    userDetailForm: document.getElementById("user-detail-form"),
    onboardWelcomeNext: document.getElementById("onboard-welcome-next"),
    onboardUserInputNext: document.getElementById("onboard-user-input-next"),
    onboardCameraPromptNext: document.getElementById(
      "onboard-camera-prompt-next",
    ),
    onboardCameraPromptManual: document.getElementById(
      "onboard-camera-prompt-manual",
    ),
    onboardCameraGuidelinesNext: document.getElementById(
      "onboard-camera-guidelines-next",
    ),
    onboardCameraPositionNext: document.getElementById(
      "onboard-camera-position-next",
    ),
    CameraScanNext: document.getElementById("CameraScan-next"),
    genderInput: document.getElementById("gender-input"),
    heightInput: document.getElementById("height-input"),
    weightInput: document.getElementById("weight-input"),
    ageInput: document.getElementById("age-input"),
    sizingCardContainer: document.getElementById("sizing-cards-container"),
    screenFit: document.getElementById("screen-fit"),
    screenProfile: document.getElementById("screen-profile"),
    screenProfileMeasurementDetails: document.getElementById(
      "screen-profile-measurement-details",
    ),
    screenProfileMeasurementEdit: document.getElementById(
      "screen-profile-measurement-edit",
    ),
    userMeasurementForm: document.getElementById("user-measurement-form"),
    tabFitBtn: document.getElementById("tab-fit-btn"),
    tabProfileBtn: document.getElementById("tab-profile-btn"),
    profileEditMeasurementBtn: document.getElementById(
      "profile-edit-measurement-btn",
    ),
    profileMeasurementManualConfirmChangeBtn: document.getElementById(
      "profile-measurement-manual-confirm-change-btn",
    ),
    shoulderInput: document.getElementById("shoulder-input"),
    chestInput: document.getElementById("chest-input"),
    hipInput: document.getElementById("hip-input"),
    waistInput: document.getElementById("waist-input"),
    torsoInput: document.getElementById("torso-input"),
    armInput: document.getElementById("arm-input"),
    legInput: document.getElementById("leg-input"),
    thighInput: document.getElementById("thigh-input"),
  };
}

function setupModalOpenClose(openButton, overlay) {
  openButton.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    overlay.classList.add("visible");
    // mainContent.classList.remove("hidden");
    // mainContent.classList.add("visible");
  });

  // Close modal if user clicks *outside* modal-content
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.classList.remove("visible");
      overlay.classList.add("hidden");
      // mainContent.classList.remove("visible");
      // mainContent.classList.add("hidden");
    }
  });
}

function setupOnboardingNavigation(
  screens,
  nextBtns,
  userDetailForm,
  userDetailArray,
  cameraController,
  sizes,
  categories,
  recommendationScreenArray,
  extraElements,
) {
  nextBtns.forEach((btn, index) => {
    if (!btn) return;
    // Special handling for the user input screen with validation
    if (
      btn === nextBtns[1]
      // onboardUserInputNext
    ) {
      btn.addEventListener("click", () => {
        if (userDetailForm.checkValidity()) {
          saveOnboardingUserDetails(userDetailArray, userDetailForm);
          screens.forEach((screen) => hideElement(screen));
          showElement(screens[index + 1]);
        } else {
          userDetailForm.reportValidity();
          console.error("Form is invalid. Please correct the errors.");
        }
      });
    } else if (btn === nextBtns[4]) {
      btn.addEventListener("click", () => {
        screens.forEach((screen) => hideElement(screen));
        showElement(screens[index + 1]);
        cameraController.startCamera();
        document.querySelector(".modal-content").classList.add("cameraScan");
      });
    } else if (btn === nextBtns[5]) {
      btn.addEventListener("click", () => {
        document.querySelector(".modal-content").classList.remove("cameraScan");
        screens.forEach((screen) => hideElement(screen));
        showElement(screens[index + 1]);

        // doing glider modifications here
        const gliderElement = document.querySelector(".glider");
        gliderElement.innerHTML = ""; // Clear any existing slides

        sizes.forEach((size, index) => {
          const slide = document.createElement("div");
          slide.classList.add("slide");
          slide.setAttribute("data-slide", index + 1);
          slide.setAttribute("tabindex", "0");
          slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
          gliderElement.appendChild(slide);
        });
        glider = new Glider(document.querySelector(".glider"), {
          slidesToShow: 1,
          dots: ".dots",
          draggable: true,
          scrollLock: true,
          rewind: true,
          arrows: {
            prev: ".glider-prev",
            next: ".glider-next",
          },
        });
        var numberOfSliders = document.querySelectorAll(".glider-slide").length;

        glider.refresh();

        function getPreviousSlide(currentSlide) {
          if (currentSlide === 1) {
            return numberOfSliders;
          } else {
            return currentSlide - 1;
          }
        }

        function goToPreviousSlide(currentSlide) {
          var previousSlide = getPreviousSlide(currentSlide);
          var imageContent = document.querySelector(
            `.glider-slide:nth-of-type(${previousSlide})`,
          );
        }

        function getNextSlide(currentSlide) {
          if (currentSlide === numberOfSliders) {
            return 1;
          } else {
            return currentSlide + 1;
          }
        }

        function goToNextSlide(currentSlide) {
          var previousSlide = getNextSlide(currentSlide);
          var imageContent = document.querySelector(
            `.glider-slide:nth-of-type(${previousSlide})`,
          );
        }

        document
          .querySelector(".glider-prev")
          .addEventListener("click", function () {
            var currentSlide = parseInt(
              document
                .querySelector(".glider-slide.active")
                .getAttribute("data-slide"),
            );
            goToPreviousSlide(currentSlide);
          });

        document
          .querySelector(".glider-next")
          .addEventListener("click", function () {
            var currentSlide = parseInt(
              document
                .querySelector(".glider-slide.active")
                .getAttribute("data-slide"),
            );
            goToNextSlide(currentSlide);
          });

        // Listen for the 'glider-slide-visible' event to know when the slide changes
        document
          .querySelector(".glider")
          .addEventListener("glider-slide-visible", function (event) {
            // event.detail.slide gives the index of the new active slide.
            // This index might start at 0 or 1 based on Glider.js configuration.
            console.log("New active slide is:", event.detail.slide);
            // event.detail.slide is the new active slide's index (assuming 0-based)
            let activeIndex = event.detail.slide;
            let activeSize = sizes[activeIndex]; // For example, "M"

            // Retrieve the size range data for the active size
            let currentSizeData = sizingData.sizes[activeSize];

            // For each category (e.g., chest, torso, etc.)
            categories.forEach((category) => {
              // Get the user's measurement for this category (assumes userInfo is kept updated)
              let userMeasurement = userInfo[category];

              // Get the measurement range for the current size and category
              let range = currentSizeData[category];

              if (range && userMeasurement) {
                // Evaluate the fit (e.g., "Too Small", "Just Right", or "Too Big")
                let fitResult = evaluateFit(userMeasurement, range);

                // Update the corresponding recommendation card's text
                // Assuming each recommender card has a data attribute matching the category in lowercase.
                let card = document.querySelector(
                  `.sizing-card[data-category="${category.toLowerCase()}"] p`,
                );
                if (card) {
                  card.textContent = fitResult;
                }
              }
            });
          });
        //ending
      });
    } else if (btn === nextBtns[6]) {
      //onboardCameraPromptManual for manual measurement input
      //show recommendation content screen
      btn.addEventListener("click", () => {
        //hide all onboarding screens
        screens.forEach((screen) => hideElement(screen));
        //show recommendation content screen
        // recommendation content screen is last element of screens array
        showElement(screens[screens.length - 1])
        
        //first get glider working when at recommendation content, then move to edit screen
        const gliderElement = document.querySelector(".glider");
        gliderElement.innerHTML = ""; // Clear any existing slides
 
        sizes.forEach((size, index) => {
          const slide = document.createElement("div");
          slide.classList.add("slide");
          slide.setAttribute("data-slide", index + 1);
          slide.setAttribute("tabindex", "0");
          slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
          gliderElement.appendChild(slide);
        });
        glider = new Glider(document.querySelector(".glider"), {
          slidesToShow: 1,
          dots: ".dots",
          draggable: true,
          scrollLock: true,
          rewind: true,
          arrows: {
            prev: ".glider-prev",
            next: ".glider-next",
          },
        });
        var numberOfSliders = document.querySelectorAll(".glider-slide").length;

        glider.refresh();

        function getPreviousSlide(currentSlide) {
          if (currentSlide === 1) {
            return numberOfSliders;
          } else {
            return currentSlide - 1;
          }
        }

        function goToPreviousSlide(currentSlide) {
          var previousSlide = getPreviousSlide(currentSlide);
          var imageContent = document.querySelector(
            `.glider-slide:nth-of-type(${previousSlide})`,
          );
        }

        function getNextSlide(currentSlide) {
          if (currentSlide === numberOfSliders) {
            return 1;
          } else {
            return currentSlide + 1;
          }
        }

        function goToNextSlide(currentSlide) {
          var previousSlide = getNextSlide(currentSlide);
          var imageContent = document.querySelector(
            `.glider-slide:nth-of-type(${previousSlide})`,
          );
        }

        document
          .querySelector(".glider-prev")
          .addEventListener("click", function () {
            var currentSlide = parseInt(
              document
                .querySelector(".glider-slide.active")
                .getAttribute("data-slide"),
            );
            goToPreviousSlide(currentSlide);
          });

        document
          .querySelector(".glider-next")
          .addEventListener("click", function () {
            var currentSlide = parseInt(
              document
                .querySelector(".glider-slide.active")
                .getAttribute("data-slide"),
            );
            goToNextSlide(currentSlide);
          });

        // Listen for the 'glider-slide-visible' event to know when the slide changes
        document
          .querySelector(".glider")
          .addEventListener("glider-slide-visible", function (event) {
            // event.detail.slide gives the index of the new active slide.
            // This index might start at 0 or 1 based on Glider.js configuration.
            console.log("New active slide is:", event.detail.slide);
            // event.detail.slide is the new active slide's index (assuming 0-based)
            let activeIndex = event.detail.slide;
            let activeSize = sizes[activeIndex]; // For example, "M"

            // Retrieve the size range data for the active size
            let currentSizeData = sizingData.sizes[activeSize];

            // For each category (e.g., chest, torso, etc.)
            categories.forEach((category) => {
              // Get the user's measurement for this category (assumes userInfo is kept updated)
              let userMeasurement = userInfo[category];

              // Get the measurement range for the current size and category
              let range = currentSizeData[category];

              if (range && userMeasurement) {
                // Evaluate the fit (e.g., "Too Small", "Just Right", or "Too Big")
                let fitResult = evaluateFit(userMeasurement, range);

                // Update the corresponding recommendation card's text
                // Assuming each recommender card has a data attribute matching the category in lowercase.
                let card = document.querySelector(
                  `.sizing-card[data-category="${category.toLowerCase()}"] p`,
                );
                if (card) {
                  card.textContent = fitResult;
                }
              }
            });
          });

        //navigate to the edit measurement screen
        console.log(recommendationScreenArray);
        showElement(recommendationScreenArray[1]);
        hideElement(recommendationScreenArray[0]);
        hideElement(recommendationScreenArray[2]);
        showElement(recommendationScreenArray[3]);  
        console.log(extraElements);
        //change the active tab button ui
        extraElements.tabFitBtn.classList.remove("active");
        extraElements.tabProfileBtn.classList.add("active");
        
      });
    } else {
      btn.addEventListener("click", () => {
        screens.forEach((screen) => hideElement(screen));
        showElement(screens[index + 1]);
      });
    }
    

  });
}

const saveOnboardingUserDetails = (userDetailArray, form) => {
  if (!Array.isArray(userDetailArray)) {
    console.error("Invalid userDetailArray provided. Expected an array.");
    return;
  }

  console.log("Saving Onboarding User Details...");

  const updates = {};

  userDetailArray.forEach((inputEle) => {
    try {
      if (!inputEle || !inputEle.name) {
        throw new Error("Input element missing or has no name attribute");
      }

      const value = inputEle.value;
      if (value === "" || value === undefined) {
        console.warn(`Empty value for input with name "${inputEle.name}"`);
        return;
      }

      updates[inputEle.name] = value;
    } catch (error) {
      console.error(
        "Error processing onboarding input element:",
        error,
        inputEle,
      );
    }
  });

  updateUserInfo(updates);
  console.log("Onboarding Details saved:", userInfo);
};

function updateUserInfo(updates) {
  //takes in object, can handle partial objects
  Object.keys(updates).forEach((key) => {
    if (userInfo.hasOwnProperty(key)) {
      userInfo[key] = updates[key];
    }
  });
}

function updateMeasurementCards() {
  const cards = document.querySelectorAll(".measurement-card");

  cards.forEach((card) => {
    const cardId = card.id; // e.g. "arm-measurement-card"
    const parts = cardId.split("-"); // ["arm", "measurement", "card"]
    const key = parts[0]; // "arm"

    if (userInfo.hasOwnProperty(key)) {
      const value = userInfo[key];

      // Find the <p> element that holds the value (assume it's the second <p>)
      const valueElement = card.querySelectorAll("p")[1];

      if (valueElement) {
        valueElement.textContent = value ? `${value}cm` : "N/A";
      }
    }
  });
}

function setupRecommendationNavigation(
  buttons,
  extraElements,
  userMeasurementForm,
  measurementInputArray,
  userInfo,
  userDetailArray,
) {
  const {
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn,
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit,
  } = extraElements;

  buttons.forEach((btn) => {
    if (btn === tabFitBtn) {
      btn.addEventListener("click", () => {
        console.log("Fit tab clicked");
        showElement(screenFit);
        hideElement(screenProfile);
        hideElement(screenProfileMeasurementDetails);
        hideElement(screenProfileMeasurementEdit);
        tabFitBtn.classList.add("active");
        tabProfileBtn.classList.remove("active");
      });
    } else if (btn === tabProfileBtn) {
      btn.addEventListener("click", () => {
        showElement(screenProfile);
        showElement(screenProfileMeasurementDetails);
        hideElement(screenFit);
        hideElement(screenProfileMeasurementEdit);
        tabProfileBtn.classList.add("active");
        tabFitBtn.classList.remove("active");
      });
    } else if (btn === profileEditMeasurementBtn) {
      btn.addEventListener("click", () => {
        showElement(screenProfile);
        hideElement(screenFit);
        hideElement(screenProfileMeasurementDetails);
        showElement(screenProfileMeasurementEdit);
      });
    } else if (btn === profileMeasurementManualConfirmChangeBtn) {
      btn.addEventListener("click", () => {
        // Check if the form is valid before proceeding
        if (userMeasurementForm.checkValidity()) {
          saveProfileMeasurementDetails(
            measurementInputArray,
            userMeasurementForm,
            userInfo,
            userDetailArray,
          );
          showElement(screenProfile);
          showElement(screenProfileMeasurementDetails);
          hideElement(screenFit);
          hideElement(screenProfileMeasurementEdit);
        } else {
          userMeasurementForm.reportValidity();
          console.error("Form is invalid. Please correct the errors.");
        }
      });
    }
  });
}

const saveProfileMeasurementDetails = (measurementInputArray) => {
  if (!Array.isArray(measurementInputArray)) {
    console.error("Invalid measurementInputArray provided. Expected an array.");
    return;
  }

  console.log("Saving Profile Measurements...");

  const updates = {};

  measurementInputArray.forEach((inputEle) => {
    try {
      if (!inputEle || !inputEle.name) {
        throw new Error("Input element missing or has no name attribute");
      }

      const value = inputEle.value;
      if (value === "" || value === undefined) {
        console.warn(`Empty value for input with name "${inputEle.name}"`);
        return;
      }

      updates[inputEle.name] = value;
    } catch (error) {
      console.error("Error processing input element:", error, inputEle);
    }
  });

  updateUserInfo(updates);
  console.log("Profile Measurements saved:", userInfo);

  updateMeasurementCards();
};

function DisplayFeedback(message) {
  const userFeedback = document.getElementById("user-feedback");
  if (userFeedback.innerHTML === message) return;
  userFeedback.innerHTML = message;
}

function updateSilhouette(mode) {
  const silhouette = document.getElementById("expected-silhouette");
  if (!silhouette) return;

  switch (mode) {
    case "start":
      // console.log("silhouette start");
      silhouette.style.opacity = "0.3";
      break;
    case "start_2":
      // “detecting_one” or “ready_one” => silhouette 30%
      silhouette.style.opacity = "0.3";
      silhouette.src = silhouette.dataset.side;
      break;
    case "disable":
      silhouette.style.opacity = "0";
      break;
    default:
      console.error("Invalid mode");
      break;
  }
}

function evaluateFit(userMeasurement, range) {
  console.log(range);
  // Ensure both values are numbers (if needed, parseFloat)
  userMeasurement = parseFloat(userMeasurement);
  if (userMeasurement < range.min) {
    return "Too Big";
  } else if (userMeasurement > range.max) {
    return "Too Small";
  } else {
    return "Just Right";
  }
}

//dictionary storage of user information

//////////////////RECOMMENDER CAROUSEL PORTION///////////////////////////////

// if (sizes && sizes.length > 0) {
//   const gliderElement = document.querySelector('.glider');
//   gliderElement.innerHTML = ""; // Clear any existing slides

//   sizes.forEach((size, index) => {
//     const slide = document.createElement('div');
//     slide.classList.add('slide');
//     slide.setAttribute('data-slide', index + 1);
//     slide.setAttribute('tabindex', '0');
//     slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
//     gliderElement.appendChild(slide);
//   });
// }
// var glider = new Glider(document.querySelector('.glider'), {
//   slidesToShow: 1,
//   dots: '.dots',
//   draggable: true,
//   scrollLock: true,
//   rewind: true,
//   arrows: {
//     prev: '.glider-prev',
//     next: '.glider-next'
//   }
// });

// // console.log(glider)
// var numberOfSliders = document.querySelectorAll('.glider-slide').length

// function getPreviousSlide(currentSlide) {
//   if (currentSlide === 1) {
//     return numberOfSliders;
//   } else {
//     return currentSlide - 1;
//   }
// }

// function goToPreviousSlide(currentSlide) {
//     var previousSlide = getPreviousSlide(currentSlide);
//     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
//     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
// }

// function getNextSlide(currentSlide) {
//   if (currentSlide === numberOfSliders) {
//     return 1;
//   } else {
//     return currentSlide + 1;
//   }
// }

// function goToNextSlide(currentSlide) {
//     var previousSlide = getNextSlide(currentSlide);
//     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
//     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
// }

// document.querySelector('.glider-prev').addEventListener("click", function() {
//   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
//   goToPreviousSlide(currentSlide)
// });

// document.querySelector('.glider-next').addEventListener("click", function() {
//   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
//   goToNextSlide(currentSlide)
// });

// // Listen for the 'glider-slide-visible' event to know when the slide changes
// document.querySelector('.glider').addEventListener('glider-slide-visible', function(event) {
//   // event.detail.slide gives the index of the new active slide.
//   // This index might start at 0 or 1 based on Glider.js configuration.
//   console.log('New active slide is:', event.detail.slide);
//   // event.detail.slide is the new active slide's index (assuming 0-based)
//   let activeIndex = event.detail.slide;
//   let activeSize = sizes[activeIndex];  // For example, "M"

//   // Retrieve the size range data for the active size
//   let currentSizeData = sizingData.sizes[activeSize];

//   // For each category (e.g., chest, torso, etc.)
//   categories.forEach(category => {
//     // Get the user's measurement for this category (assumes userInfo is kept updated)
//     let userMeasurement = userInfo[category];

//     // Get the measurement range for the current size and category
//     let range = currentSizeData[category];

//     if (range && userMeasurement) {
//       // Evaluate the fit (e.g., "Too Small", "Just Right", or "Too Big")
//       let fitResult = evaluateFit(userMeasurement, range);

//       // Update the corresponding recommendation card's text
//       // Assuming each recommender card has a data attribute matching the category in lowercase.
//       let card = document.querySelector(`.sizing-card[data-category="${category.toLowerCase()}"] p`);
//       if (card) {
//         card.textContent = fitResult;
//       }
//     }
//   });

// });
//////////////////////////////////////////////////////////////////////////helper functions

// Assuming sizes is an array like ["s", "m", "l"]
// if (sizes && sizes.length > 0) {
//   const gliderElement = document.querySelector('.glider');
//   gliderElement.innerHTML = ""; // Clear any existing slides

//   sizes.forEach((size, index) => {
//     const slide = document.createElement('div');
//     slide.classList.add('slide');
//     slide.setAttribute('data-slide', index + 1);
//     slide.setAttribute('tabindex', '0');
//     slide.innerHTML = `<h1>${size.toUpperCase()}</h1>`;
//     gliderElement.appendChild(slide);
//   });
// } else {
//     // Otherwise, initialize it
//     glider = new Glider(gliderElement, {
//       slidesToShow: 1,
//       dots: '.dots',
//       draggable: true,
//       scrollLock: true,
//       rewind: true,
//       arrows: {
//         prev: '.glider-prev',
//         next: '.glider-next'
//       }
//     });
// }

// let numberOfSliders = document.querySelectorAll('.glider-slide').length

// function getPreviousSlide(currentSlide) {
//   if (currentSlide === 1) {
//     return numberOfSliders;
//   } else {
//     return currentSlide - 1;
//   }
// }

// function goToPreviousSlide(currentSlide) {
//     var previousSlide = getPreviousSlide(currentSlide);
//     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
//     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
// }

// function getNextSlide(currentSlide) {
//   if (currentSlide === numberOfSliders) {
//     return 1;
//   } else {
//     return currentSlide + 1;
//   }
// }

// function goToNextSlide(currentSlide) {
//     var previousSlide = getNextSlide(currentSlide);
//     var imageContent = document.querySelector(`.glider-slide:nth-of-type(${previousSlide})`);
//     document.querySelector('#hidden-image').innerHTML = imageContent.innerHTML;
// }

// document.querySelector('.glider-prev').addEventListener("click", function() {
//   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
//   goToPreviousSlide(currentSlide)
// });

// document.querySelector('.glider-next').addEventListener("click", function() {
//   var currentSlide = parseInt(document.querySelector('.glider-slide.active').getAttribute('data-slide'));
//   goToNextSlide(currentSlide)
// });

// // Listen for the 'glider-slide-visible' event to know when the slide changes
// document.querySelector('.glider').addEventListener('glider-slide-visible', function(event) {
//   // event.detail.slide gives the index of the new active slide.
//   // This index might start at 0 or 1 based on Glider.js configuration.
//   console.log('New active slide is:', event.detail.slide);
// });

//Camera Scan code

//initFirebase(firebaseConfig);
