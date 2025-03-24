//array to store screen id


//variable storage for user
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

document.addEventListener("DOMContentLoaded", () => {
/*--------------------------------------------------------------SETUPS--------------------------------------------------------------------------*/
  // 1. Grab references to all your elements
  const overlay = document.getElementById("modal-overlay");
  // -- NEW: Append overlay to <body> so it's not nested in a limiting container --
  document.body.appendChild(overlay);

  const productInfo = document.getElementById("sizing-data");
  //sizes: keys of the sizes object (eg s,m,l etc...) (used to generate carousel)
  let sizes;
  //categories: category of sizing (chest, shoulder, leg, waist etc...) (use to generate recommender card, with )
  let categories;
  //ensure product info exist
  if (productInfo) {
    try {
      let scriptTag = document.getElementById("sizing-data");
      const sizingData = JSON.parse(scriptTag.textContent);
      const sizeObj = sizingData.sizes
      console.log(sizingData);
      sizes = Object.keys(sizingData.sizes);
      categories = Object.keys(sizeObj[sizes[0]]); // ["torso", "shoulder", "chest", "sleeve"]

      console.log("Sizes:", sizes);
      console.log("Categories:", categories);
      
    } catch (error) {
      console.error("Failed to parse sizing JSON", error);
    }
  }

  //now we dissect into types of size (s,m,l etc...) and size categories (chest, shoulder, sleeve etc...)




  //dictionary storage of user information
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
    thigh: null
  };
  
  //takes in object, can handle partial objects
  function updateUserInfo(updates) {
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

  //helper functions
  const showElement = (ele) => {
    ele.classList.add("visible");
    ele.classList.remove("hidden");
  }

  const hideElement = (ele) => {
    ele.classList.add("hidden");
    ele.classList.remove("visible");
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
    console.log("running construct recommender card function")
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
        console.error("Error processing onboarding input element:", error, inputEle);
      }
    });
  
    updateUserInfo(updates);
    console.log("Onboarding Details saved:", userInfo);
  };
  

  const mainContent = document.getElementById("modal-content");
  const openButton = document.getElementById("open-modal");

    // 4. Event handlers: open/close the modal
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
/*-------------------------------------------------------------------- -------------------------------------------------------------------*/
/*--------------------------------------------------------------------ONBOARDING-------------------------------------------------------------------*/

  //Grab reference to screenIds
  const onboardWelcome = document.getElementById("onboard-welcome");
  const onboardUserInput = document.getElementById("onboard-user-input");
  const onboardCameraPrompt = document.getElementById("onboard-camera-prompt");
  const onboardCameraGuidelines = document.getElementById("onboard-camera-guidelines");
  const onboardCameraPosition = document.getElementById("onboard-camera-position");
  const recommendationContent = document.getElementById("recommendation-content");


  const userDetailForm = document.getElementById("user-detail-form");

   //store as array
   const onboardScreensArray = [
    onboardWelcome,
    onboardUserInput,
    onboardCameraPrompt,
    onboardCameraGuidelines,
    onboardCameraPosition,
    recommendationContent
  ];

  //Grab reference to buttons
  const onboardWelcomeNext = document.getElementById("onboard-welcome-next");
  const onboardUserInputNext = document.getElementById("onboard-user-input-next");

  const onboardCameraPromptNext = document.getElementById("onboard-camera-prompt-next");
  const onboardCameraPromptManual = document.getElementById("onboard-camera-prompt-manual");

  const onboardCameraGuidelinesNext = document.getElementById("onboard-camera-guidelines-next");
  const onboardCameraPositionNext = document.getElementById("onboard-camera-position-next");
  //store as array
  const onboardNextBtnsArray = [
    onboardWelcomeNext,
    onboardUserInputNext,
    onboardCameraPromptNext,
    onboardCameraGuidelinesNext,
    onboardCameraPositionNext
  ];
  //EVENTS

  //onboarding screen navigating
  //setup listeners to hide and show onboard screens
  onboardNextBtnsArray.forEach((btn, index) => {
    if(btn == onboardCameraPositionNext) {
      btn.addEventListener("click",() => {
        onboardScreensArray.forEach(screen => hideElement(screen));
      })
    }

    if (btn) {  // Ensure button exists
      if (btn == onboardUserInputNext) { // special rule for form validation
        btn.addEventListener("click", () => {
          // Check if the form is valid
          if (userDetailForm.checkValidity()) {
            saveOnboardingUserDetails(userDetailArray, userDetailForm);
            onboardScreensArray.forEach(screen => hideElement(screen));
          // Show next screen 
          showElement(onboardScreensArray[index + 1]);
          } else {
            // Trigger native validation messages
            userDetailForm.reportValidity();
            console.error("Form is invalid. Please correct the errors.");
          }
        });
      } else {
        btn.addEventListener("click", () => {
          // Hide all screens
          onboardScreensArray.forEach(screen => hideElement(screen));
          
          // Show next screen 
          showElement(onboardScreensArray[index + 1]);
        });
      }

    }

    if (btn == onboardUserInputNext) {
      
    }
  });

  //onboarding inputs
  const genderInput = document.getElementById("gender-input");
  const heightInput = document.getElementById("height-input");
  const weightInput = document.getElementById("weight-input");
  const ageInput = document.getElementById("age-input");

  const userDetailArray = [
    genderInput,
    heightInput,
    weightInput,
    ageInput
  ]
  //Grab References to pose figure
  //ask tristan and lucas
