/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/* global alert */

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const fileInput = document.getElementById("fileInput");
const pixelSizeSlider = document.getElementById("pixelSize");
const pixelSizeInput = document.getElementById("pixelSizeInput");
const colorsSlider = document.getElementById("colors");
const colorsInput = document.getElementById("colorsInput");
const scaleSlider = document.getElementById("scale");
const scaleInput = document.getElementById("scaleInput");
const importImageButton = document.getElementById("importImage");

let undoStack = [];
let redoStack = [];
const MAX_STACK_SIZE = 10;

let ledBlinkInterval = null;
const ledIndicator = document.getElementById("ledIndicator");

const STATUS_DISPLAY_LENGTH = 24;

let originalImage = null;

function updateStatus(state, message = "") {
    _updateLED(state);

    const statusText = document.getElementById("statusText");
    const statusDisplay = document.getElementById("statusDisplay");
    statusDisplay.title = message;

    if (message === "") {
        message = state;
    } else {
        message = `${state}: ${message}`;
    }
    if (message.length > STATUS_DISPLAY_LENGTH) {
        message = message.slice(0, STATUS_DISPLAY_LENGTH - 2) + "..";
    } else {
        message = message.padEnd(STATUS_DISPLAY_LENGTH, " ");
    }
    statusText.textContent = message.slice(0, STATUS_DISPLAY_LENGTH);
}

function pushUndoState() {
    if (undoStack.length >= MAX_STACK_SIZE) {
        undoStack.shift();
    }
    undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoStack = [];
}

function undo() {
    if (undoStack.length > 0) {
        redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const previousState = undoStack.pop();
        ctx.putImageData(previousState, 0, 0);
    }
}

function redo() {
    if (redoStack.length > 0) {
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const nextState = redoStack.pop();
        ctx.putImageData(nextState, 0, 0);
    }
}

let spinnerInterval = null;
const itsBrentSpinner = ["-", "\\", "|", "/"];
let spinnerIndex = 0;
let previousState = "INVALID";

function _updateLED(state) {
    if (state != previousState) {
        previousState = state;
    } else {
        return;
    }

    clearInterval(ledBlinkInterval);
    clearInterval(spinnerInterval);

    console.log(`LED now ${state}`);

    if (state === "READY") {
        ledIndicator.style.backgroundColor = "green";
        ledIndicator.style.opacity = "1";
        ledIndicator.style.visibility = "visible";
    } else if (state === "BUSY") {
        ledIndicator.style.backgroundColor = "orange";
        ledIndicator.style.opacity = "1";

        startSpinner();

        ledBlinkInterval = setInterval(() => {
            if (ledIndicator.style.opacity === "1") {
                ledIndicator.style.opacity = "0.3";
            } else {
                ledIndicator.style.opacity = "1";
            }
        }, 500);
    } else if (state === "ERROR") {
        ledIndicator.style.backgroundColor = "red";
        ledIndicator.style.opacity = "1";
        ledIndicator.style.visibility = "visible";
    } else {
        ledIndicator.style.backgroundColor = "gray";
        ledIndicator.style.opacity = "1";
        ledIndicator.style.visibility = "visible";
    }
}

function startSpinner() {
    spinnerInterval = setInterval(() => {
        try {
            spinnerIndex = (spinnerIndex + 1) % itsBrentSpinner.length;
            const spinnerChar = itsBrentSpinner[spinnerIndex];

            const statusTextElement = document.getElementById("statusText");
            let currentText = statusTextElement.textContent;
            if (currentText === "READY" || currentText === "ERROR") {
                clearInterval(spinnerInterval);
                return;
            }
            currentText = currentText.padEnd(STATUS_DISPLAY_LENGTH, " ");
            currentText = currentText.slice(0, STATUS_DISPLAY_LENGTH - 1) + spinnerChar;
            statusTextElement.textContent = currentText;
        } catch (error) {
            console.error("Error in spinner interval:", error);
            clearInterval(spinnerInterval);
        }
    }, 100);
}

