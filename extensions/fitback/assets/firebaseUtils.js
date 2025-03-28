export function initFirebase(firebaseConfig) {
  // Initialize Firebase app
  firebase.initializeApp(firebaseConfig);

  // Sign in anonymously
  firebase
    .auth()
    .signInAnonymously()
    .then(() => {
      console.log("Signed in anonymously");
    })
    .catch((error) => {
      console.error("Anonymous sign-in failed:", error);
    });

  // Listen for auth state changes
  firebase.auth().onAuthStateChanged((user) => {
    if (user) {
      console.log("User is authenticated, UID:", user.uid);
    } else {
      console.log("No user authenticated.");
    }
  });
}
export function uploadToFirebase(analysisState, callback) {
  // Check if Firebase has been initialized
  try {
    firebase.app();
  } catch (error) {
    return callback(new Error("Firebase has not been initialized"), null);
  }
  const user = firebase.auth().currentUser;
  if (!user) {
    return callback(new Error("User is not authenticated"), null);
  }

  // Prevent duplicate uploads if already done or in progress.
  if (analysisState.uploadedInfo) {
    return callback(null, "Already uploaded");
  }
  if (analysisState.uploadInProgress) {
    console.log("Upload already in progress; skipping duplicate upload.");
    return;
  }

  console.log("Upload to firebase being called");
  analysisState.uploadInProgress = true;

  // Get the storage reference here after the app has been initialized.
  const storageRef = firebase.storage();

  // Create an array of promises for each image upload.
  const uploadPromises = analysisState.imageBlobArray.map((imageObj) => {
    const fileRef = storageRef.ref("photos/" + imageObj.filename);
    // Upload the blob.
    return fileRef.put(imageObj.blob).then((snapshot) => {
      console.log("Uploaded photo:", snapshot);
      // Return the download URL.
      return fileRef.getDownloadURL();
    });
  });

  // Wait for all upload promises to complete.
  Promise.all(uploadPromises)
    .then((downloadURLs) => {
      analysisState.uploadedInfo = true;
      analysisState.uploadInProgress = false;
      console.log("All images uploaded. Download URLs:", downloadURLs);
      callback(null, downloadURLs);
    })
    .catch((error) => {
      console.error("Error uploading photo(s) to Firebase Storage:", error);
      analysisState.uploadInProgress = false;
      callback(error);
    });
}