/*---------------------------------------------------------------------------------------------------------------------------------------*/

/*--------------------------------------------------------------------RECOMMENDATIONS -------------------------------------------------------------------*/
  const sizingCardContainer = document.getElementById("sizing-cards-container");
  const screenFit = document.getElementById("screen-fit");
  const screenProfile = document.getElementById("screen-profile");
  const screenProfileMeasurementDetails = document.getElementById("screen-profile-measurement-details");
  const screenProfileMeasurementEdit = document.getElementById("screen-profile-measurement-edit");


  const userMeasurementForm = document.getElementById("user-measurement-form");

  const tabFitBtn = document.getElementById("tab-fit-btn");
  const tabProfileBtn = document.getElementById("tab-profile-btn");
  const profileEditMeasurementBtn = document.getElementById("profile-edit-measurement-btn");
  const profileMeasurementManualConfirmChangeBtn = document.getElementById("profile-measurement-manual-confirm-change-btn");

  //measurement inputs
  const shoulderInput = document.getElementById("shoulder-input");
  const chestInput = document.getElementById("chest-input");
  const hipInput = document.getElementById("hip-input");
  const waistInput = document.getElementById("waist-input");
  const torsoInput = document.getElementById("torso-input");
  const armInput = document.getElementById("arm-input");
  const legInput = document.getElementById("leg-input");
  const thighInput = document.getElementById("thigh-input");



  const recommendationScreenArray = [
    screenFit,
    screenProfile,
    screenProfileMeasurementDetails,
    screenProfileMeasurementEdit
  ]

  const recommendationScreenBtn = [
    tabFitBtn,
    tabProfileBtn,
    profileEditMeasurementBtn,
    profileMeasurementManualConfirmChangeBtn
  ]

  const measurementInputArray = [
    shoulderInput,
    chestInput,
    hipInput,
    waistInput,
    torsoInput,
    armInput,
    legInput,
    thighInput
  ]
  //////////////////////////NAVIGATIONS//////////////////////////
  recommendationScreenBtn.forEach((btn, index) => {
    switch(btn) {
      case tabFitBtn:
        btn.addEventListener("click",() => {
          showElement(screenFit);
          hideElement(screenProfile);
          hideElement(screenProfileMeasurementDetails);
          hideElement(screenProfileMeasurementEdit);
          
          tabFitBtn.classList.add("active");
          tabProfileBtn.classList.remove("active");
        })  

        break;      

      case tabProfileBtn:
        btn.addEventListener("click",() => {
          showElement(screenProfile);
          showElement(screenProfileMeasurementDetails);
          hideElement(screenFit);
          hideElement(screenProfileMeasurementEdit);
          
          tabProfileBtn.classList.add("active");
          tabFitBtn.classList.remove("active");
        })   

        
        break;
  

      case profileEditMeasurementBtn:
        btn.addEventListener("click",() => {
          showElement(screenProfile);
          hideElement(screenFit);
          hideElement(screenProfileMeasurementDetails);
          showElement(screenProfileMeasurementEdit);
        })     
        break;

      case profileMeasurementManualConfirmChangeBtn: 
        btn.addEventListener("click",() => {
          // Check if the form is valid
          // Check if the form is valid
          if (userMeasurementForm.checkValidity()) {
            saveProfileMeasurementDetails(measurementInputArray, userMeasurementForm);
            showElement(screenProfile);
            showElement(screenProfileMeasurementDetails);

            hideElement(screenFit);
            hideElement(screenProfileMeasurementEdit);
 
          } else {
            // Trigger native validation messages
            userMeasurementForm.reportValidity();
            console.error("Form is invalid. Please correct the errors.");
          }
        })     
        break;
    }

  })
  ////////////////////////////////////////////////////

  //////////////////////////Recommender section//////////////////////////
  
  //initially, run the recommender card constructor function 
  constructRecommenderCard(categories);
  //Interactivity of recommender card and svg
  const cards = document.querySelectorAll(".sizing-card");
  cards.forEach((card) => {
    const category = card.getAttribute("data-category");
    const targetSvg = document.getElementById(`${category}-recommendation-svg`);

    if (targetSvg) {
      card.addEventListener("mouseover", () => {
        const shapeElements = targetSvg.querySelectorAll('path, ellipse, line, circle, polygon, rect');
        shapeElements.forEach(shape => shape.classList.add('fill-black'));
      });

      card.addEventListener("mouseout", () => {
        const shapeElements = targetSvg.querySelectorAll('path, ellipse, line, circle, polygon, rect');
        shapeElements.forEach(shape => shape.classList.remove('fill-black'));
      });
    }

    //special Cases (sleeve, leg)
    //Special case:"sleeve" = forearm + bicep + shoulder
    if (category === "sleeve") {
      const relatedIds = [
        "forearm-recommendation-svg",
        "bicep-recommendation-svg",
        "shoulder-recommendation-svg"
      ];
  
      card.addEventListener("mouseover", () => {
        relatedIds.forEach(id => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll('path, ellipse, line, circle, polygon, rect');
            shapes.forEach(shape => shape.classList.add('fill-black'));
          }
        });
      });
  
      card.addEventListener("mouseout", () => {
        relatedIds.forEach(id => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll('path, ellipse, line, circle, polygon, rect');
            shapes.forEach(shape => shape.classList.remove('fill-black'));
          }
        });
      });
    }
  
    //Special case: "leg" = thigh + calf
    if (category === "leg") {
      const relatedIds = [
        "thigh-recommendation-svg",
        "calf-recommendation-svg"
      ];
  
      card.addEventListener("mouseover", () => {
        relatedIds.forEach(id => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll('path, ellipse, line, circle, polygon, rect');
            shapes.forEach(shape => shape.classList.add('fill-black'));
          }
        });
      });
  
      card.addEventListener("mouseout", () => {
        relatedIds.forEach(id => {
          const part = document.getElementById(id);
          if (part) {
            const shapes = part.querySelectorAll('path, ellipse, line, circle, polygon, rect');
            shapes.forEach(shape => shape.classList.remove('fill-black'));
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
  document.querySelectorAll('.measurement-card').forEach(card => {
    card.addEventListener('mouseover', () => {
      const targetId = card.getAttribute('data-target');
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        // Select all common SVG shape elements within the target group
        const shapeElements = targetElement.querySelectorAll('path, ellipse, line, circle, polygon, rect');
        shapeElements.forEach(shape => shape.classList.add('highlight'));
      }
    });
  
    card.addEventListener('mouseout', () => {
      const targetId = card.getAttribute('data-target');
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        const shapeElements = targetElement.querySelectorAll('path, ellipse, line, circle, polygon, rect');
        shapeElements.forEach(shape => shape.classList.remove('highlight'));
      }
    });
  });


  let gliderElement = document.querySelector(".glider");
  let slides = document.querySelectorAll(".slide");

  let glider = new Glider(gliderElement, {
  slidesToShow: 1,
  dots: '#dots',
  draggable: true,
  arrows: {
    prev: '.glider-prev',
    next: '.glider-next'
  }
  });

  glider.scrollItem(1, true)



  function updateActiveSlide() {
    let gliderRect = gliderElement.getBoundingClientRect();
    let centerX = gliderRect.left + gliderRect.width / 2;

    let closestSlide = null;
    let closestDistance = Infinity;
    let closestIndex = 0;

    slides.forEach((slide, index) => {
      let slideRect = slide.getBoundingClientRect();
      let slideCenter = slideRect.left + slideRect.width / 2;
      let distance = Math.abs(centerX - slideCenter);

      if (distance < closestDistance) {
        closestDistance = distance;
        closestSlide = slide;
        closestIndex = index;
      }
    });

    // Apply active style to the closest slide
    slides.forEach(slide => slide.classList.remove("active-slide"));
    if (closestSlide) closestSlide.classList.add("active-slide");

    // Snap to the closest slide
    glider.scrollItem(closestIndex, true);
    let size = document.getElementsByClassName("sizing-card")[0].getElementsByTagName("p")[0]; // Get the first <p>
    size.textContent = closestIndex;
  }

  

  // Detect active slide on scroll or button click
  gliderElement.addEventListener("scroll", () => {
    clearTimeout(window.gliderScrollTimeout);
    window.gliderScrollTimeout = setTimeout(updateActiveSlide, 200);
  });

  updateActiveSlide();
});


