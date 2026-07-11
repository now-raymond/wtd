document.addEventListener('DOMContentLoaded', () => {
    const appContainer = document.querySelector('.app-container');
    const splitView = document.querySelector('.split-view');
    const inputLeft = document.getElementById('input-left');
    const inputRight = document.getElementById('input-right');
    const diffLeft = document.getElementById('diff-left');
    const diffRight = document.getElementById('diff-right');
    const diffUnified = document.getElementById('diff-unified');
    const paneLeft = document.getElementById('pane-left');
    const paneRight = document.getElementById('pane-right');
    const modeToggle = document.getElementById('mode-toggle');
    const modeOptions = [...modeToggle.querySelectorAll('[data-mode]')];
    const mobilePaneSwitch = document.getElementById('mobile-pane-switch');
    const mobilePaneOptions = [...mobilePaneSwitch.querySelectorAll('[data-pane]')];
    const mobileQuery = window.matchMedia('(max-width: 767px)');

    const clearBtn = document.getElementById('clear-btn');
    const swapBtn = document.getElementById('swap-btn');
    const syncScrollBtn = document.getElementById('sync-scroll');
    const prevDiffBtn = document.getElementById('prev-diff');
    const nextDiffBtn = document.getElementById('next-diff');
    const diffCounter = document.getElementById('diff-counter');
    const navControls = document.getElementById('nav-controls');
    const copyLeftBtn = document.getElementById('copy-left');
    const copyRightBtn = document.getElementById('copy-right');

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const settingsClose = document.getElementById('settings-close');
    const pasteMarkdownCheckbox = document.getElementById('setting-paste-markdown');
    const copyRichtextCheckbox = document.getElementById('setting-copy-richtext');

    const mobileMoreBtn = document.getElementById('mobile-more-btn');
    const moreSheet = document.getElementById('more-sheet');
    const moreSheetClose = document.getElementById('more-sheet-close');
    const mobileSwapBtn = document.getElementById('mobile-swap-btn');
    const mobileClearBtn = document.getElementById('mobile-clear-btn');
    const mobileSettingsBtn = document.getElementById('mobile-settings-btn');

    let isDiffMode = false;
    let activeMobilePane = 'left';
    let currentDiffIndex = -1;
    let totalDiffs = 0;
    let currentDiffModel = [];
    let diffElements = [];
    let isSyncScrolling = true;
    let isSyncingLeft = false;
    let isSyncingRight = false;
    let pasteAsMarkdown = false;
    let copyAsRichText = false;
    let settingsReturnFocus = null;
    let moreReturnFocus = null;

    const turndownService = typeof TurndownService === 'function'
        ? new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
        : null;

    function getFocusable(container) {
        return [...container.querySelectorAll('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
            .filter(element => element.offsetParent !== null && !element.closest('.hidden'));
    }

    function trapFocus(event, overlay) {
        if (event.key !== 'Tab') return;
        const focusable = getFocusable(overlay);
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    }

    function openMoreSheet() {
        moreReturnFocus = document.activeElement;
        moreSheet.classList.remove('hidden');
        mobileMoreBtn.setAttribute('aria-expanded', 'true');
        moreSheetClose.focus();
    }

    function closeMoreSheet(restoreFocus = true) {
        if (moreSheet.classList.contains('hidden')) return;
        moreSheet.classList.add('hidden');
        mobileMoreBtn.setAttribute('aria-expanded', 'false');
        if (restoreFocus && moreReturnFocus) moreReturnFocus.focus();
    }

    function openSettings(trigger = document.activeElement) {
        settingsReturnFocus = trigger;
        closeMoreSheet(false);
        settingsModal.classList.remove('hidden');
        settingsClose.focus();
    }

    function closeSettings() {
        if (settingsModal.classList.contains('hidden')) return;
        settingsModal.classList.add('hidden');
        if (settingsReturnFocus) settingsReturnFocus.focus();
    }

    function handlePaste(event) {
        if (!pasteAsMarkdown || !turndownService) return;
        const clipboardData = event.clipboardData || window.clipboardData;
        if (!clipboardData) return;
        const html = clipboardData.getData('text/html');
        if (!html) return;
        event.preventDefault();
        document.execCommand('insertText', false, turndownService.turndown(html));
        saveToStorage();
    }

    function saveSettings() {
        localStorage.setItem('wtd_paste_markdown', pasteAsMarkdown);
        localStorage.setItem('wtd_copy_richtext', copyAsRichText);
    }

    function loadSettings() {
        const storedPaste = localStorage.getItem('wtd_paste_markdown');
        const storedCopy = localStorage.getItem('wtd_copy_richtext');
        if (storedPaste !== null) pasteAsMarkdown = storedPaste === 'true';
        if (storedCopy !== null) copyAsRichText = storedCopy === 'true';
        pasteMarkdownCheckbox.checked = pasteAsMarkdown;
        copyRichtextCheckbox.checked = copyAsRichText;
    }

    function setActiveMobilePane(side) {
        activeMobilePane = side;
        paneLeft.classList.toggle('mobile-active', side === 'left');
        paneRight.classList.toggle('mobile-active', side === 'right');
        mobilePaneOptions.forEach(option => {
            const active = option.dataset.pane === side;
            option.classList.toggle('active', active);
            option.setAttribute('aria-pressed', String(active));
        });
    }

    function setMode(mode) {
        const wantsDiff = mode === 'diff';
        if (wantsDiff === isDiffMode) return;

        isDiffMode = wantsDiff;
        appContainer.classList.toggle('diff-mode-active', wantsDiff);
        splitView.classList.toggle('diff-active', wantsDiff);
        modeToggle.classList.toggle('diff-active', wantsDiff);
        modeOptions.forEach(option => {
            const active = option.dataset.mode === mode;
            option.classList.toggle('active', active);
            option.setAttribute('aria-pressed', String(active));
        });

        if (wantsDiff) {
            renderDiff(inputLeft.value, inputRight.value);
            inputLeft.parentElement.classList.add('hidden');
            inputRight.parentElement.classList.add('hidden');
            diffLeft.classList.remove('hidden');
            diffRight.classList.remove('hidden');
            diffUnified.classList.remove('hidden');
            navControls.classList.remove('hidden');
        } else {
            clearActiveHighlight();
            inputLeft.parentElement.classList.remove('hidden');
            inputRight.parentElement.classList.remove('hidden');
            diffLeft.classList.add('hidden');
            diffRight.classList.add('hidden');
            diffUnified.classList.add('hidden');
            navControls.classList.add('hidden');
        }
    }

    function buildDiffModel(text1, text2) {
        if (!text1 && !text2) return [];
        const lineDiff = Diff.diffLines(text1, text2);
        const model = [];
        let index = 0;

        while (index < lineDiff.length) {
            const chunk = lineDiff[index];
            if (!chunk.added && !chunk.removed) {
                model.push({ kind: 'unchanged', text: chunk.value });
                index++;
                continue;
            }

            let removedText = '';
            let addedText = '';
            while (index < lineDiff.length && lineDiff[index].removed) {
                removedText += lineDiff[index].value;
                index++;
            }
            while (index < lineDiff.length && lineDiff[index].added) {
                addedText += lineDiff[index].value;
                index++;
            }

            const cleanRemoved = removedText.replace(/\n+$/, '');
            const cleanAdded = addedText.replace(/\n+$/, '');
            const wordDiff = removedText && addedText ? Diff.diffWords(cleanRemoved, cleanAdded) : [];
            let type = 'modified';
            if (removedText && !addedText) type = 'removed';
            if (!removedText && addedText) type = 'added';
            model.push({ kind: 'changed', removedText, addedText, wordDiff, type });
        }

        return model;
    }

    function appendPairedChange(entry, leftRow, rightRow) {
        if (entry.removedText && entry.addedText) {
            entry.wordDiff.forEach(part => {
                if (part.removed) {
                    const span = document.createElement('span');
                    span.className = 'diff-removed';
                    span.textContent = part.value;
                    leftRow.appendChild(span);
                } else if (part.added) {
                    const span = document.createElement('span');
                    span.className = 'diff-added';
                    span.textContent = part.value;
                    rightRow.appendChild(span);
                } else {
                    const spanLeft = document.createElement('span');
                    const spanRight = document.createElement('span');
                    spanLeft.textContent = part.value;
                    spanRight.textContent = part.value;
                    leftRow.appendChild(spanLeft);
                    rightRow.appendChild(spanRight);
                }
            });
        } else if (entry.removedText) {
            const span = document.createElement('span');
            span.className = 'diff-removed';
            span.textContent = entry.removedText;
            leftRow.appendChild(span);
        } else if (entry.addedText) {
            const span = document.createElement('span');
            span.className = 'diff-added';
            span.textContent = entry.addedText;
            rightRow.appendChild(span);
        }
    }

    function renderDesktopDiff(model) {
        let changeIndex = 0;
        model.forEach(entry => {
            const leftRow = document.createElement('div');
            const rightRow = document.createElement('div');
            leftRow.className = 'diff-row';
            rightRow.className = 'diff-row';

            if (entry.kind === 'unchanged') {
                leftRow.textContent = entry.text;
                rightRow.textContent = entry.text;
            } else {
                leftRow.classList.add('diff-row-changed', 'diff-row-removed');
                rightRow.classList.add('diff-row-changed', 'diff-row-added');
                appendPairedChange(entry, leftRow, rightRow);
                diffElements[changeIndex].leftRow = leftRow;
                diffElements[changeIndex].rightRow = rightRow;
                changeIndex++;
            }

            diffLeft.appendChild(leftRow);
            diffRight.appendChild(rightRow);
        });
    }

    function createUnifiedRow(kind, text, wordDiff, partKind) {
        const row = document.createElement('div');
        row.className = `unified-row unified-${kind}`;
        row.setAttribute('aria-label', kind === 'removed' ? 'Removed text' : kind === 'added' ? 'Added text' : 'Unchanged text');

        const gutter = document.createElement('span');
        gutter.className = 'unified-gutter';
        gutter.setAttribute('aria-hidden', 'true');
        gutter.textContent = kind === 'removed' ? '−' : kind === 'added' ? '+' : ' ';
        row.appendChild(gutter);

        const content = document.createElement('span');
        content.className = 'unified-content';
        if (wordDiff?.length) {
            wordDiff.forEach(part => {
                if ((partKind === 'removed' && part.added) || (partKind === 'added' && part.removed)) return;
                const span = document.createElement('span');
                if (part.removed) span.className = 'diff-removed';
                if (part.added) span.className = 'diff-added';
                span.textContent = part.value;
                content.appendChild(span);
            });
        } else {
            content.textContent = text;
        }
        row.appendChild(content);
        return row;
    }

    function renderUnifiedDiff(model) {
        let changeIndex = 0;
        model.forEach(entry => {
            if (entry.kind === 'unchanged') {
                diffUnified.appendChild(createUnifiedRow('unchanged', entry.text));
                return;
            }

            const group = document.createElement('div');
            group.className = `unified-change unified-change-${entry.type}`;
            group.dataset.changeIndex = String(changeIndex);
            if (entry.removedText) {
                group.appendChild(createUnifiedRow('removed', entry.removedText, entry.wordDiff, 'removed'));
            }
            if (entry.addedText) {
                group.appendChild(createUnifiedRow('added', entry.addedText, entry.wordDiff, 'added'));
            }
            diffUnified.appendChild(group);
            diffElements[changeIndex].unifiedTarget = group;
            changeIndex++;
        });
    }

    function renderActiveDiffView() {
        diffLeft.replaceChildren();
        diffRight.replaceChildren();
        diffUnified.replaceChildren();
        minimapMarkers.replaceChildren();
        clearActiveHighlight();

        diffElements = currentDiffModel
            .filter(entry => entry.kind === 'changed')
            .map(entry => ({ type: entry.type, leftRow: null, rightRow: null, unifiedTarget: null }));
        totalDiffs = diffElements.length;

        if (mobileQuery.matches) {
            renderUnifiedDiff(currentDiffModel);
        } else {
            renderDesktopDiff(currentDiffModel);
        }
        updateNavState();

        requestAnimationFrame(() => {
            if (!mobileQuery.matches) {
                syncRowHeights();
                updateMinimap();
            }
        });
    }

    function renderDiff(text1, text2) {
        currentDiffModel = buildDiffModel(text1, text2);
        currentDiffIndex = -1;
        renderActiveDiffView();
    }

    function resetRowHeights() {
        diffLeft.querySelectorAll('.diff-row').forEach(row => { row.style.minHeight = ''; });
        diffRight.querySelectorAll('.diff-row').forEach(row => { row.style.minHeight = ''; });
    }

    function syncRowHeights() {
        resetRowHeights();
        const leftRows = diffLeft.querySelectorAll('.diff-row');
        const rightRows = diffRight.querySelectorAll('.diff-row');
        const count = Math.min(leftRows.length, rightRows.length);
        for (let index = 0; index < count; index++) {
            const maxHeight = Math.max(leftRows[index].offsetHeight, rightRows[index].offsetHeight);
            leftRows[index].style.minHeight = `${maxHeight}px`;
            rightRows[index].style.minHeight = `${maxHeight}px`;
        }
    }

    const minimap = document.getElementById('minimap');
    const minimapMarkers = document.createElement('div');
    minimapMarkers.className = 'minimap-markers';
    minimap.appendChild(minimapMarkers);
    const minimapViewport = document.createElement('div');
    minimapViewport.className = 'minimap-viewport';
    minimap.appendChild(minimapViewport);

    function updateMinimap() {
        minimapMarkers.replaceChildren();
        if (mobileQuery.matches || !diffElements.length) return;
        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);
        diffElements.forEach(item => {
            const marker = document.createElement('div');
            marker.className = `minimap-marker ${item.type}`;
            marker.style.top = `${(item.leftRow.offsetTop / scrollHeight) * 100}%`;
            marker.style.height = `${Math.max((item.leftRow.offsetHeight / scrollHeight) * 100, 0.5)}%`;
            minimapMarkers.appendChild(marker);
        });
        updateMinimapViewport();
    }

    function updateMinimapViewport() {
        if (mobileQuery.matches || !isDiffMode) return;
        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);
        if (!scrollHeight) return;
        minimapViewport.style.top = `${(diffLeft.scrollTop / scrollHeight) * 100}%`;
        minimapViewport.style.height = `${(diffLeft.clientHeight / scrollHeight) * 100}%`;
    }

    let isDragging = false;
    let dragStartY = 0;
    let dragStartScrollTop = 0;
    let hasDragged = false;

    minimap.addEventListener('mousedown', event => {
        if (mobileQuery.matches) return;
        const viewportRect = minimapViewport.getBoundingClientRect();
        if (event.clientY >= viewportRect.top && event.clientY <= viewportRect.bottom) {
            isDragging = true;
            hasDragged = false;
            dragStartY = event.clientY;
            dragStartScrollTop = diffLeft.scrollTop;
        }
        event.preventDefault();
    });

    document.addEventListener('mousemove', event => {
        if (!isDragging) return;
        if (Math.abs(event.clientY - dragStartY) > 3) hasDragged = true;
        if (!hasDragged) return;
        const rect = minimap.getBoundingClientRect();
        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);
        const scrollDelta = ((event.clientY - dragStartY) / rect.height) * scrollHeight;
        diffLeft.scrollTop = dragStartScrollTop + scrollDelta;
        diffRight.scrollTop = dragStartScrollTop + scrollDelta;
    });

    document.addEventListener('mouseup', event => {
        if (mobileQuery.matches) return;
        const wasDragging = isDragging;
        const wasClick = isDragging && !hasDragged;
        isDragging = false;
        hasDragged = false;

        const rect = minimap.getBoundingClientRect();
        const isInside = event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (!isInside || (wasDragging && !wasClick)) return;

        const scrollHeight = Math.max(diffLeft.scrollHeight, diffRight.scrollHeight, diffLeft.clientHeight);
        const target = ((event.clientY - rect.top) / rect.height) * scrollHeight;
        let nearestIndex = -1;
        let nearestDistance = Infinity;
        diffElements.forEach((item, index) => {
            const distance = Math.abs(item.leftRow.offsetTop + (item.leftRow.offsetHeight / 2) - target);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        if (nearestIndex >= 0) scrollToDiff(nearestIndex);
    });

    function updateNavState() {
        const hasDiffs = totalDiffs > 0;
        diffCounter.textContent = hasDiffs ? `${currentDiffIndex >= 0 ? currentDiffIndex + 1 : 0}/${totalDiffs}` : '0/0';
        prevDiffBtn.disabled = !hasDiffs;
        nextDiffBtn.disabled = !hasDiffs;
    }

    function clearActiveHighlight() {
        document.querySelectorAll('.diff-row-active').forEach(element => element.classList.remove('diff-row-active'));
    }

    function highlightDiff(index) {
        const item = diffElements[index];
        item.leftRow?.classList.add('diff-row-active');
        item.rightRow?.classList.add('diff-row-active');
        item.unifiedTarget?.classList.add('diff-row-active');
    }

    function scrollToDiff(index, behavior = 'smooth') {
        if (!diffElements[index]) return;
        clearActiveHighlight();
        highlightDiff(index);
        const target = mobileQuery.matches ? diffElements[index].unifiedTarget : diffElements[index].leftRow;
        target?.scrollIntoView({ behavior, block: 'center' });
        currentDiffIndex = index;
        updateNavState();
    }

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

    function clearAll() {
        inputLeft.value = '';
        inputRight.value = '';
        localStorage.removeItem('wtd_input_left');
        localStorage.removeItem('wtd_input_right');
        setMode('edit');
    }

    function swapTexts() {
        const temporary = inputLeft.value;
        inputLeft.value = inputRight.value;
        inputRight.value = temporary;
        saveToStorage();
        if (isDiffMode) renderDiff(inputLeft.value, inputRight.value);
    }

    function setSyncScrolling(checked) {
        isSyncScrolling = checked;
        syncScrollBtn.checked = checked;
    }

    function setupDragAndDrop(element, inputElement) {
        element.addEventListener('dragover', event => {
            event.preventDefault();
            element.classList.add('drag-over');
        });
        element.addEventListener('dragleave', event => {
            event.preventDefault();
            element.classList.remove('drag-over');
        });
        element.addEventListener('drop', event => {
            event.preventDefault();
            element.classList.remove('drag-over');
            const file = event.dataTransfer.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = loadEvent => {
                inputElement.value = loadEvent.target.result;
                saveToStorage();
                if (isDiffMode) renderDiff(inputLeft.value, inputRight.value);
            };
            reader.readAsText(file);
        });
    }

    function handleScrollLeft() {
        if (!isSyncScrolling || mobileQuery.matches) return;
        if (isSyncingLeft) {
            isSyncingLeft = false;
            return;
        }
        isSyncingRight = true;
        diffRight.scrollTop = diffLeft.scrollTop;
        diffRight.scrollLeft = diffLeft.scrollLeft;
    }

    function handleScrollRight() {
        if (!isSyncScrolling || mobileQuery.matches) return;
        if (isSyncingRight) {
            isSyncingRight = false;
            return;
        }
        isSyncingLeft = true;
        diffLeft.scrollTop = diffRight.scrollTop;
        diffLeft.scrollLeft = diffRight.scrollLeft;
    }

    function handleCopy(event) {
        if (!copyAsRichText) return;
        const selectedText = event.target instanceof HTMLTextAreaElement
            ? event.target.value.slice(event.target.selectionStart, event.target.selectionEnd)
            : window.getSelection().toString();
        if (!selectedText) return;
        event.preventDefault();
        event.clipboardData.setData('text/plain', selectedText);
        event.clipboardData.setData('text/html', marked.parse(selectedText));
    }

    async function copyToClipboard(text, button) {
        button.disabled = true;
        try {
            if (copyAsRichText) {
                const clipboardItem = new ClipboardItem({
                    'text/plain': new Blob([text], { type: 'text/plain' }),
                    'text/html': new Blob([marked.parse(text)], { type: 'text/html' })
                });
                await navigator.clipboard.write([clipboardItem]);
            } else {
                await navigator.clipboard.writeText(text);
            }
            button.textContent = 'Copied!';
        } catch (error) {
            console.error('Failed to copy: ', error);
            button.textContent = 'Error';
        }
        setTimeout(() => {
            button.textContent = 'Copy';
            button.disabled = false;
        }, 2000);
    }

    function handleBreakpointChange() {
        closeMoreSheet(false);
        if (!isDiffMode) return;
        const selectedIndex = currentDiffIndex;
        renderActiveDiffView();
        requestAnimationFrame(() => {
            if (selectedIndex >= 0 && selectedIndex < totalDiffs) scrollToDiff(selectedIndex, 'auto');
        });
    }

    loadFromStorage();
    loadSettings();
    setActiveMobilePane('left');
    mobileMoreBtn.setAttribute('aria-expanded', 'false');

    modeOptions.forEach(option => option.addEventListener('click', () => setMode(option.dataset.mode)));
    mobilePaneOptions.forEach(option => option.addEventListener('click', () => setActiveMobilePane(option.dataset.pane)));

    settingsBtn.addEventListener('click', () => openSettings(settingsBtn));
    settingsClose.addEventListener('click', closeSettings);
    settingsModal.addEventListener('click', event => { if (event.target === settingsModal) closeSettings(); });
    pasteMarkdownCheckbox.addEventListener('change', () => {
        pasteAsMarkdown = pasteMarkdownCheckbox.checked;
        saveSettings();
    });
    copyRichtextCheckbox.addEventListener('change', () => {
        copyAsRichText = copyRichtextCheckbox.checked;
        saveSettings();
    });

    mobileMoreBtn.addEventListener('click', openMoreSheet);
    moreSheetClose.addEventListener('click', () => closeMoreSheet());
    moreSheet.addEventListener('click', event => { if (event.target === moreSheet) closeMoreSheet(); });
    mobileSettingsBtn.addEventListener('click', () => openSettings(mobileMoreBtn));
    mobileSwapBtn.addEventListener('click', () => {
        swapTexts();
        closeMoreSheet();
    });
    mobileClearBtn.addEventListener('click', () => {
        clearAll();
        closeMoreSheet();
    });

    document.addEventListener('keydown', event => {
        if (!settingsModal.classList.contains('hidden')) {
            if (event.key === 'Escape') closeSettings();
            else trapFocus(event, settingsModal);
        } else if (!moreSheet.classList.contains('hidden')) {
            if (event.key === 'Escape') closeMoreSheet();
            else trapFocus(event, moreSheet);
        }
    });

    clearBtn.addEventListener('click', clearAll);
    swapBtn.addEventListener('click', swapTexts);
    syncScrollBtn.addEventListener('change', () => setSyncScrolling(syncScrollBtn.checked));

    inputLeft.addEventListener('input', saveToStorage);
    inputRight.addEventListener('input', saveToStorage);
    inputLeft.addEventListener('paste', handlePaste);
    inputRight.addEventListener('paste', handlePaste);
    inputLeft.addEventListener('copy', handleCopy);
    inputRight.addEventListener('copy', handleCopy);
    copyLeftBtn.addEventListener('click', () => copyToClipboard(inputLeft.value, copyLeftBtn));
    copyRightBtn.addEventListener('click', () => copyToClipboard(inputRight.value, copyRightBtn));

    prevDiffBtn.addEventListener('click', () => {
        if (!totalDiffs) return;
        scrollToDiff(currentDiffIndex <= 0 ? totalDiffs - 1 : currentDiffIndex - 1);
    });
    nextDiffBtn.addEventListener('click', () => {
        if (!totalDiffs) return;
        scrollToDiff(currentDiffIndex >= totalDiffs - 1 ? 0 : currentDiffIndex + 1);
    });

    diffLeft.addEventListener('scroll', handleScrollLeft);
    diffLeft.addEventListener('scroll', () => { if (isDiffMode) requestAnimationFrame(updateMinimapViewport); });
    diffRight.addEventListener('scroll', handleScrollRight);
    window.addEventListener('resize', () => {
        if (!isDiffMode || mobileQuery.matches) return;
        clearTimeout(window.minimapTimeout);
        window.minimapTimeout = setTimeout(() => {
            syncRowHeights();
            updateMinimap();
        }, 100);
    });
    mobileQuery.addEventListener('change', handleBreakpointChange);

    setupDragAndDrop(paneLeft, inputLeft);
    setupDragAndDrop(paneRight, inputRight);
});
