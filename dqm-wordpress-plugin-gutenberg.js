(function addDqmCmsButton() {
    const __ = window.wp && wp.i18n && wp.i18n.__ ? wp.i18n.__ : function (s) { return s; };
    const TABLIST_SELECTOR = 'div[role="tablist"][aria-orientation="horizontal"]';
    const BUTTON_ID = 'dqm-cms-tab';
    const BUTTON_LABEL = __('Crownpeak DQM', 'dqm-wordpress-plugin');
    const PANEL_ID = 'dqm-cms-panel';

    function showDqmPanel(show) {
        let panel = document.getElementById(PANEL_ID);
        if (!panel && show) {
            const sidebar = document.querySelector('.interface-interface-skeleton__sidebar .editor-sidebar');
            if (!sidebar) return;
            panel = document.createElement('div');
            panel.id = PANEL_ID;
            panel.className = 'components-panel dqm-panel';
            const scoreCardContainer = document.createElement('div');
            scoreCardContainer.id = 'dqm-score-card-container';
            panel.appendChild(scoreCardContainer);
            const scanBtn = document.createElement('button');
            scanBtn.id = 'dqm-scan-content-sidebar-btn';
            scanBtn.textContent = __('Run Quality Check', 'dqm-wordpress-plugin');
            scanBtn.style.display = 'block';
            scanBtn.style.width = '100%';
            scanBtn.className = 'primary-button';
            const topicsDiv = document.createElement('div');
            topicsDiv.style.marginTop = '1em';
            const topicsLabel = document.createElement('label');
            topicsLabel.textContent = __('All Topics:', 'dqm-wordpress-plugin');
            topicsLabel.setAttribute('for', 'dqm-topics-dropdown');
            topicsLabel.style.display = 'block';
            topicsLabel.style.marginBottom = '0.25em';
            topicsLabel.className = 'dqm-topics-label';
            const topicsDropdown = document.createElement('select');
            topicsDropdown.id = 'dqm-topics-dropdown';
            topicsDropdown.style.width = '100%';
            const defaultOption = document.createElement('option');
            defaultOption.value = 'all';
            defaultOption.textContent = __('All Topics', 'dqm-wordpress-plugin');
            topicsDropdown.appendChild(defaultOption);
            const topicsLoading = document.createElement('span');
            topicsLoading.id = 'dqm-topics-loading';
            topicsLoading.textContent = __('Loading...', 'dqm-wordpress-plugin');
            topicsLoading.style.display = 'inline';
            topicsLoading.style.marginLeft = '0.5em';
            topicsLoading.className = '';
            topicsDiv.appendChild(topicsLabel);
            topicsDiv.appendChild(topicsDropdown);
            topicsDiv.appendChild(topicsLoading);
            const failedCheckpointsCard = document.createElement('div');
            failedCheckpointsCard.className = 'card';
            const failedHeader = document.createElement('h3');
            failedHeader.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ff5630;margin-right:8px;"></i>' + __('Failed Checkpoints', 'dqm-wordpress-plugin');
            failedCheckpointsCard.appendChild(failedHeader);
            
            const checkpointsList = document.createElement('div');
            checkpointsList.id = 'dqm-checkpoints-list';
            checkpointsList.className = '';
            failedCheckpointsCard.appendChild(checkpointsList);

            let allCheckpoints = [];
            let allTopics = new Set();
            let checkpointStatusMap = {};
            let lastAssetId = null;

            function renderCheckpointsList(selectedTopic) {
                checkpointsList.innerHTML = '';
                let filtered = selectedTopic === 'all'
                    ? allCheckpoints
                    : allCheckpoints.filter(cp => Array.isArray(cp.topics) && cp.topics.includes(selectedTopic));

                let failed = filtered.filter(cp => checkpointStatusMap[cp.id]);
                failedCheckpointsCard.style.display = '';

                const card = document.createElement('div');
                card.className = 'card';
                const failedCount = failed.length;

                if (failedCount === 0) {
                    const noFailuresMsg = document.createElement('div');
                    noFailuresMsg.style.padding = '10px';
                    noFailuresMsg.style.textAlign = 'center';
                    noFailuresMsg.style.color = '#666';
                    noFailuresMsg.textContent = selectedTopic === 'all' 
                        ? __('No failed checkpoints found!', 'dqm-wordpress-plugin')
                        : __('No failed checkpoints found for this topic.', 'dqm-wordpress-plugin');
                    card.appendChild(noFailuresMsg);
                } else {
                    const ul = document.createElement('ul');
                    ul.className = 'checkpoint-list';
                    
                    failed.forEach(cp => {
                        const li = document.createElement('li');
                        li.className = 'checkpoint-item';
                        const iconTitleDiv = document.createElement('div');
                        iconTitleDiv.className = 'checkpoint-icon-title';

                        const iconTitleRow = document.createElement('div');
                        iconTitleRow.className = 'checkpoint-icon-title-row';
                        iconTitleRow.style.display = 'flex';
                        iconTitleRow.style.alignItems = 'center';
                        iconTitleRow.style.gap = '8px';
                        const iconDiv = document.createElement('div');
                        iconDiv.className = 'checkpoint-icon failed';
                        iconDiv.textContent = '!';
                        iconDiv.style.cursor = 'pointer';
                        iconDiv.addEventListener('mouseenter', function (e) {
                            showCheckpointDialog({
                                name: cp.name,
                                description: cp.description || '',
                                topics: []
                            });
                            if (checkpointDialog) {
                                const topicsDiv = checkpointDialog.querySelector('.dqm-modal-topics');
                                if (topicsDiv) topicsDiv.style.display = 'none';
                            }
                        });
                        iconDiv.addEventListener('mouseleave', function (e) {
                            if (checkpointDialog) {
                                checkpointDialog.style.display = 'none';
                            }
                        });
                        iconTitleRow.appendChild(iconDiv);
                        const contentDiv = document.createElement('div');
                        contentDiv.style.display = 'flex';
                        contentDiv.style.flexDirection = 'column';
                        contentDiv.style.alignItems = 'flex-start';
                        const nameSpan = document.createElement('span');
                        nameSpan.textContent = cp.name;
                        nameSpan.className = 'checkpoint-title';
                        contentDiv.appendChild(nameSpan);
                        if (Array.isArray(cp.topics) && cp.topics.length > 0) {
                            const badgesDiv = document.createElement('div');
                            badgesDiv.className = 'checkpoint-badges';
                            badgesDiv.style.display = 'flex';
                            badgesDiv.style.marginTop = '4px';
                            cp.topics.slice().sort((a, b) => {
                                if (!a) return -1;
                                if (!b) return 1;
                                return a.localeCompare(b);
                            }).forEach(topic => {
                                const badge = document.createElement('span');
                                badge.className = 'badge ' + (topic || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
                                badge.textContent = topic;
                                badgesDiv.appendChild(badge);
                            });
                            contentDiv.appendChild(badgesDiv);
                        }

                        iconTitleRow.appendChild(contentDiv);
                        iconTitleDiv.appendChild(iconTitleRow);

                        li.appendChild(iconTitleDiv);
                        ul.appendChild(li);
                    });
                    card.appendChild(ul);
                }

                checkpointsList.appendChild(card);
            }

            fetch(ajaxurl + '?action=crownpeakDqmGetCheckpoints', { credentials: 'same-origin' })
                .then(response => response.json())
                .then(data => {
                    topicsLoading.style.display = 'none';
                    if (data.success && Array.isArray(data.checkpoints)) {
                        allCheckpoints = data.checkpoints;
                        data.checkpoints.forEach(cp => {
                            if (Array.isArray(cp.topics)) {
                                cp.topics.forEach(t => allTopics.add(t));
                            }
                        });
                        Array.from(allTopics).sort().forEach(topic => {
                            var opt = document.createElement('option');
                            opt.value = topic;
                            opt.textContent = topic;
                            topicsDropdown.appendChild(opt);
                        });
                        renderCheckpointsList('all');
                    } else {
                        var opt = document.createElement('option');
                        opt.value = '';
                        opt.textContent = __('No topics found', 'dqm-wordpress-plugin');
                        topicsDropdown.appendChild(opt);
                        checkpointsList.innerHTML = '<em>' + __('No checkpoints found.', 'dqm-wordpress-plugin') + '</em>';
                    }
                })
                .catch(() => {
                    topicsLoading.style.display = 'none';
                    var opt = document.createElement('option');
                    opt.value = '';
                    opt.textContent = __('Error loading topics', 'dqm-wordpress-plugin');
                    topicsDropdown.appendChild(opt);
                    checkpointsList.innerHTML = '<em>' + __('Error loading checkpoints.', 'dqm-wordpress-plugin') + '</em>';
                });

            topicsDropdown.addEventListener('change', function () {
                renderCheckpointsList(this.value);
            });

            const scanBtnContainer = document.createElement('div');
            scanBtnContainer.id = 'dqm-scan-btn-container';
            scanBtnContainer.appendChild(scanBtn);

            const resultDiv = document.createElement('div');
            resultDiv.id = 'dqm-scan-result-sidebar';
            resultDiv.style.marginTop = '1em';
            resultDiv.style.display = 'none';
            resultDiv.className = '';

            const topicsContainer = document.createElement('div');
            topicsContainer.id = 'dqm-topics-container';
            topicsContainer.style.display = 'none';
            topicsContainer.className = '';
            topicsContainer.appendChild(topicsDiv);
            topicsContainer.appendChild(failedCheckpointsCard);
            function renderScoreCard(passedCount, totalCount) {
                const percent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
                let html = `
                    
                    <div class="card">
                        <h3>📊 Quality Overview</h3>
                        <div class="chart-container">
                            <div class="pie-chart"></div>
                            <div class="legend">
                                <div class="legend-item">
                                    <div class="legend-color passed"></div>
                                    <span>Passed (${passedCount})</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color failed"></div>
                                    <span>Failed (${totalCount - passedCount})</span>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                if (Array.isArray(allCheckpoints) && allCheckpoints.length > 0 && allTopics && allTopics.size > 0) {

                    const topicColors = {
                        'Accessibility': '#006675',
                        'SEO': '#2fe8b6',
                        'Brand': '#3636c5',
                        'Regulatory': '#b604d4',
                        'Legal': '#001746',
                        'Usability': '#36b37e',
                    };
                    html += `<div class="card">
                        <h3>📈 ${__('Quality Breakdown', 'dqm-wordpress-plugin')}</h3>`;
                    Array.from(allTopics).sort().forEach((topicRaw, idx, arr) => {
                        const topic = (topicRaw || '').trim();
                        const checkpoints = allCheckpoints.filter(cp => Array.isArray(cp.topics) && cp.topics.map(t => (t || '').trim()).includes(topic));
                        const total = checkpoints.length;
                        const passed = checkpoints.filter(cp => !checkpointStatusMap[cp.id]).length;
                        const percent = total > 0 ? Math.round((passed / total) * 100) : 0;
                        const color = topicColors[topic] || '#888';
                        const badgeClass = 'badge ' + topic.toLowerCase().replace(/[^a-z0-9]+/g, '-');
                        if (idx > 0) {
                            html += `<hr class="dqm-breakdown-divider">`;
                        }
                        html += `
                            <div style="margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                                    <span class="${badgeClass}" style="background:${color}">${topic}</span>
                                    <span>${passed}/${total} ${__('passed', 'dqm-wordpress-plugin')}</span>
                                </div>
                                <div style="background: #e1e3e5; height: 8px; border-radius: 4px;">
                                    <div style="background: ${color}; width: ${percent}%; height: 100%; border-radius: 4px;"></div>
                                </div>
                            </div>
                        `;
                    });
                    html += `</div>`;
                }
                scoreCardContainer.innerHTML = html;
                const pieChart = scoreCardContainer.querySelector('.pie-chart');
                if (pieChart) {
                    const passedAngle = totalCount > 0 ? (passedCount / totalCount) * 360 : 0;
                    pieChart.style.background = `conic-gradient(#b604d4 0deg ${passedAngle}deg,#303747 ${passedAngle}deg 360deg)`;
                    pieChart.textContent = '';
                    const percentLabel = document.createElement('div');
                    percentLabel.style.position = 'absolute';
                    percentLabel.style.top = '50%';
                    percentLabel.style.left = '50%';
                    percentLabel.style.transform = 'translate(-50%, -50%)';
                    percentLabel.style.background = 'white';
                    percentLabel.style.borderRadius = '50%';
                    percentLabel.style.width = '80px';
                    percentLabel.style.height = '80px';
                    percentLabel.style.display = 'flex';
                    percentLabel.style.alignItems = 'center';
                    percentLabel.style.justifyContent = 'center';
                    percentLabel.style.fontSize = '2em';
                    percentLabel.style.fontWeight = 'bold';
                    percentLabel.textContent = `${percent}%`;
                    pieChart.appendChild(percentLabel);
                }
            }
            function showTopicsWithCheckpoints() {
                topicsContainer.style.display = 'block';
                renderCheckpointsList(topicsDropdown.value);
            }
            async function fetchAndRenderErrors(assetId) {
                const apiKey = CrownpeakDQM.apiKey;
                const url = `https://api.crownpeak.net/dqm-cms/v1/assets/${assetId}/status?apiKey=${apiKey}&visibility=public`;
                resultDiv.innerHTML = __('Loading errors...', 'dqm-wordpress-plugin');
                try {
                    const resp = await fetch(url, {
                        headers: {
                            'x-api-key': apiKey,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }
                    });
                    const data = await resp.json();
                    checkpointStatusMap = {};
                    if (data && data.checkpoints && Array.isArray(data.checkpoints)) {
                        data.checkpoints.forEach(cp => {
                            checkpointStatusMap[cp.id] = !!cp.failed;
                        });
                        const total = data.checkpoints.length;
                        const passed = data.checkpoints.filter(cp => !cp.failed).length;
                        renderScoreCard(passed, total);
                        let html = '<h3>' + __('Detailed Errors', 'dqm-wordpress-plugin') + '</h3>';
                        let hasErrors = false;
                        data.checkpoints.forEach(cp => {
                            if (cp.failed && cp.issues && cp.issues.length > 0) {
                                hasErrors = true;
                                html += `<div style="margin-bottom:1em;"><strong>${cp.name}</strong><ul>`;
                                cp.issues.forEach(issue => {
                                    html += `<li>${issue.message || JSON.stringify(issue)}</li>`;
                                });
                                html += '</ul></div>';
                            }
                        });
                        if (!hasErrors) html += '<div>' + __('No errors found!', 'dqm-wordpress-plugin') + '</div>';
                        resultDiv.innerHTML = html;
                    } else {
                        resultDiv.innerHTML = __('No error data found.', 'dqm-wordpress-plugin');
                        scoreCardContainer.innerHTML = '';
                    }
                } catch (e) {
                    resultDiv.innerHTML = __('Failed to load errors: ', 'dqm-wordpress-plugin') + e.message;
                    scoreCardContainer.innerHTML = '';
                }
            }

            async function fetchAndRenderSpellcheck(assetId) {
                try {
                    const params = new URLSearchParams({ action: 'crownpeak_dqm_spellcheck', assetId });
                    const resp = await fetch(CrownpeakDQM.ajaxurl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params
                    });
                    const data = await resp.json();
                    if (data.success && data.data) {
                        let html = '<h3>' + __('Spellcheck Results', 'dqm-wordpress-plugin') + '</h3>';
                        const misspellings = data.data?.misspellings || data.misspellings;
                        if (Array.isArray(misspellings) && misspellings.length > 0) {
                            html += '<ul>';
                            misspellings.forEach(issue => {
                                html += `<li><strong>${issue.word}</strong> (${issue.occurrences} ` + __('occurrence', 'dqm-wordpress-plugin') + `${issue.occurrences > 1 ? __('s', 'dqm-wordpress-plugin') : ''})</li>`;
                            });
                            html += '</ul>';
                        } else {
                            html += '<div>' + __('No spelling issues found!', 'dqm-wordpress-plugin') + '</div>';
                        }
                    } else {
                    }
                } catch (e) {
                }
            }

            const scanBtnAfterFailed = document.createElement('button');
            scanBtnAfterFailed.id = 'dqm-scan-content-after-failed-btn';
            scanBtnAfterFailed.textContent = __('Run Quality Check', 'dqm-wordpress-plugin');
            scanBtnAfterFailed.style.display = 'block';
            scanBtnAfterFailed.style.width = '100%';
            scanBtnAfterFailed.className = 'primary-button';
            scanBtnAfterFailed.style.marginTop = '5px';
            topicsContainer.appendChild(scanBtnAfterFailed);
            const spinner = document.createElement('div');
            spinner.id = 'dqm-loading-spinner';
            spinner.className = 'dqm-spinner';
            spinner.style.display = 'none';
            scanBtnContainer.appendChild(spinner);

            panel.appendChild(scanBtnContainer);
            panel.appendChild(scoreCardContainer);
            panel.appendChild(resultDiv);
            panel.appendChild(topicsContainer);

            let postId = null;
            if (window.wp && wp.data) {
                try {
                    postId = wp.data.select('core/editor').getCurrentPostId();
                } catch (e) { }
            }
            const assetKey = postId ? `dqm_asset_id_${postId}` : null;
            lastAssetId = assetKey ? localStorage.getItem(assetKey) : null;
            async function runQualityCheck({ spinner, button }) {
                button.disabled = true;
                topicsContainer.style.display = 'none';
                scoreCardContainer.innerHTML = '';
                resultDiv.innerHTML = '';
                resultDiv.style.display = 'none';
                topicsLoading.style.display = 'none';
                spinner.style.display = 'block';
                let postId = null;
                let previewUrl = null;
                
                if (window.wp && wp.data) {
                    try {
                        postId = wp.data.select('core/editor').getCurrentPostId();
                        previewUrl = wp.data.select('core/editor').getPermalink();
                        if (!previewUrl && postId) {
                            previewUrl = `${window.location.origin}/?p=${postId}&preview=true`;
                        }
                    } catch (e) {
                        console.warn('Error getting post info:', e);
                    }
                }
                
                if (!previewUrl) {
                    spinner.style.display = 'none';
                    resultDiv.style.display = 'block';
                    resultDiv.textContent = __('Could not determine preview URL for this post.', 'dqm-wordpress-plugin');
                    resultDiv.setAttribute('role', 'alert');
                    button.disabled = false;
                    return;
                }
                
                let html = '';
                try {
                    const previewResponse = await fetch(previewUrl, {
                        credentials: 'same-origin',
                        headers: {
                            'Cache-Control': 'no-cache'
                        }
                    });
                    
                    if (!previewResponse.ok) {
                        throw new Error(`Preview fetch failed: ${previewResponse.status} ${previewResponse.statusText}`);
                    }
                    
                    html = await previewResponse.text();
                    
                    if (!html.trim()) {
                        throw new Error('Preview content is empty');
                    }
                } catch (previewError) {
                    console.warn('Failed to fetch preview content:', previewError);
                    spinner.style.display = 'none';
                    resultDiv.style.display = 'block';
                    resultDiv.textContent = __('Could not fetch preview content: ', 'dqm-wordpress-plugin') + previewError.message;
                    resultDiv.setAttribute('role', 'alert');
                    button.disabled = false;
                    return;
                }
                const params = new URLSearchParams({
                    action: 'crownpeak_dqm_scan',
                    content: html
                });
                if (lastAssetId) {
                    params.append('assetId', lastAssetId);
                    params.append('method', 'PUT');
                }
                try {
                    const response = await fetch(CrownpeakDQM.ajaxurl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: params
                    });
                    const data = await response.json();
                    if (data.success) {
                        if (panel.contains(scanBtnContainer) && panel.contains(scoreCardContainer)) {
                            panel.insertBefore(scanBtnContainer, scoreCardContainer);
                        }
                        lastAssetId = data.assetId;
                        if (assetKey) {
                            localStorage.setItem(assetKey, lastAssetId);
                        }
                        await fetchAndRenderErrors(data.assetId);
                        showTopicsWithCheckpoints();
                        spinner.style.display = 'none';
                        fetchAndRenderSpellcheck(data.assetId);
                        resultDiv.style.display = 'none';
                    } else {
                        spinner.style.display = 'none';
                        resultDiv.style.display = 'block';
                        resultDiv.textContent = __('Scan failed: ', 'dqm-wordpress-plugin') + (data.message || __('Unknown error', 'dqm-wordpress-plugin'));
                        resultDiv.setAttribute('role', 'alert');
                    }
                } catch (e) {
                    spinner.style.display = 'none';
                    resultDiv.style.display = 'block';
                    resultDiv.textContent = __('Scan failed: ', 'dqm-wordpress-plugin') + (e.message || __('Unknown error', 'dqm-wordpress-plugin'));
                    resultDiv.setAttribute('role', 'alert');
                } finally {
                    button.disabled = false;
                }
            }
            scanBtn.onclick = function () {
                runQualityCheck({ spinner, button: scanBtn });
            };
            scanBtnAfterFailed.onclick = function () {
                runQualityCheck({ spinner, button: scanBtnAfterFailed });
            };

            const tablist = document.querySelector('div[role="tablist"][aria-orientation="horizontal"]');
            if (tablist && tablist.parentNode) {
                if (tablist.parentNode.nextSibling) {
                    sidebar.insertBefore(panel, tablist.parentNode.nextSibling);
                } else {
                    sidebar.appendChild(panel);
                }
            } else {
                sidebar.appendChild(panel);
            }
            document.addEventListener('mousedown', function (e) {
                if (checkpointIssuesDialog && checkpointIssuesDialog.style.display !== 'none') {
                    if (!checkpointIssuesDialog.contains(e.target) && !checkpointsList.contains(e.target)) {
                        checkpointIssuesDialog.style.display = 'none';
                    }
                }
            });
        } else if (panel) {
            panel.style.display = show ? '' : 'none';
        }
    }

    function updateTabIndicatorPosition(activeTab, tablist) {
        if (!activeTab || !tablist) return;
        const rect = activeTab.getBoundingClientRect();
        const tablistRect = tablist.getBoundingClientRect();
        const left = rect.left - tablistRect.left;
        const top = rect.top - tablistRect.top;
        const width = rect.width;
        const height = rect.height;
        const right = left + width;
        const bottom = top + height;
        tablist.style.setProperty('--selected-left', Math.round(left));
        tablist.style.setProperty('--selected-top', Math.round(top));
        tablist.style.setProperty('--selected-right', Math.round(right));
        tablist.style.setProperty('--selected-bottom', Math.round(bottom));
        tablist.style.setProperty('--selected-width', Math.round(width));
        tablist.style.setProperty('--selected-height', Math.round(height));
    }

    function injectButton() {
        const tablist = document.querySelector(TABLIST_SELECTOR);
        if (!tablist || document.getElementById(BUTTON_ID)) return;
        const firstTab = tablist.querySelector('button[role="tab"]');
        if (!firstTab) return;
        const dqmButton = firstTab.cloneNode(true);
        dqmButton.id = BUTTON_ID;
        dqmButton.setAttribute('aria-selected', 'false');
        dqmButton.setAttribute('data-tab-id', 'dqm-cms');
        dqmButton.setAttribute('aria-controls', 'dqm-cms-view');
        dqmButton.tabIndex = -1;
        dqmButton.classList.add('components-tab-panel__tabs-item');
        const span = dqmButton.querySelector('span');
        if (span) span.textContent = BUTTON_LABEL;
        dqmButton.classList.remove('is-active');
        dqmButton.addEventListener('click', function () {
            tablist.querySelectorAll('button[role="tab"]').forEach(btn => {
                btn.setAttribute('aria-selected', 'false');
                btn.classList.remove('is-active');
                btn.removeAttribute('data-active-item');
            });
            dqmButton.setAttribute('aria-selected', 'true');
            dqmButton.classList.add('is-active');
            updateTabIndicatorPosition(dqmButton, tablist);      
            document.querySelectorAll('.editor-sidebar > div.components-panel').forEach(panel => {
                panel.classList.remove('is-opened', 'is-active');
                if (panel.id !== PANEL_ID) {
                    panel.style.display = 'none';
                }
            });
            let dqmPanel = document.getElementById(PANEL_ID);
            if (dqmPanel) {
                dqmPanel.classList.add('is-opened', 'is-active');
                dqmPanel.style.display = '';
            }
            showDqmPanel(true);
        });
        tablist.appendChild(dqmButton);
    }

    function handleTabSwitch() {
        const tablist = document.querySelector(TABLIST_SELECTOR);
        if (!tablist) return;
        tablist.addEventListener('click', function (e) {
            const tab = e.target.closest('button[role="tab"]');
            if (!tab) return;
            const isDqmTab = tab.id === BUTTON_ID;
            tablist.querySelectorAll('button[role="tab"]').forEach(btn => {
                btn.classList.toggle('is-active', btn === tab);
                btn.setAttribute('aria-selected', btn === tab ? 'true' : 'false');
            });
            document.querySelectorAll('.editor-sidebar > div.components-panel').forEach(panel => {
                if (panel.id === PANEL_ID) {
                    panel.classList.toggle('is-opened', isDqmTab);
                    panel.classList.toggle('is-active', isDqmTab);
                    panel.style.display = isDqmTab ? '' : 'none';
                } else {
                    panel.classList.remove('is-opened', 'is-active');
                    panel.style.display = isDqmTab ? 'none' : '';
                }
            });
            showDqmPanel(isDqmTab);
        });
    }

    const observer = new MutationObserver(() => {
        injectButton();
        handleTabSwitch();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    injectButton();
    handleTabSwitch();

    let checkpointDialog = null;
    function showCheckpointDialog(cp) {
        if (!checkpointDialog) {
            checkpointDialog = document.createElement('div');
            checkpointDialog.id = 'dqm-checkpoint-dialog';
            checkpointDialog.setAttribute('role', 'dialog');
            checkpointDialog.setAttribute('aria-modal', 'true');
            checkpointDialog.setAttribute('tabindex', '-1');
            checkpointDialog.style.position = 'fixed';
            checkpointDialog.style.top = '80px';
            checkpointDialog.style.right = '140px';
            checkpointDialog.style.zIndex = '9999';
            checkpointDialog.style.background = '#fff';
            checkpointDialog.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
            checkpointDialog.style.borderRadius = '8px';
            checkpointDialog.style.padding = '1.5em 2em 1.5em 1.5em';
            checkpointDialog.style.minWidth = '340px';
            checkpointDialog.style.maxWidth = '420px';
            checkpointDialog.style.maxHeight = '70vh';
            checkpointDialog.style.overflowY = 'auto';
            checkpointDialog.style.transition = 'opacity 0.2s';
            checkpointDialog.style.opacity = '1';
            checkpointDialog.style.display = 'block';
            document.body.appendChild(checkpointDialog);
        }
        checkpointDialog.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '18px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '1.5em';
        closeBtn.style.cursor = 'pointer';
        closeBtn.setAttribute('aria-label', __('Close', 'dqm-wordpress-plugin'));
        closeBtn.onclick = () => {
            checkpointDialog.style.display = 'none';
            if (checkpointDialog._lastActiveElement) {
                checkpointDialog._lastActiveElement.focus();
            }
        };
        checkpointDialog.appendChild(closeBtn);
        const name = document.createElement('div');
        name.style.fontWeight = 'bold';
        name.style.fontSize = '1.15em';
        name.style.marginBottom = '0.5em';
        name.textContent = cp.name;
        name.className = 'dqm-modal-title';
        checkpointDialog.appendChild(name);
        if (cp.description) {
            const desc = document.createElement('div');
            desc.style.fontSize = '1em';
            desc.style.color = '#333';
            desc.style.marginBottom = '0.75em';
            desc.innerHTML = cp.description;
            desc.className = 'dqm-modal-desc';
            checkpointDialog.appendChild(desc);
        }
        if (Array.isArray(cp.topics) && cp.topics.length > 0) {
            const topics = document.createElement('div');
            topics.style.fontSize = '0.95em';
            topics.style.color = '#888';
            topics.textContent = __('Topics: ', 'dqm-wordpress-plugin') + cp.topics.join(', ');
            topics.className = 'dqm-modal-topics';
            checkpointDialog.appendChild(topics);
        }
        checkpointDialog.style.display = 'block';
        checkpointDialog.style.opacity = '1';
        checkpointDialog._lastActiveElement = document.activeElement;
        closeBtn.focus();
        checkpointDialog.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                closeBtn.focus();
            }
            if (e.key === 'Escape') {
                closeBtn.click();
            }
        });
    }
    document.addEventListener('mousedown', function (e) {
        if (checkpointDialog && checkpointDialog.style.display !== 'none') {
            if (!checkpointDialog.contains(e.target) && !checkpointsList.contains(e.target)) {
                checkpointDialog.style.display = 'none';
                const radios = checkpointsList.querySelectorAll('input[type="radio"]');
                radios.forEach(r => r.checked = false);
            }
        }
    });

    let checkpointIssuesDialog = null;
    function showCheckpointIssuesDialog(assetId, checkpointId, checkpointName) {
        if (!checkpointIssuesDialog) {
            checkpointIssuesDialog = document.createElement('div');
            checkpointIssuesDialog.id = 'dqm-checkpoint-issues-dialog';
            checkpointIssuesDialog.setAttribute('role', 'dialog');
            checkpointIssuesDialog.setAttribute('aria-modal', 'true');
            checkpointIssuesDialog.setAttribute('tabindex', '-1');
            checkpointIssuesDialog.style.position = 'fixed';
            checkpointIssuesDialog.style.top = '100px';
            checkpointIssuesDialog.style.right = '140px';
            checkpointIssuesDialog.style.zIndex = '9999';
            checkpointIssuesDialog.style.background = '#fff';
            checkpointIssuesDialog.style.boxShadow = '0 4px 24px rgba(0,0,0,0.18)';
            checkpointIssuesDialog.style.borderRadius = '8px';
            checkpointIssuesDialog.style.padding = '1.5em 2em 1.5em 1.5em';
            checkpointIssuesDialog.style.minWidth = '340px';
            checkpointIssuesDialog.style.maxWidth = '420px';
            checkpointIssuesDialog.style.maxHeight = '70vh';
            checkpointIssuesDialog.style.overflowY = 'auto';
            checkpointIssuesDialog.style.transition = 'opacity 0.2s';
            checkpointIssuesDialog.style.opacity = '1';
            checkpointIssuesDialog.style.display = 'block';
            document.body.appendChild(checkpointIssuesDialog);
        }
        checkpointIssuesDialog.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '10px';
        closeBtn.style.right = '18px';
        closeBtn.style.background = 'none';
        closeBtn.style.border = 'none';
        closeBtn.style.fontSize = '1.5em';
        closeBtn.style.cursor = 'pointer';
        closeBtn.setAttribute('aria-label', __('Close', 'dqm-wordpress-plugin'));
        closeBtn.onclick = () => {
            checkpointIssuesDialog.style.display = 'none';
            if (checkpointIssuesDialog._lastActiveElement) {
                checkpointIssuesDialog._lastActiveElement.focus();
            }
        };
        checkpointIssuesDialog.appendChild(closeBtn);
        const name = document.createElement('div');
        name.style.fontWeight = 'bold';
        name.style.fontSize = '1.15em';
        name.style.marginBottom = '0.5em';
        name.textContent = checkpointName + ' - ' + __('Issues', 'dqm-wordpress-plugin');
        name.className = 'dqm-modal-title';
        checkpointIssuesDialog.appendChild(name);
        const contentDiv = document.createElement('div');
        contentDiv.textContent = __('Loading issues...', 'dqm-wordpress-plugin');
        checkpointIssuesDialog.appendChild(contentDiv);
        const apiKey = CrownpeakDQM.apiKey;
        const url = `https://api.crownpeak.net/dqm-cms/v1/assets/${assetId}/errors/${checkpointId}?apiKey=${apiKey}`;
        fetch(url, {
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        })
            .then(resp => resp.json())
            .then(data => {
                let html = '';
                if (data && data.statusCode && data.message) {
                    html = `<div>${data.message}</div>`;
                } else if (data && Array.isArray(data.issues) && data.issues.length > 0) {
                    html += '<ul>';
                    data.issues.forEach(issue => {
                        html += `<li>${issue.message || JSON.stringify(issue)}</li>`;
                    });
                    html += '</ul>';
                } else {
                    html += '<div>' + __('No issues found for this checkpoint.', 'dqm-wordpress-plugin') + '</div>';
                }
                contentDiv.innerHTML = html;
            })
            .catch(e => {
                contentDiv.innerHTML = '<div>' + __('Failed to load issues: ', 'dqm-wordpress-plugin') + e.message + '</div>';
            });
        checkpointIssuesDialog.style.display = 'block';
        checkpointIssuesDialog.style.opacity = '1';
        checkpointIssuesDialog._lastActiveElement = document.activeElement;
        closeBtn.focus();
        checkpointIssuesDialog.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                closeBtn.focus();
            }
            if (e.key === 'Escape') {
                closeBtn.click();
            }
        });
    }
})();