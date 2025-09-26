(function addDqmCmsButton() {
    let checkpointsList = null;
    let allCheckpoints = [];
    let allTopics = new Set();
    let checkpointStatusMap = {};
    let lastAssetId = null;
    let currentHighlightMode = 'page';
    let toggleButton = null;
    let currentCheckpointForToggle = null;

    const __ = window.wp && wp.i18n && wp.i18n.__ ? wp.i18n.__ : function (s) { return s; };
    const TABLIST_SELECTOR = 'div[role="tablist"][aria-orientation="horizontal"]';
    const BUTTON_ID = 'dqm-cms-tab';
    const BUTTON_LABEL = __('Crownpeak DQM', 'dqm-wordpress-plugin');
    const PANEL_ID = 'dqm-cms-panel';

    function injectHighlightCSS() {
        return;
    }
    function getEditorIframe() {
        const iframeSelectors = [
            'iframe[name="editor-canvas"]',
            'iframe.editor-canvas__iframe',
            'iframe[name="editor-canvas"]',
            '.block-editor-iframe__body iframe',
            '.edit-post-visual-editor iframe'
        ];

        for (const selector of iframeSelectors) {
            const iframe = document.querySelector(selector);
            if (iframe && iframe.contentDocument) {
                return iframe;
            }
        }
        return null;
    }

    function getEditorDocument() {
        const iframe = getEditorIframe();
        return iframe ? iframe.contentDocument : document;
    }

    function normalizeText(text) {
        return text
            .trim()
            .replace(/&#8217;/g, "'")
            .replace(/&#8220;|&#8221;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/\s+/g, ' ');
    }

    let currentHighlightedCheckpointId = null;

    function showNotification(message, type = 'error') {
        const notification = document.createElement('div');
        notification.className = `dqm-notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
    }

    function showPreviewContentDialog(checkpointId, checkpointName, highlightedHtml) {
    const parser = new DOMParser();
    const apiDoc = parser.parseFromString(highlightedHtml, "text/html");
        const highlightedElements = apiDoc.querySelectorAll('[style*="background:yellow"], [style*="background-color:yellow"], [style*="background: yellow"]');

    let contentHtml =
        '<p class="dqm-preview-subtitle">' +
        __(
        "This issue was found in the preview content so not visible in editor page. The highlighted text below shows where the problem occurs:",
        "dqm-wordpress-plugin"
        ) +
        "</p>";

    if (highlightedElements.length > 0) {
        contentHtml += '<div class="dqm-preview-content-wrapper">';
        highlightedElements.forEach((element, index) => {
        if (index > 0) {
            contentHtml += '<hr class="dqm-preview-content-divider">';
        }
        contentHtml += `<div class="dqm-preview-issue-header">Issue ${
            index + 1
        }:</div>`;
        contentHtml += `<div class="dqm-preview-code-block">${element.outerHTML}</div>`;
        });
            contentHtml += '</div>';
    } else {
        contentHtml +=
        '<div class="dqm-preview-no-content">' +
        __("No highlighted content could be extracted.", "dqm-wordpress-plugin") +
        "</div>";
    }

    const cp = {
            name: checkpointName + ' - ' + __('Found in Preview', 'dqm-wordpress-plugin'),
        description: contentHtml,
        topics: ["Preview Content"],
    };

    showCheckpointDialog(cp);
    }

    function highlightIssue(checkpointId, checkpointName) {
      if (currentHighlightedCheckpointId === checkpointId) {
        clearHighlights();
        currentHighlightedCheckpointId = null;
        currentCheckpointForToggle = null;
        updateCheckpointActiveState(null);
        if (checkpointDialog && checkpointDialog.style.display !== "none") {
          checkpointDialog.style.display = "none";
        }
        return;
      }

      clearHighlights();
      currentHighlightedCheckpointId = checkpointId;
      currentCheckpointForToggle = checkpointId;
      updateCheckpointActiveState(checkpointId);

      if (!lastAssetId) {
        showNotification(
          __(
            "Please run a quality check first to enable highlighting.",
            "dqm-wordpress-plugin"
          )
        );
        currentHighlightedCheckpointId = null;
        currentCheckpointForToggle = null;
        updateCheckpointActiveState(null);
        return;
      }

      const checkpoint = allCheckpoints.find((cp) => cp.id === checkpointId);
      if (!checkpoint || !checkpoint.canHighlight) {
        showNotification(
          __("Cannot highlight this checkpoint.", "dqm-wordpress-plugin")
        );
        currentHighlightedCheckpointId = null;
        currentCheckpointForToggle = null;
        updateCheckpointActiveState(null);
        return;
      }

      const canHighlightPage = checkpoint.canHighlight.page === true;
      const canHighlightSource = checkpoint.canHighlight.source === true;

      if (!canHighlightPage && !canHighlightSource) {
        showNotification(
          __("Cannot highlight this checkpoint.", "dqm-wordpress-plugin")
        );
        currentHighlightedCheckpointId = null;
        currentCheckpointForToggle = null;
        updateCheckpointActiveState(null);
        return;
      }

      if (canHighlightPage && canHighlightSource) {
        showToggleButton(checkpointId, checkpointName);
      }

      currentHighlightMode = canHighlightPage ? "page" : "source";
      performHighlighting(checkpointId, checkpointName, currentHighlightMode);
    }

    function showToggleButton(checkpointId, checkpointName) {
    if (!toggleButton) {
            toggleButton = document.createElement('button');
            toggleButton.id = 'dqm-highlight-toggle-btn';
            toggleButton.className = 'dqm-highlight-toggle';

        toggleButton.addEventListener('click', () => {
        toggleHighlightMode(checkpointId, checkpointName);
        });

                document.body.appendChild(toggleButton);
    }

    updateToggleButtonText();
        toggleButton.style.display = 'block';
    }

    function hideToggleButton() {
    if (toggleButton) {
            toggleButton.style.display = 'none';
    }
    }


    function updateToggleButtonText() {
        if (toggleButton) {
            const buttonText = currentHighlightMode === 'page' ? 
                __('Source', 'dqm-wordpress-plugin') : 
                __('Browser', 'dqm-wordpress-plugin');
            toggleButton.textContent = buttonText;
        }
    }

    function toggleHighlightMode(checkpointId, checkpointName) {
      const checkpoint = allCheckpoints.find((cp) => cp.id === checkpointId);
      if (!checkpoint) return;

      const canHighlightPage = checkpoint.canHighlight?.page === true;
      const canHighlightSource = checkpoint.canHighlight?.source === true;

      const newMode = currentHighlightMode === "page" ? "source" : "page";

      if (newMode === "source" && !canHighlightSource) {
        showNotification(
          __(
            "Source view not available for this checkpoint.",
            "dqm-wordpress-plugin"
          )
        );
        return;
      }
      if (newMode === "page" && !canHighlightPage) {
        showNotification(
          __(
            "Page view not available for this checkpoint.",
            "dqm-wordpress-plugin"
          )
        );
        return;
      }

      clearHighlights(true);
      currentHighlightMode = newMode;
      updateToggleButtonText();
      performHighlighting(checkpointId, checkpointName, newMode);
    }

    function performHighlighting(checkpointId, checkpointName, mode) {
        const apiKey = CrownpeakDQM.apiKey;
        
        if (mode === 'page') {
            const url = `https://api.crownpeak.net/dqm-cms/v1/assets/${lastAssetId}/errors/${checkpointId}?apiKey=${apiKey}`;
            fetch(url, {
                headers: {
                    "x-api-key": apiKey,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            })
            .then((resp) => resp.text())
            .then((htmlContent) => {
                const foundInEditor = extractAndApplyHighlighting(htmlContent);
                if (!foundInEditor) {
                    showPreviewContentDialog(checkpointId, checkpointName, htmlContent);
                }
            })
            .catch((e) => {
                console.warn("[DQM] Failed to fetch page issue details:", e);
                showNotification(
                    __("Failed to load page details: ", "dqm-wordpress-plugin") + e.message
                );
            });
        } else if (mode === 'source') {
            showSourceInEditor(checkpointId);
        }
    }

    function showSourceInEditor(checkpointId) {
        const apiKey = CrownpeakDQM.apiKey;
        const url = `https://api.crownpeak.net/dqm-cms/v1/assets/${lastAssetId}/errors/${checkpointId}?apiKey=${apiKey}&highlightSource=true`;
        
        fetch(url, {
            headers: {
                'x-api-key': apiKey
            }
        })
        .then((resp) => resp.text())
        .then((sourceHtml) => {
            replaceEditorWithSource(sourceHtml);
        })
        .catch((e) => {
            console.warn("[DQM] Failed to fetch source highlighting:", e);
            showNotification(__('Failed to load source details: ', 'dqm-wordpress-plugin') + e.message);
            currentHighlightedCheckpointId = null;
            currentCheckpointForToggle = null;
            updateCheckpointActiveState(null);
        });
    }

    function replaceEditorWithSource(sourceHtml) {
      const iframe = getEditorIframe();
      if (!iframe || !iframe.contentDocument) {
        showNotification(__('Cannot access editor content.', 'dqm-wordpress-plugin'));
        currentHighlightedCheckpointId = null;
        updateCheckpointActiveState(null);
        return;
      }

      const editorDoc = iframe.contentDocument;
      const editorBody = editorDoc.body;

      if (!editorBody) {
        showNotification(__('Cannot access editor body.', 'dqm-wordpress-plugin'));
        currentHighlightedCheckpointId = null;
        updateCheckpointActiveState(null);
        return;
      }
      if (!editorBody.hasAttribute('data-dqm-original-content')) {
        editorBody.setAttribute('data-dqm-original-content', editorBody.innerHTML);
      }
      editorBody.innerHTML = sourceHtml;
        editorBody.setAttribute('data-dqm-source-view', 'true');
      setTimeout(() => {
            const firstError = editorBody.querySelector('.errorIcon i, [style*="background:yellow"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
      }, 100);
    }

    function clearHighlights(preserveToggleButton = false) {
    const contexts = [document, getEditorDocument()];
    
    contexts.forEach(context => {
        context.querySelectorAll('[data-dqm-highlighted="true"]').forEach(element => {
            const originalStyle = element.getAttribute('data-original-style') || '';
            element.setAttribute('style', originalStyle);
            element.removeAttribute('data-dqm-highlighted');
            element.removeAttribute('data-original-style');
        });
        
        if (context.body && context.body.hasAttribute('data-dqm-source-view')) {
            const originalContent = context.body.getAttribute('data-dqm-original-content');
            if (originalContent) {
                context.body.innerHTML = originalContent;
            }
            context.body.removeAttribute('data-dqm-original-content');
            context.body.removeAttribute('data-dqm-source-view');
        }
    });
    
    if (!preserveToggleButton) {
        currentHighlightedCheckpointId = null;
        hideToggleButton();
    }
}

    function extractAndApplyHighlighting(apiResponseHtml) {
        const parser = new DOMParser();
        const apiDoc = parser.parseFromString(apiResponseHtml, "text/html");
        const editorDoc = getEditorDocument();
        const highlightedElements = apiDoc.querySelectorAll(
            '[style*="background:yellow"], [style*="background-color:yellow"], [style*="background: yellow"]'
        );

        if (highlightedElements.length === 0) {
            console.warn("[DQM] No highlighted elements found in API response");
            return false;
        }
        let foundInEditor = false;

        highlightedElements.forEach((apiElement, index) => {
            const apiText = normalizeText(
                apiElement.textContent || apiElement.innerText || ""
            );
            const apiTagName = apiElement.tagName.toLowerCase();

            const editorElements = editorDoc.querySelectorAll(apiTagName);

            for (const editorElement of editorElements) {
                const editorText = normalizeText(
                    editorElement.textContent || editorElement.innerText || ""
                );

                if (apiText === editorText) {
                    applyApiHighlighting(editorElement, apiElement, index);
                    foundInEditor = true;
                    break;
                }
            }
        });
        return foundInEditor;
    }

    function applyApiHighlighting(editorElement, apiElement, index) {
        if (!editorElement || !apiElement) {
            console.warn('[DQM] applyApiHighlighting called with null element', { index });
            return;
        }

        if (!editorElement.hasAttribute('data-original-style')) {
            editorElement.setAttribute('data-original-style', editorElement.style.cssText || '');
        }
        
        const apiStyle = apiElement.getAttribute('style') || '';
        editorElement.setAttribute('style', apiStyle);
        
        editorElement.setAttribute('data-dqm-highlighted', 'true');
        if (index === 0) {
            editorElement.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }

    function updateCheckpointActiveState(activeCheckpointId) {
        document.querySelectorAll('.checkpoint-item').forEach(item => {
            item.classList.remove('dqm-active');
        });

        if (activeCheckpointId) {
            const activeItem = document.querySelector(`[data-checkpoint-id="${activeCheckpointId}"]`);
            if (activeItem) {
                activeItem.classList.add('dqm-active');
            }
        }
    }
    function waitForIframe(callback) {
        const iframe = getEditorIframe();
        if (!iframe) {
            setTimeout(() => waitForIframe(callback), 100);
            return;
        }

        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
            callback();
        } else {
            iframe.addEventListener('load', callback);
        }
    }

    waitForIframe(() => {
        injectHighlightCSS();
        injectButton();
        handleTabSwitch();
    });
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
            scanBtn.className = 'primary-button';
            const topicsDiv = document.createElement('div');
            topicsDiv.className = 'dqm-topics-container';
            const topicsLabel = document.createElement('label');
            topicsLabel.textContent = __('All Topics:', 'dqm-wordpress-plugin');
            topicsLabel.setAttribute('for', 'dqm-topics-dropdown');
            topicsLabel.className = 'dqm-topics-label';
            const topicsDropdown = document.createElement('select');
            topicsDropdown.id = 'dqm-topics-dropdown';
            const defaultOption = document.createElement('option');
            defaultOption.value = 'all';
            defaultOption.textContent = __('All Topics', 'dqm-wordpress-plugin');
            topicsDropdown.appendChild(defaultOption);
            const topicsLoading = document.createElement('span');
            topicsLoading.id = 'dqm-topics-loading';
            topicsLoading.textContent = __('Loading...', 'dqm-wordpress-plugin');
            topicsDiv.appendChild(topicsLabel);
            topicsDiv.appendChild(topicsDropdown);
            topicsDiv.appendChild(topicsLoading);
            const failedCheckpointsCard = document.createElement('div');
            failedCheckpointsCard.className = 'card';
            const failedHeader = document.createElement('h3');
            failedHeader.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ff5630;margin-right:8px;"></i>' + __('Failed Checkpoints', 'dqm-wordpress-plugin');
            failedCheckpointsCard.appendChild(failedHeader);

            checkpointsList = document.createElement('div');
            checkpointsList.id = 'dqm-checkpoints-list';
            checkpointsList.className = '';
            failedCheckpointsCard.appendChild(checkpointsList);
            injectHighlightCSS();
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
                    noFailuresMsg.className = 'dqm-no-failures';
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
                        li.setAttribute('data-checkpoint-id', cp.id);

                        const canHighlightPage = cp.canHighlight && cp.canHighlight.page === true;
                        const canHighlightSource = cp.canHighlight && cp.canHighlight.source === true;
                        const canHighlightAny = canHighlightPage || canHighlightSource;

                        if (canHighlightAny) {
                            li.addEventListener('click', function (e) {
                                e.stopPropagation();
                                highlightIssue(cp.id, cp.name);
                            });
                            li.style.cursor = 'pointer';
                        } else {
                            li.style.cursor = 'default';
                        }

                        const iconTitleDiv = document.createElement('div');
                        iconTitleDiv.className = 'checkpoint-icon-title';

                        const iconTitleRow = document.createElement('div');
                        iconTitleRow.className = 'checkpoint-icon-title-row';
                        const iconDiv = document.createElement('div');
                        iconDiv.className = 'checkpoint-icon failed';
                        iconDiv.textContent = '!';
                        iconDiv.addEventListener('click', function (e) {
                            e.stopPropagation();
                            showCheckpointDialog(cp);
                        });
                        iconDiv.addEventListener('mouseenter', function (e) {
                            showCheckpointDialog(cp);
                        });
                        iconDiv.addEventListener('mouseleave', function (e) {
                            if (checkpointDialog) {
                                checkpointDialog.style.display = 'none';
                            }
                        });
                        iconTitleRow.appendChild(iconDiv);
                        const contentDiv = document.createElement('div');
                        contentDiv.className = 'checkpoint-content';
                        const nameSpan = document.createElement('span');
                        nameSpan.textContent = cp.name;
                        nameSpan.className = 'checkpoint-title checkpoint-label';
                        contentDiv.appendChild(nameSpan);

                        let badgesAdded = false;
                        if (Array.isArray(cp.topics) && cp.topics.length > 0) {
                            const badgesDiv = document.createElement('div');
                            badgesDiv.className = 'checkpoint-badges';
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
                            badgesAdded = true;
                        }
                        if (cp.canHighlight && !canHighlightAny) {
                            const cannotHighlight = document.createElement('div');
                            cannotHighlight.className = 'checkpoint-no-highlight';
                            cannotHighlight.textContent = __('Cannot highlight', 'dqm-wordpress-plugin');
                            contentDiv.appendChild(cannotHighlight);
                        } else if (canHighlightAny) {
                            const canHighlight = document.createElement('div');
                            canHighlight.className = 'checkpoint-highlight-info';
                            canHighlight.textContent = __('Click to highlight', 'dqm-wordpress-plugin');
                            contentDiv.appendChild(canHighlight);
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

            injectHighlightCSS();

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

            const topicsContainer = document.createElement('div');
            topicsContainer.id = 'dqm-topics-container';
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
                            <div class="dqm-breakdown-item">
                                <div class="dqm-breakdown-header">
                                    <span class="${badgeClass}" style="background:${color}">${topic}</span>
                                    <span>${passed}/${total} ${__('passed', 'dqm-wordpress-plugin')}</span>
                                </div>
                                <div class="dqm-breakdown-bar">
                                    <div class="dqm-breakdown-progress" style="background: ${color}; width: ${percent}%;"></div>
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
                        allCheckpoints = data.checkpoints;
                        allTopics = new Set();
                        data.checkpoints.forEach(cp => {
                            checkpointStatusMap[cp.id] = !!cp.failed;
                            if (Array.isArray(cp.topics)) {
                                cp.topics.forEach(t => allTopics.add(t));
                            }
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
            scanBtnAfterFailed.className = 'primary-button';
            topicsContainer.appendChild(scanBtnAfterFailed);
            const spinner = document.createElement('div');
            spinner.id = 'dqm-loading-spinner';
            spinner.className = 'dqm-spinner';
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
            document.body.appendChild(checkpointDialog);
        }
        checkpointDialog.innerHTML = '';
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.className = 'dqm-dialog-close';
        closeBtn.setAttribute('aria-label', __('Close', 'dqm-wordpress-plugin'));
        closeBtn.onclick = () => {
            checkpointDialog.style.display = 'none';
            if (checkpointDialog._lastActiveElement) {
                checkpointDialog._lastActiveElement.focus();
            }
        };
        checkpointDialog.appendChild(closeBtn);
        const name = document.createElement('div');
        name.className = 'dqm-dialog-title';
        name.textContent = cp.name;
        checkpointDialog.appendChild(name);
        if (cp.description) {
            const desc = document.createElement('div');
            desc.className = 'dqm-dialog-desc';
            desc.innerHTML = cp.description;
            checkpointDialog.appendChild(desc);
        }
        if (Array.isArray(cp.topics) && cp.topics.length > 0) {
            const topics = document.createElement('div');
            topics.className = 'dqm-dialog-topics';
            topics.textContent = __('Topics: ', 'dqm-wordpress-plugin') + cp.topics.join(', ');
            checkpointDialog.appendChild(topics);
        }
        checkpointDialog.style.display = 'block';
        checkpointDialog._lastActiveElement = document.activeElement;
        closeBtn.focus();
        checkpointDialog.addEventListener('keydown', function (e) {
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
})();