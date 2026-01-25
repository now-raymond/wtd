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
    const swapBtn = document.getElementById('swap-btn');
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

    // Initialize Turndown service
    const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
    });

    // --- Core Logic ---

    // Paste handler for HTML to Markdown conversion
    function handlePaste(e) {
        const clipboardData = e.clipboardData || window.clipboardData;
        if (!clipboardData) return;

        // Check if there is HTML content
        const html = clipboardData.getData('text/html');
        if (html) {
            e.preventDefault();
            // Convert HTML to Markdown
            const markdown = turndownService.turndown(html);

            // Insert data
            const textarea = e.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const text = textarea.value;

            textarea.value = text.substring(0, start) + markdown + text.substring(end);

            // Move cursor
            textarea.selectionStart = textarea.selectionEnd = start + markdown.length;

            // Trigger input for saving/UI
            textarea.dispatchEvent(new Event('input'));
            saveToStorage();
        }
    }

    function toggleMode() {
        const splitView = document.querySelector('.split-view');
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

            // Show minimap
            splitView.classList.add('diff-active');

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

            // Hide minimap
            splitView.classList.remove('diff-active');

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

        // Use line-based diff for structure
        const lineDiff = Diff.diffLines(text1, text2);

        // Group adjacent removed/added chunks for pairing
        let i = 0;
        while (i < lineDiff.length) {
            const chunk = lineDiff[i];

            if (!chunk.added && !chunk.removed) {
                // Unchanged lines - render in both panes
                renderUnchangedRow(chunk.value);
                i++;
            } else {
                // Collect consecutive removed and added chunks
                let removedText = '';
                let addedText = '';

                while (i < lineDiff.length && lineDiff[i].removed) {
                    removedText += lineDiff[i].value;
                    i++;
                }
                while (i < lineDiff.length && lineDiff[i].added) {
                    addedText += lineDiff[i].value;
                    i++;
                }

                // Render the paired change with word-level highlighting
                renderChangedRow(removedText, addedText);
            }
        }

        totalDiffs = diffElements.length;
        updateNavState();

        // Sync row heights and update minimap after layout
        requestAnimationFrame(() => {
            syncRowHeights();
            updateMinimap();
        });
    }

    function syncRowHeights() {
        const leftRows = diffLeft.querySelectorAll('.diff-row');
        const rightRows = diffRight.querySelectorAll('.diff-row');

        const count = Math.min(leftRows.length, rightRows.length);
        for (let i = 0; i < count; i++) {
            // Reset heights first
            leftRows[i].style.minHeight = '';
            rightRows[i].style.minHeight = '';

            // Get natural heights
            const leftHeight = leftRows[i].offsetHeight;
            const rightHeight = rightRows[i].offsetHeight;

            // Set both to the max
            const maxHeight = Math.max(leftHeight, rightHeight);
            leftRows[i].style.minHeight = `${maxHeight}px`;
            rightRows[i].style.minHeight = `${maxHeight}px`;
        }
    }

    function renderUnchangedRow(text) {
        const rowLeft = document.createElement('div');
        rowLeft.className = 'diff-row';
        rowLeft.textContent = text;
        diffLeft.appendChild(rowLeft);

        const rowRight = document.createElement('div');
        rowRight.className = 'diff-row';
        rowRight.textContent = text;
        diffRight.appendChild(rowRight);
    }

    function renderChangedRow(removedText, addedText) {
        const rowLeft = document.createElement('div');
        rowLeft.className = 'diff-row diff-row-changed';

        const rowRight = document.createElement('div');
        rowRight.className = 'diff-row diff-row-changed';

        if (removedText && addedText) {
            // Both sides have content - do word-level diff
            const wordDiff = Diff.diffWords(removedText, addedText);

            wordDiff.forEach(part => {
                if (part.removed) {
                    const span = document.createElement('span');
                    span.className = 'diff-removed';
                    span.textContent = part.value;
                    rowLeft.appendChild(span);
                    diffElements.push({ element: span, type: 'removed' });
                } else if (part.added) {
                    const span = document.createElement('span');
                    span.className = 'diff-added';
                    span.textContent = part.value;
                    rowRight.appendChild(span);
                    diffElements.push({ element: span, type: 'added' });
                } else {
                    // Unchanged words - show in both
                    const spanLeft = document.createElement('span');
                    spanLeft.textContent = part.value;
                    rowLeft.appendChild(spanLeft);

                    const spanRight = document.createElement('span');
                    spanRight.textContent = part.value;
                    rowRight.appendChild(spanRight);
                }
            });
        } else if (removedText) {
            // Only removed (deletion)
            const span = document.createElement('span');
            span.className = 'diff-removed';
            span.textContent = removedText;
            rowLeft.appendChild(span);
            diffElements.push({ element: span, type: 'removed' });
        } else if (addedText) {
            // Only added (insertion)
            const span = document.createElement('span');
            span.className = 'diff-added';
            span.textContent = addedText;
            rowRight.appendChild(span);
            diffElements.push({ element: span, type: 'added' });
        }

        diffLeft.appendChild(rowLeft);
        diffRight.appendChild(rowRight);
    }

    const minimap = document.getElementById('minimap');

    // Create persistent minimap structure
    const minimapMarkers = document.createElement('div');
    minimapMarkers.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    minimap.appendChild(minimapMarkers);

    const minimapViewport = document.createElement('div');
    minimapViewport.className = 'minimap-viewport';
    minimap.appendChild(minimapViewport);

    function updateMinimap() {
        minimapMarkers.innerHTML = '';
        if (!diffElements.length) return;

        // Calculate max scroll height to normalize positions
        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);

        diffElements.forEach(item => {
            const { element, type } = item;

            const top = (element.offsetTop / scrollHeight) * 100;
            const height = Math.max((element.offsetHeight / scrollHeight) * 100, 0.5);

            const marker = document.createElement('div');
            marker.className = `minimap-marker ${type}`;
            marker.style.top = `${top}%`;
            marker.style.height = `${height}%`;
            minimapMarkers.appendChild(marker);
        });

        updateMinimapViewport();
    }

    function updateMinimapViewport() {
        if (!minimapViewport || !isDiffMode) return;

        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);
        const clientHeight = diffLeft.clientHeight;
        const scrollTop = diffLeft.scrollTop;

        // Avoid division by zero
        if (scrollHeight === 0) return;

        const topPercent = (scrollTop / scrollHeight) * 100;
        const heightPercent = (clientHeight / scrollHeight) * 100;

        minimapViewport.style.top = `${topPercent}%`;
        minimapViewport.style.height = `${heightPercent}%`;
    }

    // Handle Minimap Clicks
    minimap.addEventListener('click', (e) => {
        // Ignore if we were dragging
        if (e.target === minimapViewport) return;

        const rect = minimap.getBoundingClientRect();
        const clickY = e.clientY - rect.top;
        const percentage = clickY / rect.height;

        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);
        const targetScroll = percentage * scrollHeight;

        // Center the view on the click
        const viewHeight = diffLeft.clientHeight;

        diffLeft.scrollTop = targetScroll - (viewHeight / 2);
        diffRight.scrollTop = targetScroll - (viewHeight / 2);
    });

    // Drag-to-scroll on minimap viewport
    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollTop = 0;

    minimapViewport.addEventListener('mousedown', (e) => {
        isDragging = true;
        dragStartY = e.clientY;
        dragStartScrollTop = diffLeft.scrollTop;
        minimapViewport.style.cursor = 'grabbing';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = minimap.getBoundingClientRect();
        const deltaY = e.clientY - dragStartY;
        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);

        // Convert pixel movement on minimap to scroll movement
        const scrollDelta = (deltaY / rect.height) * scrollHeight;

        diffLeft.scrollTop = dragStartScrollTop + scrollDelta;
        diffRight.scrollTop = dragStartScrollTop + scrollDelta;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            minimapViewport.style.cursor = 'grab';
        }
    });

    // Update viewport on scroll
    diffLeft.addEventListener('scroll', () => {
        if (isDiffMode) requestAnimationFrame(updateMinimapViewport);
    });

    // Update minimap on resize
    window.addEventListener('resize', () => {
        if (isDiffMode) {
            // Debounce slightly proper
            if (window.minimapTimeout) clearTimeout(window.minimapTimeout);
            window.minimapTimeout = setTimeout(updateMinimap, 100);
        }
    });

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

    // Paste logic
    inputLeft.addEventListener('paste', handlePaste);
    inputRight.addEventListener('paste', handlePaste);

    syncScrollBtn.addEventListener('click', () => {
        isSyncScrolling = !isSyncScrolling;
        syncScrollBtn.classList.toggle('active', isSyncScrolling);
    });

    swapBtn.addEventListener('click', () => {
        const temp = inputLeft.value;
        inputLeft.value = inputRight.value;
        inputRight.value = temp;

        // Trigger save and updates
        inputLeft.dispatchEvent(new Event('input'));
        inputRight.dispatchEvent(new Event('input'));

        // If in diff mode, re-render
        if (isDiffMode) {
            renderDiff(inputLeft.value, inputRight.value);
        }
    });

    const copyLeftBtn = document.getElementById('copy-left');
    const copyRightBtn = document.getElementById('copy-right');

    const copyToClipboard = async (text, button) => {
        try {
            await navigator.clipboard.writeText(text);
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy: ', err);
            const originalText = button.textContent;
            button.textContent = 'Error';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        }
    };

    copyLeftBtn.addEventListener('click', () => {
        copyToClipboard(inputLeft.value, copyLeftBtn);
    });

    copyRightBtn.addEventListener('click', () => {
        copyToClipboard(inputRight.value, copyRightBtn);
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