function copyToClipboard() {
    if (typeof ClipboardItem !== "undefined") {
        canvas.toBlob(function (blob) {
            const item = new ClipboardItem({ "image/png": blob });
            navigator.clipboard.write([item])
                .then(function () {
                    updateStatus("READY", "Canvas copied");
                })
                .catch(function (error) {
                    console.error("Error copying to clipboard: ", error);
                    updateStatus("ERROR", "Failed to copy to clipboard.");
                });
        });
    } else {
        updateStatus("ERROR", "Your browser does not support copying images to the clipboard. Please save the image instead.");
    }
}

function saveToFile() {
    const link = document.createElement("a");
    link.download = "pixelated_image.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
}

async function pasteFromClipboard() {
    try {
        updateStatus("BUSY", "PASTING");
        const items = await navigator.clipboard.read();
        for (const item of items) {
            if (!item.types.includes("image/png")) continue;
            const blob = await item.getType("image/png");
            const img = new Image();
            img.src = URL.createObjectURL(blob);

            img.onload = function () {
                pushUndoState();
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
            };
        }
    } catch (err) {
        console.error("Failed to read clipboard contents: ", err);
        updateStatus("ERROR", "Failed to read clipboard contents. Ensure an image is copied.");
    }
}

function updateScale() {
    const scale = parseFloat(scaleSlider.value);

    // Maintain the original resolution of the canvas
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    // Adjust the CSS size of the canvas for preview scaling
    canvas.style.width = `${originalWidth * scale}px`;
    canvas.style.height = `${originalHeight * scale}px`;
}

function resetSettings() {
    pixelSizeSlider.value = 4;
    pixelSizeInput.value = 4;
    colorsSlider.value = 16;
    colorsInput.value = 16;
    scaleSlider.value = 1;
    scaleInput.value = 1;
    updateScale();
}

function clearUndoRedoStacks() {
    undoStack = [];
    redoStack = [];
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const img = new Image();
    img.src = URL.createObjectURL(file);

    img.onload = function () {
        clearUndoRedoStacks(); // Clear stacks when a new image is loaded
        originalImage = img;
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
    };
}

function importCatImage() {
    updateStatus("BUSY", "FETCHING IMAGE");

    fetch("https://images.unsplash.com/photo-1544376543-c3dd0266dc86?ixlib=rb-4.0.3&q=85&fm=jpg&crop=entropy&cs=srgb&dl=cassidy-james-blaede-TA22tc6YyMw-unsplash.jpg&w=640", {
        mode: "cors"
    })
    .then(response => {
        if (!response.ok) {
            throw new Error("Network response was not ok");
        }
        return response.blob();
    })
    .then(blob => {
        const img = new Image();
        const imgURL = URL.createObjectURL(blob);
        img.src = imgURL;

        img.onload = function () {
            clearUndoRedoStacks(); // Clear stacks when a new image is loaded
            originalImage = img;
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            updateStatus("READY", "Image loaded");

            URL.revokeObjectURL(imgURL);
        };

        img.onerror = function () {
            updateStatus("ERROR", "Failed to load image from Blob URL.");
        };
    })
    .catch(error => {
        console.error("There has been a problem with your fetch operation:", error);
        updateStatus("ERROR", error.message);
    });
}

function resetToOriginalImage() {
    if (originalImage) {
        clearUndoRedoStacks(); // Clear stacks when resetting to the original image
        canvas.width = originalImage.width;
        canvas.height = originalImage.height;
        ctx.drawImage(originalImage, 0, 0);
        updateStatus("READY", "Original restored");
    } else {
        updateStatus("ERROR", "No original image");
    }
}

