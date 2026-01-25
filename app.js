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

            modeToggle.textContent = 'Edit Text';
            modeToggle.classList.remove('primary');
            modeToggle.classList.add('secondary');
        } else {
            // Switch to Edit View
            inputLeft.parentElement.classList.remove('hidden');
            inputRight.parentElement.classList.remove('hidden');
            diffLeft.classList.add('hidden');
            diffRight.classList.add('hidden');

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

        if (!text1 && !text2) return;

        // Use jsdiff to compute changes
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

                // For side-by-side alignment, we technically should verify if there is an 'added' counterpart
                // But for this simple implementation, we just skip displaying in right
            } else if (part.added) {
                // Show in right (green)
                const span = document.createElement('span');
                span.className = 'diff-added';
                span.textContent = part.value;
                rightFragment.appendChild(span);
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
    }

    function clearAll() {
        inputLeft.value = '';
        inputRight.value = '';
        if (isDiffMode) toggleMode();
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
                    // Auto-switch to diff if both populated? No, stay in edit.
                };
                reader.readAsText(file);
            }
        });
    }

    // --- Event Listeners ---

    modeToggle.addEventListener('click', toggleMode);
    clearBtn.addEventListener('click', clearAll);

    // Setup DnD for both panes (can drop on the whole pane)
    setupDragAndDrop(paneLeft, inputLeft);
    setupDragAndDrop(paneRight, inputRight);
});
