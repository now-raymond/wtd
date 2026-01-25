document.addEventListener('DOMContentLoaded', () => {
    const inputLeft = document.getElementById('input-left');
    const inputRight = document.getElementById('input-right');
    const diffLeft = document.getElementById('diff-left');
    const diffRight = document.getElementById('diff-right');
    const modeToggle = document.getElementById('mode-toggle');
    const clearBtn = document.getElementById('clear-btn');
    const paneLeft = document.getElementById('pane-left');
    const paneRight = document.getElementById('pane-right');

    let isDiffMode = false;

    const syncScrollBtn = document.getElementById('sync-scroll');
    const prevDiffBtn = document.getElementById('prev-diff');
    const nextDiffBtn = document.getElementById('next-diff');
    const diffCounter = document.getElementById('diff-counter');
    const navControls = document.getElementById('nav-controls');

    let currentDiffIndex = -1;
    let totalDiffs = 0;
    let diffElements = [];
    let isSyncScrolling = true;
    let isSyncingLeft = false;
    let isSyncingRight = false;

    // --- Core Logic ---

    function toggleMode() {
        if (!isDiffMode) {
            // Switch to Diff View
            const leftText = inputLeft.value;
            const rightText = inputRight.value;
            renderDiff(leftText, rightText);

            inputLeft.parentElement.classList.add('hidden');
            inputRight.parentElement.classList.add('hidden');
            diffLeft.classList.remove('hidden');
            diffRight.classList.remove('hidden');
            navControls.classList.remove('hidden');

            modeToggle.textContent = 'Edit Text';
            modeToggle.classList.remove('primary');
            modeToggle.classList.add('secondary');

            // Initial nav update
            updateNavState();
        } else {
            // Switch to Edit View
            inputLeft.parentElement.classList.remove('hidden');
            inputRight.parentElement.classList.remove('hidden');
            diffLeft.classList.add('hidden');
            diffRight.classList.add('hidden');
            navControls.classList.add('hidden');

            modeToggle.textContent = 'View Diff';
            modeToggle.classList.remove('secondary');
            modeToggle.classList.add('primary');
        }
        isDiffMode = !isDiffMode;
    }

    function renderDiff(text1, text2) {
        // Clear previous
        diffLeft.innerHTML = '';
        diffRight.innerHTML = '';
        diffElements = [];
        currentDiffIndex = -1;

        if (!text1 && !text2) {
            updateNavState();
            return;
        }

        // Use jsdiff to compute changes
        // Switching to diffChars for true character-level diffs including newlines
        const diff = Diff.diffChars(text1, text2);

        const leftFragment = document.createDocumentFragment();
        const rightFragment = document.createDocumentFragment();

        diff.forEach(part => {
            // part.added, part.removed, part.value

            if (part.removed) {
                // Show in left (red)
                const span = document.createElement('span');
                span.className = 'diff-removed';
                span.textContent = part.value;
                leftFragment.appendChild(span);
                diffElements.push({ element: span, type: 'removed' });

                // For side-by-side alignment, we technically should verify if there is an 'added' counterpart
                // But for this simple implementation, we just skip displaying in right
            } else if (part.added) {
                // Show in right (green)
                const span = document.createElement('span');
                span.className = 'diff-added';
                span.textContent = part.value;
                rightFragment.appendChild(span);
                diffElements.push({ element: span, type: 'added' });
            } else {
                // Common text
                const spanLeft = document.createElement('span');
                spanLeft.textContent = part.value;
                leftFragment.appendChild(spanLeft);

                const spanRight = document.createElement('span');
                spanRight.textContent = part.value;
                rightFragment.appendChild(spanRight);
            }
        });

        diffLeft.appendChild(leftFragment);
        diffRight.appendChild(rightFragment);

        // Group diffs? For now, list every span.
        // Actually, adjacent spans might be annoying. But let's start with this.
        totalDiffs = diffElements.length;
        updateNavState();
    }

    function updateNavState() {
        if (totalDiffs === 0) {
            diffCounter.textContent = '0/0';
            prevDiffBtn.disabled = true;
            nextDiffBtn.disabled = true;
        } else {
            const displayIndex = currentDiffIndex >= 0 ? currentDiffIndex + 1 : 0;
            diffCounter.textContent = `${displayIndex}/${totalDiffs}`;
            // Always enable if there are diffs, to allow wrapping
            prevDiffBtn.disabled = false;
            nextDiffBtn.disabled = false;
        }
    }

    function scrollToDiff(index) {
        const target = diffElements[index].element;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Highlight logic? maybe later.
        currentDiffIndex = index;
        updateNavState();
    }

    function clearAll() {
        inputLeft.value = '';
        inputRight.value = '';
        if (isDiffMode) toggleMode();
    }


    // --- Persistence ---

    function saveToStorage() {
        localStorage.setItem('wtd_input_left', inputLeft.value);
        localStorage.setItem('wtd_input_right', inputRight.value);
    }

    function loadFromStorage() {
        const storedLeft = localStorage.getItem('wtd_input_left');
        const storedRight = localStorage.getItem('wtd_input_right');

        if (storedLeft !== null) inputLeft.value = storedLeft;
        if (storedRight !== null) inputRight.value = storedRight;
    }

    // --- Drag and Drop ---

    function setupDragAndDrop(element, inputElement) {
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            element.classList.add('drag-over');
        });

        element.addEventListener('dragleave', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
        });

        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');

            const file = e.dataTransfer.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => {
                    inputElement.value = event.target.result;
                    saveToStorage(); // Save after drop
                };
                reader.readAsText(file);
            }
        });
    }

    // --- Sync Scroll ---

    function handleScrollLeft() {
        if (!isSyncScrolling) return;
        if (isSyncingLeft) {
            isSyncingLeft = false;
            return;
        }
        isSyncingRight = true;
        diffRight.scrollTop = diffLeft.scrollTop;
        diffRight.scrollLeft = diffLeft.scrollLeft;
    }

    function handleScrollRight() {
        if (!isSyncScrolling) return;
        if (isSyncingRight) {
            isSyncingRight = false;
            return;
        }
        isSyncingLeft = true;
        diffLeft.scrollTop = diffRight.scrollTop;
        diffLeft.scrollLeft = diffRight.scrollLeft;
    }

    // --- Event Listeners ---

    // Load saved data
    loadFromStorage();

    modeToggle.addEventListener('click', toggleMode);
    clearBtn.addEventListener('click', () => {
        clearAll();
        localStorage.removeItem('wtd_input_left');
        localStorage.removeItem('wtd_input_right');
    });

    // Save on input changes
    inputLeft.addEventListener('input', saveToStorage);
    inputRight.addEventListener('input', saveToStorage);

    syncScrollBtn.addEventListener('click', () => {
        isSyncScrolling = !isSyncScrolling;
        syncScrollBtn.classList.toggle('active', isSyncScrolling);
    });

    prevDiffBtn.addEventListener('click', () => {
        if (totalDiffs === 0) return;
        let newIndex = currentDiffIndex - 1;
        if (newIndex < 0) newIndex = totalDiffs - 1; // Wrap to end
        scrollToDiff(newIndex);
    });

    nextDiffBtn.addEventListener('click', () => {
        if (totalDiffs === 0) return;
        let newIndex = currentDiffIndex + 1;
        if (newIndex >= totalDiffs) newIndex = 0; // Wrap to start
        scrollToDiff(newIndex);
    });

    diffLeft.addEventListener('scroll', handleScrollLeft);
    diffRight.addEventListener('scroll', handleScrollRight);

    // Setup DnD for both panes (can drop on the whole pane)
    setupDragAndDrop(paneLeft, inputLeft);
    setupDragAndDrop(paneRight, inputRight);
});