window.onload = function () {
    console.log("OnLoad retroizer");

    clearInterval(ledBlinkInterval);

    pixelSizeSlider.addEventListener("input", () => syncSliderInput(pixelSizeSlider, pixelSizeInput));
    pixelSizeInput.addEventListener("input", () => syncSliderInput(pixelSizeInput, pixelSizeSlider));

    colorsSlider.addEventListener("input", () => syncSliderInput(colorsSlider, colorsInput));
    colorsInput.addEventListener("input", () => syncSliderInput(colorsInput, colorsSlider));

    function syncSliderInput(slider, input, callback) {
        input.value = slider.value;
        if (typeof callback !== "undefined") {
            callback();
        }
    }

    scaleSlider.addEventListener("input", () => syncSliderInput(scaleSlider, scaleInput, updateScale));
    scaleInput.addEventListener("input", () => syncSliderInput(scaleInput, scaleSlider, updateScale));

    document.getElementById("copyCanvas").addEventListener("click", copyToClipboard);
    document.getElementById("saveCanvas").addEventListener("click", saveToFile);
    document.getElementById("resetButton").addEventListener("click", resetSettings);
    document.getElementById("resetToOriginal").addEventListener("click", resetToOriginalImage);
    document.getElementById("pasteClipboard").addEventListener("click", pasteFromClipboard);
    document.getElementById("undoButton").addEventListener("click", undo);
    document.getElementById("redoButton").addEventListener("click", redo);
    fileInput.addEventListener("change", handleFileUpload);
    importImageButton.addEventListener("click", importCatImage);

    if (typeof OnLoadRetroizerRender !== "undefined") {
        OnLoadRetroizerRender();
    } else {
        updateStatus("ERROR", "retroizer-render.js function OnLoadRetroizerRender not found");
    }
};

async function renderImage() {
    updateStatus("BUSY", "RENDERING");
    await palettizeImage();
    await pixelizeImage();
}

function getCanvasImageData() {
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

const paletteContainer = document.getElementById("colorPaletteContainer");
const colorPalette = document.getElementById("colorPalette");
const paletteTitle = document.getElementById("paletteTitle");
const togglePaletteButton = document.getElementById("togglePaletteButton");

let isPaletteCollapsed = true;
function togglePaletteVisibility() {
    paletteContainer.classList.toggle("expanded");
    colorPalette.style.display = paletteContainer.classList.contains("expanded") ? "flex" : "none";
    togglePaletteButton.textContent = paletteContainer.classList.contains("expanded") ? "Collapse" : "Expand";

    isPaletteCollapsed = !paletteContainer.classList.contains("expanded");
}
togglePaletteButton.addEventListener("click", togglePaletteVisibility);

function handleSwatchClick(selectedColor, palette) {
    // Convert the selected color to a hex string
    const selectedColorHex = rgbToHex(selectedColor);
    
    // Convert the entire palette to a CSV string
    const paletteCSV = palette.map(color => rgbToHex(color)).join(", ");

    // Display the alert with the selected color and the CSV list of all colors
    alert(`Selected Color: ${selectedColorHex}\n\nPalette:\n${paletteCSV}`);
}

function rgbToHex(color_) {
    let color = [];
    for (let i = 0; i < 3; i++) {
        color[i] = Math.round(color_[i]); // Proper rounding
    }
    return `#${color[0].toString(16).padStart(2, "0")}${color[1].toString(16).padStart(2, "0")}${color[2].toString(16).padStart(2, "0")}`.toUpperCase();
}

function displayPalette(palette, isRealPalette) {
    const paletteContainer = document.getElementById("colorPalette");
    paletteContainer.innerHTML = "";
    
    if (isRealPalette && isPaletteCollapsed) {
        togglePaletteVisibility();
        paletteTitle.querySelector("span").textContent = "Palette (calculating...)";
    }

    palette.forEach(color => {
        const colorDiv = document.createElement("div");
        colorDiv.className = "colorSwatch";
        colorDiv.style.backgroundColor = `rgb(${color[0]},${color[1]},${color[2]})`;
        
        // Add the click/tap event listener
        colorDiv.addEventListener("click", () => handleSwatchClick(color, palette));
        
        paletteContainer.appendChild(colorDiv);
    });
}

async function palettizeImage() {
    updateStatus("BUSY", "Palettizing");
    document.getElementById("progressContainer").style.display = "flex";

    const colorCount = parseInt(colorsSlider.value);
    const imageData = getCanvasImageData();
    const data = imageData.data;

    try {
        // Await the palette generation process
        const palette = await generatePaletteWithProgress(data, colorCount, (paletteProgress, currentPalette) => {
            displayPalette(currentPalette, true); // Pass `true` for real palettes
            document.getElementById("renderProgress").value = paletteProgress;
        });

        // Display the final palette and apply it to the image
        displayPalette(palette, true);
        applyPaletteToImage(imageData, palette);

        updateStatus("READY", "Rendering done");
    } catch (error) {
        // Handle any errors that occur during the palettization
        updateStatus("ERROR", "Palettizing failed");
        console.error("Error during palettization:", error);
    }
}

function updatePaletteDisplay(centroids) {
    const maxColors = 256;

    // Ensure the title is updated
    displayPalette(centroids.slice(0, maxColors), false);
}

function applyPaletteToImage(imageData, palette) {
    pushUndoState();
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        const color = [data[i], data[i + 1], data[i + 2]];
        const nearestColor = findNearestColor(color, palette);
        data[i] = nearestColor[0];
        data[i + 1] = nearestColor[1];
        data[i + 2] = nearestColor[2];
    }
    ctx.putImageData(imageData, 0, 0);
}

