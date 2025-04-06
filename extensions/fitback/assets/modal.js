//array to store screen id
import { drawSkeleton } from "./drawUtils.js";
import {
  setWorkerInstance,
  requestVersion,
  loadModel,
  classifyFrame,
} from "./workerFunctionsHelper.js";
import { initializePoseDetector, estimatePoses } from "./poseDetector.js";
import { predictSizes } from "./predictSize.js?v=789";

// Declare variables at the top of your script
let gender = "";
let height = 0;
let weight = 0;
let age = 0;
let shoulder = 0;
let hip = 0;
let arm = 0;
let leg = 0;
let chest = 0;
let waist = 0;
let torso = 0;
let thigh = 0;

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

async function collapsePose(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);

  try {
    const result = await classifyFrame(width, height, imageData.data.buffer);
    // If we got here, no errors were thrown
    return {
      poseName: result.bestClass,
      poseConfidence: result.probability,
    };
  } catch (error) {
    // If the worker or the classification logic fails:
    console.error("Error in classification:", error);
    return { poseName: null, poseConfidence: 0 };
  }
}

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
      // Create the card wrapper
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
        video.onloadeddata = () => {
          console.log("Video loaded, starting pose detection...");
          // TODO : convert this to a function to initialize the silhoutte
          const silhouette = document.getElementById("expected-silhouette");
          console.log("Silhouette element:", silhouette.src);
          silhouette.style.height = video.offsetHeight * 0.95 + "px";
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

  setupOnboardingNavigation(
    onboardScreensArray,
    onboardNextBtnsArray,
    userDetailForm,
    userDetailArray,
    cameraController,
    sizes,
    categories,
  );

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
  };
  const REQUIRED_TIME = 3000;
  let isClassifying = false;

  async function analysePose(pose, ctx) {
    const importantPoints = [
      // "nose",
      // "left_eye",
      // "right_eye",
      // "left_ear",
      // "right_ear",
      "left_shoulder",
      "right_shoulder",
      // "left_elbow",
      // "right_elbow",
      // "left_wrist",
      // "right_wrist",
      // "left_hip",
      // "right_hip",
      // "left_knee",
      // "right_knee",
      // "left_ankle",
      // "right_ankle",
    ];
    // const importantPoints = ["left_shoulder", "right_shoulder"];
    const filteredKeypoints = pose.keypoints.filter((kp) =>
      importantPoints.includes(kp.name),
    );

    const horizontalPadding = 10;
    const verticalPadding = 10;
    const left = horizontalPadding;
    const right = ctx.canvas.width - horizontalPadding;
    const top = verticalPadding;
    const bottom = ctx.canvas.height - verticalPadding;

    // Because the canvas is mirrored, x = ctx.canvas.width - kp.x
    const pointsOutsidePadding = filteredKeypoints.filter((kp) => {
      const x = ctx.canvas.width - kp.x;
      const y = kp.y;
      return x < left || x > right || y < top || y > bottom;
    });
    const isInsideFrame = pointsOutsidePadding.length === 0;
    const now = Date.now();

    // If we are in “upload_photo” state, just upload to firebase

    // analysisState.state = "final_state"; // debugging statement
    if (analysisState.state === "upload_photo") {
      //DisplayFeedback("Uploading photos to firebase...");
      DisplayFeedback("Predicting measurements...");
      updateSilhouette("disable");

      // REPLACE update to firebase with running prediction model
      //uploadToFirebase(analysisState, (err, results) => {
      //  if (err) {
      //    console.error("Upload failed:", err);
      //  } else {
      //    console.log("Upload completed, download URLs:", results);
      //    analysisState.state = "final_state";
      //    DisplayFeedback("Photo upload completed successfully.");
      //  }
      //});
      //const heightCM = 160;
      //const weightKG = 60;
      analysisState.state = "final_state";
      //analysisState.state = "final_state";
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
        console.log(camerascanclass2);
        //cameraController.deactivateCamera();
      }, 1000);

      // wait for measurements to be done, then go to the display user
      // size page
      runMeasurementPrediction();
      return;
    }

    // If user is out of frame and we are mid-flow
    if (!isInsideFrame && analysisState.state !== "start") {
      if (analysisState.imageBlobArray.length === 0) {
        analysisState.state = "detecting_one";
      } else if (analysisState.imageBlobArray.length === 1) {
        analysisState.state = "detecting_two";
      }
      analysisState.validSince = null;
      const msg = "Please stand inside the frame";
      if (analysisState.lastFeedback !== msg) {
        DisplayFeedback(msg);
        analysisState.lastFeedback = msg;
      }
      return;
    }

    // Show the silhouette (30% opacity, front or side)
    updateSilhouette("start");

    // If inside the frame, increment time. Once we’re steady for REQUIRED_TIME, do a new state action
    if (isInsideFrame) {
      if (!analysisState.validSince) {
        analysisState.validSince = now;
        if (now - analysisState.validSince >= REQUIRED_TIME) {
          switch (analysisState.state) {
            case "start":
              console.log("Transitioning to detecting_one");
              analysisState.state = "detecting_one";
              analysisState.validSince = now;
              DisplayFeedback("Detecting your pose...");
              break;
            case "detecting_one":
              if (isClassifying) break;
              isClassifying = true;
              const result1 = await collapsePose(canvas);
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
                  DisplayFeedback("Please rotate 90° to the right");
                }
              });
              break;

            case "start_2":
              analysisState.state = "detecting_two";
              analysisState.validSince = now;
              updateSilhouette("start_2");
              // We'll rely on the user physically rotating
              break;

            case "detecting_two":
              if (isClassifying) break;
              isClassifying = true;
              const result2 = await collapsePose(canvas);
              if (
                result2.poseName === "side-view" &&
                result2.poseConfidence > 0.7
              ) {
                DisplayFeedback("Pose Detected, taking photo");
                analysisState.state = "ready_two";
                analysisState.validSince = now;
              } else {
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
              analysisState.state = "start";
              analysisState.validSince = now;
              DisplayFeedback("Resetting detection. Please stand still.");
              break;
          }
        } else {
          // Not enough consecutive frames yet
          const msg = "Detection in progress, remain still...";
          if (analysisState.lastFeedback !== msg) {
            DisplayFeedback(msg);
            analysisState.lastFeedback = msg;
          }
        }
      } else {
        // If we are in “start” but not inside the frame
        if (analysisState.state === "start") {
          const msg = "Please match the silhouette with your body";
          if (analysisState.lastFeedback !== msg) {
            DisplayFeedback(msg);
            analysisState.lastFeedback = msg;
          }
        }
      }
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
