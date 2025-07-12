// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
// import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-analytics.js"; // Not used in this app
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";


document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Configuration (REPLACE with your actual config from Firebase Console) ---
    const firebaseConfig = {
        apiKey: "AIzaSyCFPz4fZFyFws7mgVugxjxjYEaTLM5CS4U",
        authDomain: "crabpuzzle-caed7.firebaseapp.com",
        projectId: "crabpuzzle-caed7",
        storageBucket: "crabpuzzle-caed7.firebasestorage.app",
        messagingSenderId: "359179107110",
        appId: "1:359179107110:web:ddf1bfd63d295c3d715fe7",
        measurementId: "G-7WB3FZ1RGM"
    };

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    // const analytics = getAnalytics(app); // If you want to use analytics
    const db = getFirestore(app); // Get Firestore instance
    const claimedTilesCollection = collection(db, "claimedTiles"); // Get a reference to your collection


    // --- Configuration ---
    const MASTER_IMAGE_PATH = 'now2.png';
    const GRID_COLUMNS = 25;
    const GRID_ROWS = 8;
    const TOTAL_TILES = GRID_COLUMNS * GRID_ROWS; // This will be 200
    const NUMBER_OF_PARTICLES = 30;
    const MIN_PARTICLE_SIZE = 15;
    const MAX_PARTICLE_SIZE = 45;

    // Pre-define some VIP tiles (these will be pushed to Firestore if they don't exist)



    // --- DOM Elements ---
    const particlesBackground = document.querySelector('.particles-background');
    const puzzleContainer = document.getElementById('puzzle-container');
    const claimTileBtn = document.getElementById('claim-tile-btn');
    const claimModal = document.getElementById('claim-modal');
    const claimForm = document.getElementById('claim-form');
    const tilePopup = document.getElementById('tile-popup');
    const closeButtons = document.querySelectorAll('.close-button');
    const progressBarFill = document.getElementById('progress-bar-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');

    const usernameInput = document.getElementById('username');
    const pfpUrlInput = document.getElementById('pfp-url');

    let claimedTilesData = []; // This will now hold data fetched from Firestore

    // --- Functions ---

    // Generates random particles for the background
    function generateParticles() {
        particlesBackground.innerHTML = '';
        for (let i = 0; i < NUMBER_OF_PARTICLES; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');

            const size = Math.random() * (MAX_PARTICLE_SIZE - MIN_PARTICLE_SIZE) + MIN_PARTICLE_SIZE;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;

            const initialX = Math.random() * 120 - 10 + 'vw';
            const initialY = Math.random() * 120 - 10 + 'vh';
            particle.style.left = initialX;
            particle.style.top = initialY;

            particle.style.setProperty('--initial-x', initialX);
            particle.style.setProperty('--initial-y', initialY);

            particle.style.animationDelay = `${Math.random() * 20}s`;
            particle.style.animationDuration = `${20 + Math.random() * 10}s`;

            particlesBackground.appendChild(particle);
        }
    }

    // Initializes the puzzle grid
    function initializePuzzleGrid() {
        const actualPuzzleWidth = puzzleContainer.offsetWidth;
        const dynamicTileSize = actualPuzzleWidth / GRID_COLUMNS || 1; 

        puzzleContainer.style.gridTemplateColumns = `repeat(${GRID_COLUMNS}, ${dynamicTileSize}px)`;
        puzzleContainer.style.gridTemplateRows = `repeat(${GRID_ROWS}, ${dynamicTileSize}px)`;

        puzzleContainer.innerHTML = ''; 

        for (let i = 0; i < TOTAL_TILES; i++) {
            const tile = document.createElement('div');
            tile.classList.add('puzzle-tile');
            tile.dataset.tileId = i;

            tile.addEventListener('click', () => handleTileClick(i));
            puzzleContainer.appendChild(tile);
        }
        // No call to loadInitialTiles() here, as we'll use a Firestore real-time listener instead
        // updateProgressBar() will be called by the listener
    }

    // Recalculate tile sizes on window resize
    function handleResize() {
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(() => {
            initializePuzzleGrid();
        }, 200);
    }

    // Renders a single tile with user data (now purely for rendering, not loading)
    function renderTile(tileData) {
        const tileElement = document.querySelector(`.puzzle-tile[data-tile-id="${tileData.tileId}"]`);
        if (tileElement) {
            tileElement.classList.add('claimed');
            if (tileData.isVIP) {
                tileElement.classList.add('vip');
                if (!tileElement.querySelector('.vip-badge')) { // Ensure VIP badge only added once
                    const vipBadge = document.createElement('span');
                    vipBadge.classList.add('vip-badge');
                    vipBadge.textContent = 'VIP';
                    tileElement.appendChild(vipBadge);
                }
            }

            const pfpImg = document.createElement('img');
            pfpImg.src = tileData.pfpUrl;
            pfpImg.alt = `${tileData.username}'s PFP`;
            
            pfpImg.style.opacity = '0';
            pfpImg.onload = () => {
                pfpImg.style.transition = 'opacity 0.5s ease-in';
                pfpImg.style.opacity = '0.8';
            };
            pfpImg.onerror = () => {
                console.error(`Failed to load PFP for ${tileData.username} from ${tileData.pfpUrl}`);
                pfpImg.src = "https://unavatar.io/twitter/succinct"; // Fallback PFP
                pfpImg.style.opacity = '0.8';
            };

            const existingVipBadge = tileElement.querySelector('.vip-badge');
            tileElement.innerHTML = ''; 
            if (existingVipBadge) {
                tileElement.appendChild(existingVipBadge);
            }
            tileElement.appendChild(pfpImg);

            tileElement.dataset.username = tileData.username;
            tileElement.dataset.message = tileData.message;
            tileElement.dataset.createdAt = tileData.createdAt;
            tileElement.dataset.pfpUrl = tileData.pfpUrl;
            if (tileData.docId) {
                tileElement.dataset.docId = tileData.docId;
            }
        }
    }

    // Updates the progress bar
    function updateProgressBar() {
        const filledTilesCount = claimedTilesData.length;
        const percentage = (filledTilesCount / TOTAL_TILES) * 100;

        progressText.textContent = `📸 ${filledTilesCount} / ${TOTAL_TILES} Faces Collected`;
        progressPercentage.textContent = `${percentage.toFixed(1)}%`;
        progressBarFill.style.width = `${percentage}%`;

        if (percentage > 90) {
            progressBarFill.style.backgroundColor = 'var(--color-green)';
        } else {
            progressBarFill.style.backgroundColor = 'var(--progress-fill)';
        }
    }

    // Handles tile click (for displaying popup or opening claim modal for THAT tile)
    function handleTileClick(tileId) {
        const tileData = claimedTilesData.find(tile => tile.tileId === tileId);
        
        if (tileData) {
            document.getElementById('popup-pfp').src = tileData.pfpUrl;
            document.getElementById('popup-username').textContent = tileData.username;
            document.getElementById('popup-message').textContent = tileData.message;
            document.getElementById('popup-date').textContent = new Date(tileData.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            tilePopup.style.display = 'flex';
        } else {
            // Tile is NOT claimed, open claim modal for this specific tile
            claimModal.dataset.currentTileId = tileId;
            claimModal.style.display = 'flex';
            usernameInput.focus();
        }
    }

    // --- Auto-fetch PFP ---
    function autoFetchPfp() {
        const username = usernameInput.value.trim();
        if (username) {
            let pfpCandidateUrl = `https://unavatar.io/github/${username}`;
            if (username.startsWith('@')) {
                pfpCandidateUrl = `https://unavatar.io/twitter/${username.substring(1)}`;
            } else if (!username.includes('/') && !username.includes('.') && username.length > 2) {
                 pfpCandidateUrl = `https://unavatar.io/twitter/${username}`;
            }
            pfpUrlInput.value = pfpCandidateUrl;
            const tempImg = new Image();
            tempImg.src = pfpCandidateUrl;
            tempImg.onerror = () => {
                console.warn(`Could not find avatar for "${username}" from common sources. Please verify username or provide a direct PFP URL.`);
            };
        } else {
            pfpUrlInput.value = '';
        }
    }


    // --- Event Listeners ---
    claimTileBtn.addEventListener('click', () => {
        let availableTileId = -1;
        for (let i = 0; i < TOTAL_TILES; i++) {
            const isClaimed = claimedTilesData.some(tile => tile.tileId === i);
            if (!isClaimed) {
                availableTileId = i;
                break;
            }
        }

        if (availableTileId !== -1) {
            claimModal.dataset.currentTileId = availableTileId;
            claimModal.style.display = 'flex';
            usernameInput.focus();
        } else {
            alert("The puzzle is full! Thanks for your interest!");
        }
    });

    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            claimModal.style.display = 'none';
            tilePopup.style.display = 'none';
            claimForm.reset();
        });
    });

    window.addEventListener('click', (event) => {
        if (event.target === claimModal) {
            claimModal.style.display = 'none';
            claimForm.reset();
        }
        if (event.target === tilePopup) {
            tilePopup.style.display = 'none';
        }
    });

    usernameInput.addEventListener('input', autoFetchPfp);

    // Handle Claim Form Submission (NOW SAVES TO FIRESTORE)
    claimForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput.value.trim();
        const message = document.getElementById('message').value.trim();
        const pfpUrl = pfpUrlInput.value.trim();
        const tileIdToClaim = parseInt(claimModal.dataset.currentTileId);

        if (!username || !message || !pfpUrl || isNaN(tileIdToClaim)) {
            alert('Please fill in all fields correctly.');
            return;
        }

        const newTileData = {
            tileId: tileIdToClaim,
            username: username,
            message: message,
            pfpUrl: pfpUrl,
            createdAt: serverTimestamp(), // Use serverTimestamp from modular SDK
            isVIP: false
        };

        try {
            const docRef = doc(claimedTilesCollection, String(tileIdToClaim)); // Use doc() from modular SDK
            const docSnap = await getDoc(docRef); // Use getDoc() from modular SDK

            if (docSnap.exists() && docSnap.data().isVIP) {
                alert("This VIP tile cannot be overwritten by a regular claim.");
                return;
            }

            await setDoc(docRef, newTileData); // Use setDoc() from modular SDK
            console.log("Document successfully written with ID: ", tileIdToClaim);

            claimModal.style.display = 'none';
            claimForm.reset();
            // The Firestore listener will automatically update the UI
        } catch (e) {
            console.error("Error adding document: ", e);
            alert("Failed to claim tile. Please try again.");
        }
    });

    // --- Firebase Real-time Listener ---
    onSnapshot(claimedTilesCollection, (snapshot) => { // Use onSnapshot() from modular SDK
        console.log("Firestore update detected!");
        const updatedTiles = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Convert server timestamp to Date object if it exists and is a Timestamp object
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                data.createdAt = data.createdAt.toDate().toISOString();
            }
            updatedTiles.push({ docId: doc.id, ...data });
        });

        // Push VIP tiles that are hardcoded if they are not yet in Firestore
        const pushVipTilesIfMissing = async () => {
            for (const vipTile of VIP_TILES_DATA) {
                const docRef = doc(claimedTilesCollection, String(vipTile.tileId)); // Use doc()
                const docSnap = await getDoc(docRef); // Use getDoc()
                if (!docSnap.exists()) {
                    console.log(`Pushing VIP tile ${vipTile.tileId} to Firestore.`);
                    await setDoc(docRef, { // Use setDoc()
                        ...vipTile,
                        createdAt: serverTimestamp() // Use serverTimestamp
                    });
                }
            }
        };
        
        // Only run VIP push logic if no tiles have been loaded yet from Firestore
        // This prevents excessive writes if the app is reloaded frequently
        if (claimedTilesData.length === 0 && updatedTiles.length === 0) {
             pushVipTilesIfMissing();
        }

        claimedTilesData = updatedTiles;

        const allPuzzleTiles = puzzleContainer.querySelectorAll('.puzzle-tile');
        allPuzzleTiles.forEach(tile => {
            tile.classList.remove('claimed', 'vip');
            tile.innerHTML = '';
        });

        claimedTilesData.forEach(tileData => {
            renderTile(tileData);
        });

        updateProgressBar();
    }, (error) => {
        console.error("Error fetching Firestore updates:", error);
    });


    // --- Initialization ---
    generateParticles();
    initializePuzzleGrid();
    window.addEventListener('resize', handleResize);
});