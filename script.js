import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, getDocs, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    const firebaseConfig = {
        apiKey: "AIzaSyCFPz4fZFyFws7mgVugxjxjYEaTLM5CS4U",
        authDomain: "crabpuzzle-caed7.firebaseapp.com",
        projectId: "crabpuzzle-caed7",
        storageBucket: "crabpuzzle-caed7.firebasestorage.app",
        messagingSenderId: "359179107110",
        appId: "1:359179107110:web:ddf1bfd63d295c3d715fe7",
        measurementId: "G-7WB3FZ1RGM"
    };

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    const claimedTilesCollection = collection(db, "claimedTiles");

    const GRID_COLUMNS = 25;
    const GRID_ROWS = 8;
    const TOTAL_TILES = GRID_COLUMNS * GRID_ROWS;
    const NUMBER_OF_PARTICLES = 30;
    const MIN_PARTICLE_SIZE = 15;
    const MAX_PARTICLE_SIZE = 45;

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

    let claimedTilesData = [];

    const VIP_TILES_DATA = [
        {
            tileId: 0,
            username: "Succinct Core",
            message: "Building the future of ZK forever!",
            pfpUrl: "https://unavatar.io/twitter/SuccinctLabs",
            createdAt: serverTimestamp()
        },
        {
            tileId: 1,
            username: "Uma",
            message: "The Succinct Network will take SP1 from a great piece of open-source software to a movement, where anyone can join to help prove the world’s software. Prove with us.",
            pfpUrl: "https://unavatar.io/twitter/pumatheuma",
            createdAt: serverTimestamp()
        }
    ];

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
    }

    function handleResize() {
        clearTimeout(window.resizeTimeout);
        window.resizeTimeout = setTimeout(() => {
            initializePuzzleGrid();
        }, 200);
    }

    function renderTile(tileData) {
        const tileElement = document.querySelector(`.puzzle-tile[data-tile-id="${tileData.tileId}"]`);
        if (tileElement) {
            tileElement.classList.add('claimed');

            const isVip = VIP_TILES_DATA.some(v => v.tileId === tileData.tileId);
            if (isVip) {
                const vipBadge = document.createElement('span');
                vipBadge.classList.add('vip-badge');
                vipBadge.textContent = 'VIP';
                tileElement.appendChild(vipBadge);
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
                pfpImg.src = "https://unavatar.io/twitter/succinct";
                pfpImg.style.opacity = '0.8';
            };

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

    function updateProgressBar() {
        const filledTilesCount = claimedTilesData.length;
        const percentage = (filledTilesCount / TOTAL_TILES) * 100;

        progressText.textContent = `📸 ${filledTilesCount} / ${TOTAL_TILES} Faces Collected`;
        progressPercentage.textContent = `${percentage.toFixed(1)}%`;
        progressBarFill.style.width = `${percentage}%`;
        progressBarFill.style.backgroundColor = percentage > 90 ? 'var(--color-green)' : 'var(--progress-fill)';
    }

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
            claimModal.dataset.currentTileId = tileId;
            claimModal.style.display = 'flex';
            usernameInput.focus();
        }
    }

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
        } else {
            pfpUrlInput.value = '';
        }
    }

    claimTileBtn.addEventListener('click', () => {
        claimModal.style.display = 'flex';
        usernameInput.focus();
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

        try {
            const querySnapshot = await getDocs(claimedTilesCollection);
            const hasClaimed = querySnapshot.docs.some(doc => {
                const data = doc.data();
                return data.username?.toLowerCase() === username.toLowerCase();
            });

            if (hasClaimed) {
                alert("You have already claimed a tile.");
                return;
            }

            const docRef = doc(claimedTilesCollection, String(tileIdToClaim));
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const isVip = VIP_TILES_DATA.some(v => v.tileId === tileIdToClaim);
                alert(isVip ? "This is a VIP tile and cannot be claimed." : "This tile is already claimed.");
                return;
            }

            const newTileData = {
                tileId: tileIdToClaim,
                username,
                message,
                pfpUrl,
                createdAt: serverTimestamp()
            };

            await setDoc(docRef, newTileData);
            claimModal.style.display = 'none';
            claimForm.reset();

        } catch (e) {
            console.error("Error claiming tile:", e);
            alert("Failed to claim tile. Please try again.");
        }
    });

    onSnapshot(claimedTilesCollection, (snapshot) => {
        const updatedTiles = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.createdAt && typeof data.createdAt.toDate === 'function') {
                data.createdAt = data.createdAt.toDate().toISOString();
            }
            updatedTiles.push({ docId: doc.id, ...data });
        });

        const pushVipTilesIfMissing = async () => {
            for (const vipTile of VIP_TILES_DATA) {
                const vipDocRef = doc(claimedTilesCollection, String(vipTile.tileId));
                const vipDocSnap = await getDoc(vipDocRef);
                if (!vipDocSnap.exists()) {
                    await setDoc(vipDocRef, vipTile);
                    console.log(`VIP tile ${vipTile.tileId} added to Firestore.`);
                }
            }
        };
        pushVipTilesIfMissing();

        claimedTilesData = updatedTiles;

        puzzleContainer.querySelectorAll('.puzzle-tile').forEach(tile => {
            tile.classList.remove('claimed');
            tile.innerHTML = '';
        });

        claimedTilesData.forEach(tileData => {
            renderTile(tileData);
        });

        updateProgressBar();
    });

    generateParticles();
    initializePuzzleGrid();
    window.addEventListener('resize', handleResize);
});