function findNearestColor(color, palette) {
    let nearestColor = palette[0];
    let minDistance = colorDistance(color, nearestColor);
    for (const paletteColor of palette) {
        const distance = colorDistance(color, paletteColor);
        if (distance < minDistance) {
            minDistance = distance;
            nearestColor = paletteColor;
        }
    }
    return nearestColor;
}

async function pixelizeImage() {
    updateStatus("BUSY", "Pixelizing");
    document.getElementById("progressContainer").style.display = "flex";

    const pixelSize = parseInt(pixelSizeSlider.value);
    const imageData = getCanvasImageData();
    const data = imageData.data;

    let progress = 0;
    let y = 0;
    function processRow() {
        for (let x = 0; x < canvas.width; x += pixelSize) {
            const index = (y * canvas.width + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            ctx.fillRect(x, y, pixelSize, pixelSize);
        }

        y += pixelSize;
        progress = (y / canvas.height) * 100;
        document.getElementById("renderProgress").value = progress;

        if (y < canvas.height) {
            requestAnimationFrame(processRow);
        } else {
            updateStatus("READY", "Rendering done");
            //document.getElementById("progressContainer").style.display = "none";
        }
    }

    requestAnimationFrame(processRow);
}

function colorDistance(color1, color2) {
    if (!color1 || !color2 || color1.length < 3 || color2.length < 3) {
        console.error("Invalid colors for distance calculation:", color1, color2);
        return Infinity; // Return a large number to avoid selecting this color
    }
    return Math.sqrt(
        Math.pow(color1[0] - color2[0], 2) +
        Math.pow(color1[1] - color2[1], 2) +
        Math.pow(color1[2] - color2[2], 2)
    );
}

const PROGRESS_COLOR_LIST = 10;
async function generatePaletteWithProgress(data, colorCount, progressCallback) {
    const colors = [];
    for (let i = 0; i < data.length; i += 4) {
        colors.push([data[i], data[i + 1], data[i + 2]]);
        if (i % (data.length / 5) === 0) {
            const palette = kMeansStep(colors, colorCount);
            progressCallback((i / data.length) * PROGRESS_COLOR_LIST, palette);
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
    }

    const clusters = await kMeans(colors, colorCount, progressCallback);
    return clusters.centroids.map(c => [c[0], c[1], c[2], 255]);
}

function kMeansStep(colors, k) {
    const centroids = colors.slice(0, k); // Initialize centroids with the first k points
    const clusters = Array(k).fill().map(() => []);

    for (const point of colors) {
        let minDist = Infinity;
        let closestCentroid = 0;

        for (let i = 0; i < k; i++) {
            if (centroids[i]) { // Ensure the centroid is defined
                const dist = colorDistance(point, centroids[i]);
                if (dist < minDist) {
                    minDist = dist;
                    closestCentroid = i;
                }
            }
        }

        clusters[closestCentroid].push(point);
    }

    for (let i = 0; i < k; i++) {
        if (clusters[i].length > 0) {
            const newCentroid = clusters[i].reduce(
                (mean, value) => mean.map((m, index) => m + value[index]),
                [0, 0, 0]
            ).map(value => value / clusters[i].length);

            centroids[i] = newCentroid;
        } else {
            console.warn(`Cluster ${i} is empty. Reassigning to a random point.`);
            centroids[i] = colors[Math.floor(Math.random() * colors.length)];
        }
    }

    return centroids;
}

async function kMeans(data, k, progressCallback) {
    const centroids = data.slice(0, k);
    let clusters = Array(k).fill().map(() => []);

    let iteration = 0;
    let hasChanged = true;

    while (hasChanged && iteration < 100) {
        clusters = Array(k).fill().map(() => []);
        hasChanged = false;

        for (const point of data) {
            let minDist = Infinity;
            let closestCentroid = 0;

            for (let i = 0; i < k; i++) {
                const dist = colorDistance(point, centroids[i]);
                if (dist < minDist) {
                    minDist = dist;
                    closestCentroid = i;
                }
            }

            clusters[closestCentroid].push(point);
        }

        for (let i = 0; i < k; i++) {
            const newCentroid = clusters[i].reduce(
                (mean, value) => mean.map((m, index) => m + value[index]),
                [0, 0, 0]
            ).map(value => value / clusters[i].length || 0);

            if (!newCentroid.every((val, index) => val === centroids[i][index])) {
                centroids[i] = newCentroid;
                hasChanged = true;
            }
        }

        // Update palette display
        updatePaletteDisplay(centroids);

        iteration++;
        progressCallback(PROGRESS_COLOR_LIST + (iteration / 100) * (100 - PROGRESS_COLOR_LIST), centroids);

        await new Promise(resolve => requestAnimationFrame(resolve));
    }

    finalizePalette(centroids);

    return { centroids, clusters };
}

function finalizePalette(colors) {
    const maxColors = 256;
    const colorCount = colors.length > maxColors ? maxColors : colors.length;

    // Update the title with the palette information
    paletteTitle.querySelector("span").textContent = `Palette (${colorCount} colors)`;

    // Log the full palette as hexadecimal values
    const hexPalette = colors.map(color => {
        for (let i = 0; i < 3; i++) {
            color[i] = Math.round(color[i]); // Proper rounding
        }
        // Convert to hex and ensure two digits
        return `#${color[0].toString(16).padStart(2, "0")}${color[1].toString(16).padStart(2, "0")}${color[2].toString(16).padStart(2, "0")}`.toUpperCase();
    });

    console.log("Final Color Palette (Hex):", hexPalette);
}

function OnLoadRetroizerRender() {
    console.log("OnLoad retroizer-render");

    // Define the NES palette as an array of RGB values
    const nesPalette = [
        [124, 124, 124], // Light Gray
        [0, 0, 252],     // Blue
        [0, 0, 188],     // Dark Blue
        [68, 40, 188],   // Purple
        [148, 0, 132],   // Magenta
        [168, 0, 32],    // Red
        [168, 16, 0],    // Dark Red
        [136, 20, 0],    // Brown
        [80, 48, 0],     // Dark Brown
        [0, 120, 0],     // Green
        [0, 104, 0],     // Dark Green
        [0, 88, 0],      // Darker Green
        [0, 64, 88],     // Teal
        [0, 0, 0],       // Black
        [188, 188, 188], // Light Gray
        [60, 188, 252],  // Light Blue
        [104, 136, 252], // Blue
        [152, 120, 248], // Lavender
        [248, 120, 248], // Pink
        [248, 88, 152],  // Light Red
        [248, 120, 88],  // Orange
        [252, 160, 68],  // Light Orange
        [248, 184, 0],   // Yellow
        [184, 248, 24],  // Light Green
        [88, 216, 84],   // Light Green
        [88, 248, 152],  // Pale Green
        [0, 232, 216],   // Aqua
        [120, 120, 120]  // Gray
    ];

    function initializeNESPaletteAndApply() {
        displayPalette(nesPalette, false); // Not a real palette, so pass `false`
        const imageData = getCanvasImageData();
        applyPaletteToImage(imageData, nesPalette);
        ctx.putImageData(imageData, 0, 0);
    }
    initializeNESPaletteAndApply();

    document.getElementById("renderPalettizeButton").addEventListener("click", palettizeImage);
    document.getElementById("renderPixelizeButton").addEventListener("click", pixelizeImage);

    
    document.getElementById("renderButton").addEventListener("click", async () => {
        // Disable button to prevent multiple clicks
        const renderButton = document.getElementById("renderButton");
        renderButton.disabled = true;

        await renderImage();

        // Re-enable button after completion
        renderButton.disabled = false;
    });
}

