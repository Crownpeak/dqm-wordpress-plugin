(function addDqmCmsButton() {
    let checkpointsList = null;
    let allCheckpoints = [];
    let originalCheckpoints = [];
    let allTopics = new Set();
    let checkpointStatusMap = {};
    let lastAssetId = null;
    let currentHighlightMode = 'page';
    let toggleButton = null;
    let currentCheckpointForToggle = null;
    let aiSummaryCache = {};
    let renderScoreCard = null;
    let renderCheckpointsList = null;

    let aiContext = null;
    let aiTranslationManager = null;
    
    if (window.AIContextManager) {
        const translationConfig = {
            enabledByDefault: false,
            computeBudgetMs: 15000
        };
        const summaryConfig = {
            timeoutMs: 45000
        };
        
        aiContext = new window.AIContextManager({
            translation: translationConfig,
            summary: summaryConfig
        });
        
        if (window.AITranslationManager) {
            aiTranslationManager = new window.AITranslationManager(aiContext);
        }
        
        if (CrownpeakDQM && CrownpeakDQM.openaiApiKey) {
            aiContext.setOpenAiApiKey(CrownpeakDQM.openaiApiKey);
        }
        if (CrownpeakDQM && CrownpeakDQM.openaiModel) {
            aiContext.setOpenAiModel(CrownpeakDQM.openaiModel);
        }
        if (CrownpeakDQM && CrownpeakDQM.openaiBaseUrl) {
            aiContext.setOpenAiBaseUrl(CrownpeakDQM.openaiBaseUrl);
        }
        if (CrownpeakDQM && CrownpeakDQM.reasoningEffort) {
            aiContext.setReasoningEffort(CrownpeakDQM.reasoningEffort);
        }
    }

    const AI_STORAGE_KEYS = window.AI_STORAGE_KEYS || {
        translationEnabled: 'dqm_translate_results_enabled',
        translationMode: 'dqm_translation_mode',
        summaryEnabled: 'dqm_summary_enabled',
        openaiApiKey: 'dqm_openai_apiKey',
        openaiModel: 'dqm_openai_model',
        openaiBaseUrl: 'dqm_openai_baseUrl',
        targetLanguage: 'dqm_target_language',
        reasoningEffort: 'dqm_reasoning_effort',
        debug: 'dqm_debug',
        translationCache: 'dqm_translation_cache',
        summaryCache: 'dqm_summary_cache',
        computeBudgetMs: 'dqm_compute_budget_ms'
    };

    const AI_CONFIG = window.AI_CONFIG || {
        translation: {
            enabledByDefault: getAIToggleState('translationEnabled', 'false') === 'true',
            computeBudgetMs: parseInt(getAIToggleState('computeBudgetMs', '15000'), 10),
            modes: {
                fast: { timeout: 15000, maxRetries: 2 },
                full: { timeout: 45000, maxRetries: 3 }
            },
            persistentCache: true,
            cacheExpiry: 24 * 60 * 60 * 1000
        },
        summary: {
            timeoutMs: 45000,
            maxRetries: 2,
            persistentCache: true,
            cacheExpiry: 24 * 60 * 60 * 1000
        },
        retry: {
            maxAttempts: 3,
            backoffMs: 1000,
            backoffMultiplier: 2
        }
    };

    function getAIToggleState(key, defaultValue) {
        if (aiContext) {
            const state = aiContext.getState();
            const keyMap = {
                'translationEnabled': 'translationEnabled',
                'translationMode': 'translationMode',
                'summaryEnabled': 'summaryEnabled',
                'openaiApiKey': 'openAiApiKey',
                'openaiModel': 'openAiModel',
                'openaiBaseUrl': 'openAiBaseUrl',
                'reasoningEffort': 'reasoningEffort',
                'computeBudgetMs': 'computeBudgetMs'
            };
            const mappedKey = keyMap[key];
            if (mappedKey && state[mappedKey] !== undefined) {
                const value = state[mappedKey];
                return typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
            }
        }
        
        if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
        try {
            const storageKey = AI_STORAGE_KEYS[key] || key;
            const value = localStorage.getItem(storageKey);
            return value !== null ? value : defaultValue;
        } catch (e) {
            console.warn('[DQM] Failed to get AI toggle state:', e);
            return defaultValue;
        }
    }

    function setAIToggleState(key, value) {
        if (aiContext) {
            const setters = {
                'translationEnabled': () => aiContext.setTranslationEnabled(value === 'true' || value === true),
                'translationMode': () => aiContext.setTranslationMode(value),
                'summaryEnabled': () => aiContext.setSummaryEnabled(value === 'true' || value === true),
                'openaiApiKey': () => aiContext.setOpenAiApiKey(String(value)),
                'openaiModel': () => aiContext.setOpenAiModel(String(value)),
                'openaiBaseUrl': () => aiContext.setOpenAiBaseUrl(String(value)),
                'reasoningEffort': () => aiContext.setReasoningEffort(value)
            };
            
            if (setters[key]) {
                setters[key]();
                return;
            }
        }
        
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            const storageKey = AI_STORAGE_KEYS[key] || key;
            localStorage.setItem(storageKey, value);
        } catch (e) {
            console.warn('[DQM] Failed to save AI toggle state:', e);
        }
    }

    function getPersistentCache(cacheType) {
        if (typeof window === 'undefined' || !window.localStorage) return {};
        try {
            const key = cacheType === 'translation' ? AI_STORAGE_KEYS.translationCache : AI_STORAGE_KEYS.summaryCache;
            const cached = localStorage.getItem(key);
            if (!cached) return {};
            
            const data = JSON.parse(cached);
            const now = Date.now();
            const expiry = cacheType === 'translation' 
                ? AI_CONFIG.translation.cacheExpiry 
                : AI_CONFIG.summary.cacheExpiry;
            
            const validEntries = {};
            Object.keys(data).forEach(cacheKey => {
                const entry = data[cacheKey];
                if (entry && entry.timestamp && (now - entry.timestamp) < expiry) {
                    validEntries[cacheKey] = entry;
                }
            });
            
            return validEntries;
        } catch (e) {
            console.warn('[DQM] Failed to load persistent cache:', e);
            return {};
        }
    }

    function setPersistentCache(cacheType, cacheKey, data) {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        try {
            const key = cacheType === 'translation' ? AI_STORAGE_KEYS.translationCache : AI_STORAGE_KEYS.summaryCache;
            const cache = getPersistentCache(cacheType);
            cache[cacheKey] = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem(key, JSON.stringify(cache));
            return true;
        } catch (e) {
            console.warn('[DQM] Failed to save to persistent cache:', e);
            return false;
        }
    }

    function clearPersistentCache(cacheType) {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        try {
            if (cacheType === 'all') {
                localStorage.removeItem(AI_STORAGE_KEYS.translationCache);
                localStorage.removeItem(AI_STORAGE_KEYS.summaryCache);
            } else {
                const key = cacheType === 'translation' ? AI_STORAGE_KEYS.translationCache : AI_STORAGE_KEYS.summaryCache;
                localStorage.removeItem(key);
            }
            return true;
        } catch (e) {
            console.warn('[DQM] Failed to clear persistent cache:', e);
            return false;
        }
    }

    function getCacheStats() {
        const translationCache = getPersistentCache('translation');
        const summaryCache = getPersistentCache('summary');
        return {
            translation: {
                count: Object.keys(translationCache).length,
                size: JSON.stringify(translationCache).length
            },
            summary: {
                count: Object.keys(summaryCache).length,
                size: JSON.stringify(summaryCache).length
            }
        };
    }

    let translationEnabled = getAIToggleState('translationEnabled', 'false') === 'true';
    let translationMode = getAIToggleState('translationMode', 'fast');
    let summaryEnabled = getAIToggleState('summaryEnabled', 'false') === 'true';

    const __ = window.wp && wp.i18n && wp.i18n.__ ? wp.i18n.__ : function (s) { return s; };
    const TABLIST_SELECTOR = 'div[role="tablist"][aria-orientation="horizontal"]';
    const BUTTON_ID = 'dqm-cms-tab';
    const BUTTON_LABEL = __('Crownpeak DQM', 'dqm-wordpress-plugin');
    const PANEL_ID = 'dqm-cms-panel';

    const SUPPORTED_LOCALES = ['en', 'de', 'es'];
    const DEFAULT_LOCALE = 'en';
    const LOCALE_STORAGE_KEY = 'dqm_locale';
    const LOCALE_PARAM_KEY = 'dqmUiLang';

    const translations = {
        en: {
            language: 'Language',
            language_en: 'English',
            language_de: 'German',
            language_es: 'Spanish',
            reset: 'Reset',
            source_url: 'URL parameter',
            source_user: 'Custom selected',
            source_navigator: 'Browser setting',
            source_default: 'Default language',
            title: 'Digital Quality and Accessibility',
            run_quality_check: 'Run Quality Check'
        },
        de: {
            language: 'Sprache',
            language_en: 'Englisch',
            language_de: 'Deutsch',
            language_es: 'Spanisch',
            reset: 'Zurücksetzen',
            source_url: 'URL-Parameter',
            source_user: 'Durch Benutzer ausgewählt',
            source_navigator: 'Browser-Einstellung',
            source_default: 'Standard-Sprache',
            title: 'Digitale Qualität und Barrierefreiheit',
            run_quality_check: 'Qualitätsprüfung starten'
        },
        es: {
            language: 'Idioma',
            language_en: 'Inglés',
            language_de: 'Alemán',
            language_es: 'Español',
            reset: 'Restablecer',
            source_url: 'Parámetro URL',
            source_user: 'Seleccionado manualmente',
            source_navigator: 'Configuración del navegador',
            source_default: 'Idioma predeterminado',
            title: 'Calidad digital y accesibilidad',
            run_quality_check: 'Ejecutar comprobación de calidad'
        }
    };

    let currentLocale = DEFAULT_LOCALE;
    let localeSource = 'default';
    let userOverride = false;

    function normalizeLocale(input) {
        if (!input) return null;
        const lower = input.toLowerCase();
        const candidate = lower.split('-')[0];
        return SUPPORTED_LOCALES.includes(candidate) ? candidate : null;
    }

    function loadSavedLocale() {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        try {
            return localStorage.getItem(LOCALE_STORAGE_KEY);
        } catch (e) {
            console.warn('[DQM i18n] Failed to load saved locale:', e);
            return null;
        }
    }

    function persistLocale(locale) {
        if (typeof window === 'undefined' || !window.localStorage) return;
        try {
            if (locale) {
                localStorage.setItem(LOCALE_STORAGE_KEY, locale);
            } else {
                localStorage.removeItem(LOCALE_STORAGE_KEY);
            }
        } catch (e) {
            console.warn('[DQM i18n] Failed to persist locale:', e);
        }
    }

    function resolveLocale() {
        const params = new URLSearchParams(window.location.search);
        const urlLocale = normalizeLocale(params.get(LOCALE_PARAM_KEY));
        if (urlLocale) {
            localeSource = 'url';
            userOverride = false;
            return urlLocale;
        }

        const savedLocale = normalizeLocale(loadSavedLocale());
        if (savedLocale) {
            localeSource = 'user';
            userOverride = true;
            return savedLocale;
        }

        const navigatorLocale = normalizeLocale(navigator.language || navigator.userLanguage);
        if (navigatorLocale) {
            localeSource = 'navigator';
            userOverride = false;
            return navigatorLocale;
        }

        localeSource = 'default';
        userOverride = false;
        return DEFAULT_LOCALE;
    }
    function t(key, params = {}, locale = null) {
        if (typeof params === 'string') {
            locale = params;
            params = {};
        }

        const targetLocale = normalizeLocale(locale || currentLocale);
        let translation = key;

        if (window.DQM_I18N && window.DQM_I18N[targetLocale] && window.DQM_I18N[targetLocale][key]) {
            translation = window.DQM_I18N[targetLocale][key];
        }
        else if (translations[targetLocale] && translations[targetLocale][key]) {
            translation = translations[targetLocale][key];
        }

        // Fallback to English if translation is missing in target locale
        if (translation === key && targetLocale !== 'en') {
            if (window.DQM_I18N && window.DQM_I18N.en && window.DQM_I18N.en[key]) {
                translation = window.DQM_I18N.en[key];
            } else if (translations.en && translations.en[key]) {
                translation = translations.en[key];
            }
        }

        if (params && typeof params === 'object' && Object.keys(params).length > 0) {
            translation = translation.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
                return params[variable] !== undefined ? params[variable] : match;
            });
        }

        return translation;
    }

    window.DQM_i18n = {
        t: t,
        changeLanguage: changeLanguage,
        resetLanguage: resetLanguage,
        getLocaleInfo: getLocaleInfo,
        getCurrentLocale: () => currentLocale,
        getSupportedLocales: () => SUPPORTED_LOCALES,
        normalizeLocale: normalizeLocale,
        SUPPORTED_LOCALES: SUPPORTED_LOCALES,
        DEFAULT_LOCALE: DEFAULT_LOCALE,
        LOCALE_STORAGE_KEY: LOCALE_STORAGE_KEY,
        LOCALE_PARAM_KEY: LOCALE_PARAM_KEY
    };

    window.DQM_AI = {
        getPersistentCache: getPersistentCache,
        setPersistentCache: setPersistentCache,
        clearPersistentCache: clearPersistentCache,
        getCacheStats: getCacheStats,
        getAIToggleState: getAIToggleState,
        setAIToggleState: setAIToggleState,
        generateAISummary: generateAISummary,
        AI_STORAGE_KEYS: AI_STORAGE_KEYS,
        AI_CONFIG: AI_CONFIG
    };

    currentLocale = resolveLocale();

    function updateUITranslations() {
        const headerTitle = document.querySelector('.dqm-header-title');
        if (headerTitle) {
            headerTitle.textContent = t('title');
        }
        
        const scanBtn = document.getElementById('dqm-scan-content-sidebar-btn');
        if (scanBtn) {
            scanBtn.textContent = t('run_quality_check');
        }
        
        const aiSettingsBtn = document.getElementById('dqm-ai-assistant-btn');
        if (aiSettingsBtn) {
            aiSettingsBtn.setAttribute('aria-label', t('ai_settings'));
        }
    }

    (async function initializeI18n() {
        try {
            await window.DQM_I18N.initializeTranslations(currentLocale);
            updateUITranslations();
        } catch (error) {
            console.error('[DQM] Failed to initialize translations:', error);
        }
    })();

    function getLocaleInfo() {
        return {
            locale: currentLocale,
            source: localeSource,
            isUserOverride: userOverride
        };
    }

    function changeLanguage(newLocale) {
        const normalized = normalizeLocale(newLocale);
        if (!normalized) {
            console.warn('[DQM i18n] Invalid locale:', newLocale);
            return false;
        }
        
        currentLocale = normalized;
        localeSource = 'user';
        userOverride = true;
        persistLocale(normalized);
        
        if (window.DQM_I18N && window.DQM_I18N.setCurrentLocale) {
            window.DQM_I18N.setCurrentLocale(normalized);
        }
        
        if (aiContext) {
            aiContext.updateLanguage(normalized);
        }
        
        window.DQM_I18N.loadLanguageFile(normalized).catch(error => {
            console.error('[DQM] Failed to load language file:', error);
        });
        
        return true;
    }

    function resetLanguage() {
        persistLocale(null);
        const resolved = resolveLocale();
        currentLocale = resolved;
        return resolved;
    }

    const translateText = function(text) {
        return __(text, 'dqm-wordpress-plugin');
    };

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

    function generateAISummary(assetId, checkpoints, targetLang = currentLocale, forceRegenerate = false) {
        const container = document.getElementById('dqm-ai-summary-container');
        if (!container) return;

        const aiEnabled = getAIToggleState('summaryEnabled', 'false') === 'true';
        const hasOpenAIKey = CrownpeakDQM.openaiApiKey && CrownpeakDQM.openaiApiKey.length > 10;

        if (!aiEnabled || !hasOpenAIKey) {
            container.style.display = 'none';
            return;
        }

        const cacheKey = `${assetId}:${targetLang}`;
        
        if (!forceRegenerate) {
            if (aiSummaryCache[cacheKey]) {
                renderAISummary(aiSummaryCache[cacheKey], false);
                return;
            }
            
            const persistentCache = getPersistentCache('summary');
            if (persistentCache[cacheKey]) {
                const cachedData = persistentCache[cacheKey].data;
                aiSummaryCache[cacheKey] = cachedData;
                renderAISummary(cachedData, false);
                return;
            }
        }

        container.style.display = 'block';
        container.innerHTML = `
            <div class="card dqm-ai-summary-card">
                <div class="dqm-ai-summary-header">
                    <div class="dqm-ai-header-left">
                        <svg class="dqm-ai-sparkle-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z"/>
                        </svg>
                        <h3>${t('summary_title')}</h3>
                        <span class="dqm-ai-badge">${t('ai_backend_api')}</span>
                    </div>
                    <button class="dqm-ai-icon-btn" id="dqm-ai-settings-btn" title="${t('ai_settings')}">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
                <div class="dqm-ai-loading">
                    <div class="dqm-spinner"></div>
                    <p>${t('summary_generating')}</p>
                </div>
            </div>
        `;

        const settingsBtn = document.getElementById('dqm-ai-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', showAISettingsDialog);
        }
        const enrichedCheckpoints = checkpoints.map(cp => ({
            ...cp,
            failed: !!checkpointStatusMap[cp.id]
        }));

        const params = new URLSearchParams({
            action: 'crownpeak_dqm_ai_summary',
            assetId: assetId,
            checkpoints: JSON.stringify(enrichedCheckpoints),
            targetLang: targetLang
        });

        fetch(CrownpeakDQM.ajaxurl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                aiSummaryCache[cacheKey] = data;
                setPersistentCache('summary', cacheKey, data);
                renderAISummary(data, true);
            } else {
                renderAISummaryError(data.message || __('Failed to generate AI summary', 'dqm-wordpress-plugin'));
            }
        })
        .catch(error => {
            renderAISummaryError(__('Network error: ', 'dqm-wordpress-plugin') + error.message);
        });
    }

    function formatMarkdown(text) {
        if (!text) return text;

        return text
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');
    }

    function renderAISummary(data, isNew) {
        const container = document.getElementById('dqm-ai-summary-container');
        if (!container) return;

        if (!data) return;

        const bullets = data.bullets || [];
        const stats = data.stats || {};

        let bulletsHTML = '';
        bullets.forEach((bullet, index) => {
            const formattedBullet = formatMarkdown(bullet);
            bulletsHTML += `<li class="dqm-ai-bullet" style="animation-delay: ${index * 0.1}s">${formattedBullet}</li>`;
        });

        container.innerHTML = `
            <div class="card dqm-ai-summary-card">
                <div class="dqm-ai-summary-header">
                    <div class="dqm-ai-header-left">
                        <svg class="dqm-ai-sparkle-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z"/>
                        </svg>
                        <h3>${t('summary_title')}</h3>
                        <span class="dqm-ai-badge">${t('ai_backend_api')}</span>
                    </div>
                    <div class="dqm-ai-header-right">
                        <button class="dqm-ai-icon-btn" id="dqm-ai-settings-btn" title="${t('ai_settings')}">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                        <button class="dqm-ai-icon-btn" id="dqm-ai-regenerate-header-btn" title="${t('summary_regenerate')}">
                            <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                    </div>
                </div>
                ${bullets.length > 0 ? `
                    <ul class="dqm-ai-bullets">
                        ${bulletsHTML}
                    </ul>
                ` : '<p class="dqm-ai-empty">' + t('summary_empty') + '</p>'}
                <div class="dqm-ai-footer">
                    <div class="dqm-ai-footer-left">
                        <span class="dqm-ai-model-info">
                            <i class="fa-solid fa-robot"></i> ${stats.model || 'gpt-4o-mini'}
                        </span>
                        ${data.cached ? '<span class="dqm-ai-cached-badge">' + t('ai_cache_badge') + '</span>' : ''}
                    </div>
                    <button class="dqm-ai-regenerate-btn" id="dqm-ai-regenerate-btn">
                        <i class="fa-solid fa-arrows-rotate"></i> ${t('summary_regenerate')}
                    </button>
                </div>
                <div class="dqm-ai-disclaimer">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                    <span>${t('summary_disclaimer')}</span>
                </div>
            </div>
        `;

        const settingsBtn = document.getElementById('dqm-ai-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', showAISettingsDialog);
        }

        const regenerateBtn = document.getElementById('dqm-ai-regenerate-btn');
        const regenerateHeaderBtn = document.getElementById('dqm-ai-regenerate-header-btn');

        const regenerateHandler = () => {
            const cacheKey = `${lastAssetId}:${currentLocale}`;
            delete aiSummaryCache[cacheKey];
            const persistentCache = getPersistentCache('summary');
            delete persistentCache[cacheKey];
            setPersistentCache('summary', cacheKey, null);
            generateAISummary(lastAssetId, allCheckpoints, currentLocale, true);
        };

        if (regenerateBtn) {
            regenerateBtn.addEventListener('click', regenerateHandler);
        }

        if (regenerateHeaderBtn) {
            regenerateHeaderBtn.addEventListener('click', regenerateHandler);
        }
    }

    function renderAISummaryError(errorMessage) {
        const container = document.getElementById('dqm-ai-summary-container');
        if (!container) return;

        container.innerHTML = `
            <div class="card dqm-ai-summary-card dqm-ai-error">
                <div class="dqm-ai-summary-header">
                    <div class="dqm-ai-header-left">
                        <svg class="dqm-ai-sparkle-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                            <path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z"/>
                        </svg>
                        <h3>${t('AI Summary')}</h3>
                        <span class="dqm-ai-badge">ChatGPT</span>
                    </div>
                    <button class="dqm-ai-icon-btn" id="dqm-ai-settings-btn" title="${t('AI Settings')}">
                        <i class="fa-solid fa-gear"></i>
                    </button>
                </div>
                <div class="dqm-ai-error-content">
                    <i class="fa-solid fa-circle-exclamation" style="color:#DE350B;font-size:24px;margin-bottom:8px;"></i>
                    <p><strong>${t('Failed to generate summary')}</strong></p>
                    <p style="color:#666;font-size:14px;">${errorMessage}</p>
                    <button class="dqm-ai-retry-btn" id="dqm-ai-retry-btn">
                        <i class="fa-solid fa-arrows-rotate"></i> ${t('Retry')}
                    </button>
                </div>
            </div>
        `;

        const settingsBtn = document.getElementById('dqm-ai-settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', showAISettingsDialog);
        }

        const retryBtn = document.getElementById('dqm-ai-retry-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                generateAISummary(lastAssetId, allCheckpoints, currentLocale);
            });
        }
    }

    function showAISettingsDialog() {
        const hasOpenAIKey = CrownpeakDQM.openaiApiKey && CrownpeakDQM.openaiApiKey.length > 10;
        const accordionExpanded = !hasOpenAIKey;

        const dialogHTML = `
            <div class="dqm-ai-settings-dialog" id="dqm-ai-settings-dialog">
                <div class="dqm-ai-settings-content">
                    <div class="dqm-ai-settings-header">
                        <div class="dqm-ai-settings-title">
                            <svg class="dqm-ai-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
                            </svg>
                            <h2>${t('AI Assistant')}</h2>
                        </div>
                        <button class="dqm-dialog-close" id="dqm-ai-settings-close">×</button>
                    </div>
                    <div class="dqm-ai-settings-body">
                        <div class="dqm-toggle-section">
                            <div class="dqm-toggle-item">
                                <div class="dqm-toggle-info">
                                    <strong>${t('Auto-translate DQM results')}</strong>
                                    <p class="dqm-toggle-description">${t('Automatically translate checkpoint names and descriptions. Includes failed checkpoints.')}</p>
                                </div>
                                <label class="dqm-switch">
                                    <input type="checkbox" id="dqm-translation-toggle" ${translationEnabled ? 'checked' : ''} ${!hasOpenAIKey ? 'disabled' : ''}>
                                    <span class="dqm-switch-slider"></span>
                                </label>
                            </div>

                            <div class="dqm-toggle-item">
                                <div class="dqm-toggle-info">
                                    <strong>${t('Full translation power')}</strong>
                                    <p class="dqm-toggle-description">${t('Comprehensive translation (slower). When disabled, uses fast mode.')}</p>
                                </div>
                                <label class="dqm-switch">
                                    <input type="checkbox" id="dqm-translation-mode-toggle" ${translationMode === 'full' ? 'checked' : ''} ${!hasOpenAIKey || !translationEnabled ? 'disabled' : ''}>
                                    <span class="dqm-switch-slider"></span>
                                </label>
                            </div>

                            <div class="dqm-toggle-item">
                                <div class="dqm-toggle-info">
                                    <strong>${t('AI summary card')}</strong>
                                    <p class="dqm-toggle-description">${t('Generate bullet-point summaries of critical quality issues.')}</p>
                                </div>
                                <label class="dqm-switch">
                                    <input type="checkbox" id="dqm-summary-toggle" ${summaryEnabled ? 'checked' : ''} ${!hasOpenAIKey ? 'disabled' : ''}>
                                    <span class="dqm-switch-slider"></span>
                                </label>
                            </div>
                        </div>

                        <div class="dqm-accordion" id="dqm-ai-accordion">
                            <div class="dqm-accordion-header ${accordionExpanded ? 'expanded' : ''}" id="dqm-accordion-header">
                                <div class="dqm-accordion-title">
                                    <span>${t('ChatGPT (API)')}</span>
                                    <div class="dqm-accordion-chips">
                                        <span class="dqm-chip">${t('API')}</span>
                                        <span class="dqm-chip">${t('Summary')}</span>
                                    </div>
                                </div>
                                <svg class="dqm-accordion-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
                                </svg>
                            </div>
                            <div class="dqm-accordion-content ${accordionExpanded ? 'expanded' : ''}" id="dqm-accordion-content">
                                <div class="dqm-ai-info-box">
                                    <i class="fa-solid fa-circle-info"></i>
                                    <p>${t('AI may hallucinate or provide inaccurate information. Review results carefully.')}</p>
                                </div>

                                <div class="dqm-field-group">
                                    <label>${t('Model')}</label>
                                    <div class="dqm-readonly-field">
                                        ${CrownpeakDQM.openaiModel || 'gpt-4o-mini'}
                                    </div>
                                </div>

                                <div class="dqm-field-group">
                                    <label>${t('Base URL')}</label>
                                    <div class="dqm-readonly-field">
                                        https://api.openai.com/v1
                                    </div>
                                </div>

                                <div class="dqm-field-group">
                                    <label>${t('API Key')}</label>
                                    <div class="dqm-readonly-field">
                                        ${hasOpenAIKey ? '••••••••••••••••' : t('Not configured')}
                                    </div>
                                </div>

                                ${translationEnabled && hasOpenAIKey ? `
                                <div class="dqm-status-section">
                                    <div class="dqm-alert dqm-alert-success">
                                        <i class="fa-solid fa-circle-check"></i>
                                        <span>${t('Translation is enabled and working')}</span>
                                    </div>
                                </div>
                                ` : ''}

                                <div class="dqm-settings-link">
                                    <p>
                                        ${t('To change AI settings, visit')} 
                                        <a href="${window.location.origin}/wp-admin/options-general.php?page=dqm-wordpress-plugin" target="_blank">
                                            ${t('Plugin Settings')} <i class="fa-solid fa-arrow-up-right-from-square"></i>
                                        </a>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div class="dqm-ai-warning-box">
                            <i class="fa-solid fa-triangle-exclamation"></i>
                            <p>${t('AI may hallucinate or provide inaccurate information. Review results carefully.')}</p>
                        </div>

                        <div id="dqm-translation-progress-container" style="display: none;">
                            <div class="dqm-translation-progress">
                                <div class="dqm-translation-status">
                                    <strong id="dqm-translation-status-text">${t('Translating...')}</strong>
                                </div>
                                <div class="dqm-progress-bar">
                                    <div class="dqm-progress-fill" id="dqm-translation-progress-fill" style="width: 0%"></div>
                                </div>
                                <div class="dqm-progress-text" id="dqm-translation-progress-text">0 / 0 ${t('checkpoints translated')}</div>
                            </div>
                        </div>
                    </div>

                    <div class="dqm-ai-settings-footer">
                        <button class="dqm-action-btn dqm-action-btn-secondary" id="dqm-ai-clear-cache-btn">
                            ${t('Clear AI cache')}
                        </button>
                        <button class="dqm-action-btn dqm-action-btn-secondary" id="dqm-ai-translate-btn" ${!translationEnabled || !hasOpenAIKey ? 'disabled' : ''}>
                            ${t('Translate missing items')}
                        </button>
                        <button class="dqm-action-btn dqm-action-btn-secondary" id="dqm-ai-restart-summary-btn" ${!summaryEnabled || !hasOpenAIKey || !lastAssetId ? 'disabled' : ''}>
                            ${t('Restart summary')}
                        </button>
                        <button class="dqm-action-btn dqm-action-btn-primary" id="dqm-ai-close-btn">
                            ${t('Close')}
                        </button>
                    </div>
                </div>
            </div>
        `;

        const existingDialog = document.getElementById('dqm-ai-settings-dialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        document.body.insertAdjacentHTML('beforeend', dialogHTML);

        const dialog = document.getElementById('dqm-ai-settings-dialog');
        const closeBtn = document.getElementById('dqm-ai-settings-close');
        const closeBtnFooter = document.getElementById('dqm-ai-close-btn');
        const clearCacheBtn = document.getElementById('dqm-ai-clear-cache-btn');
        const translateBtn = document.getElementById('dqm-ai-translate-btn');
        const restartSummaryBtn = document.getElementById('dqm-ai-restart-summary-btn');
        const accordionHeader = document.getElementById('dqm-accordion-header');
        const accordionContent = document.getElementById('dqm-accordion-content');

        const translationToggle = document.getElementById('dqm-translation-toggle');
        const translationModeToggle = document.getElementById('dqm-translation-mode-toggle');
        const summaryToggle = document.getElementById('dqm-summary-toggle');

        if (translationToggle) {
            translationToggle.addEventListener('change', (e) => {
                translationEnabled = e.target.checked;
                setAIToggleState('translationEnabled', translationEnabled.toString());

                if (translationModeToggle) {
                    translationModeToggle.disabled = !translationEnabled;
                }

            });
        }

        if (translationModeToggle) {
            translationModeToggle.addEventListener('change', (e) => {
                translationMode = e.target.checked ? 'full' : 'fast';
                setAIToggleState('translationMode', translationMode);

            });
        }

        if (summaryToggle) {
            summaryToggle.addEventListener('change', (e) => {
                summaryEnabled = e.target.checked;
                setAIToggleState('summaryEnabled', summaryEnabled.toString());

                if (summaryEnabled && lastAssetId && allCheckpoints.length > 0) {
                    generateAISummary(lastAssetId, allCheckpoints, currentLocale);
                }

            });
        }

        if (accordionHeader && accordionContent) {
            accordionHeader.addEventListener('click', () => {
                const isExpanded = accordionHeader.classList.contains('expanded');
                accordionHeader.classList.toggle('expanded');
                accordionContent.classList.toggle('expanded');
            });
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                dialog.remove();
            });
        }

        if (closeBtnFooter) {
            closeBtnFooter.addEventListener('click', () => {
                dialog.remove();
            });
        }

        if (clearCacheBtn) {
            const stats = getCacheStats();
            const totalEntries = stats.translation.count + stats.summary.count;
            if (totalEntries > 0) {
                clearCacheBtn.innerHTML = `<i class="fa-solid fa-trash"></i> ${t('Clear AI cache')} (${totalEntries})`;
            }
            
            clearCacheBtn.addEventListener('click', () => {
                aiSummaryCache = {};
                clearPersistentCache('all');
                
                if (aiTranslationManager) {
                    aiTranslationManager.clearCache();
                }
                
                clearCacheBtn.innerHTML = '<i class="fa-solid fa-check"></i> ' + t('ai_cache_cleared');
                clearCacheBtn.disabled = true;
                setTimeout(() => {
                    clearCacheBtn.innerHTML = t('ai_cache_clear');
                    clearCacheBtn.disabled = false;
                    dialog.remove();
                }, 2000);
            });
        }

        if (restartSummaryBtn && !restartSummaryBtn.disabled) {
            restartSummaryBtn.addEventListener('click', () => {
                const cacheKey = `${lastAssetId}:${currentLocale}`;
                delete aiSummaryCache[cacheKey];
                if (lastAssetId) {
                    generateAISummary(lastAssetId, allCheckpoints, currentLocale);
                }
                restartSummaryBtn.innerHTML = '<i class="fa-solid fa-check"></i> ' + t('summary_regenerate');
                restartSummaryBtn.disabled = true;
                setTimeout(() => {
                    restartSummaryBtn.innerHTML = t('summary_regenerate');
                    restartSummaryBtn.disabled = false;
                }, 2000);
            });
        }

        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.remove();
            }
        });

        document.addEventListener('keydown', function escapeHandler(e) {
            if (e.key === 'Escape') {
                dialog.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        });
    }

    function createLanguageSwitcher() {
        const container = document.createElement('div');
        container.className = 'dqm-language-switcher';
        
        const select = document.createElement('select');
        select.className = 'dqm-language-select';
        select.setAttribute('aria-label', t('language'));
        
        SUPPORTED_LOCALES.forEach(locale => {
            const option = document.createElement('option');
            option.value = locale;
            option.textContent = t(`language_${locale}`);
            if (locale === currentLocale) {
                option.selected = true;
            }
            select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
            const newLocale = e.target.value;
            if (changeLanguage(newLocale)) {
                window.location.reload();
            }
        });
        
        const localeInfo = getLocaleInfo();
        if (localeInfo.source !== 'default') {
            const sourceLabel = document.createElement('span');
            sourceLabel.className = 'dqm-locale-source';
            sourceLabel.textContent = t(`source_${localeInfo.source}`);
            sourceLabel.title = `Locale source: ${localeInfo.source}`;
            container.appendChild(sourceLabel);
            
            if (localeInfo.isUserOverride) {
                const resetBtn = document.createElement('button');
                resetBtn.className = 'dqm-locale-reset';
                resetBtn.textContent = t('reset');
                resetBtn.title = 'Reset to browser/default language';
                resetBtn.addEventListener('click', () => {
                    resetLanguage();
                    window.location.reload();
                });
                container.appendChild(resetBtn);
            }
        }
        
        container.appendChild(select);
        
        return container;
    }

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
            scanBtn.textContent = t('run_quality_check');
            scanBtn.className = 'primary-button';
            const headerContainer = document.createElement('div');
            headerContainer.className = 'dqm-header-container';

            const headerTitle = document.createElement('div');
            headerTitle.className = 'dqm-header-title';
            headerTitle.textContent = t('title');
            headerContainer.appendChild(headerTitle);

            const languageSwitcher = createLanguageSwitcher();
            headerContainer.appendChild(languageSwitcher);

            const hasOpenAIKey = CrownpeakDQM.openaiApiKey && CrownpeakDQM.openaiApiKey.length > 10;
            if (hasOpenAIKey) {
                const aiAssistantBtn = document.createElement('button');
                aiAssistantBtn.id = 'dqm-ai-assistant-btn';
                aiAssistantBtn.className = 'dqm-ai-assistant-button';
                aiAssistantBtn.setAttribute('type', 'button');
                aiAssistantBtn.setAttribute('aria-label', t('ai_settings'));
                aiAssistantBtn.innerHTML = '<svg class="dqm-ai-icon" focusable="false" aria-hidden="true" viewBox="0 0 24 24"><path d="m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z"></path></svg>';
                aiAssistantBtn.onclick = function() {
                    showAISettingsDialog();
                };
                headerContainer.appendChild(aiAssistantBtn);
            }

            panel.appendChild(headerContainer);

            const aiSummaryContainer = document.createElement('div');
            aiSummaryContainer.id = 'dqm-ai-summary-container';
            aiSummaryContainer.style.display = 'none';
            panel.appendChild(aiSummaryContainer);

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
            failedHeader.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ff5630;margin-right:8px;"></i>' + t('failed_checkpoints_title');
            failedCheckpointsCard.appendChild(failedHeader);

            checkpointsList = document.createElement('div');
            checkpointsList.id = 'dqm-checkpoints-list';
            checkpointsList.className = '';
            failedCheckpointsCard.appendChild(checkpointsList);
            injectHighlightCSS();
            renderCheckpointsList = function(selectedTopic) {
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
                        ? t('no_issues_found')
                        : t('no_issues_for_topic');
                    card.appendChild(noFailuresMsg);
                } else {
                    const ul = document.createElement('ul');
                    ul.className = 'checkpoint-list';
                    failed.forEach(cp => {
                        const li = document.createElement('li');
                        li.className = 'checkpoint-item';
                        li.setAttribute('data-checkpoint-id', cp.id);

                        if (aiTranslationManager && 
                            aiTranslationManager.translationState === 'translating' &&
                            !aiTranslationManager.isCheckpointFullyTranslated(cp.id)) {
                            li.classList.add('translating');
                        }

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
                                badge.textContent = t(topic);
                                badgesDiv.appendChild(badge);
                            });
                            contentDiv.appendChild(badgesDiv);
                            badgesAdded = true;
                        }
                        if (cp.canHighlight && !canHighlightAny) {
                            const cannotHighlight = document.createElement('div');
                            cannotHighlight.className = 'checkpoint-no-highlight';
                            cannotHighlight.textContent = t('Cannot highlight');
                            contentDiv.appendChild(cannotHighlight);
                        } else if (canHighlightAny) {
                            const canHighlight = document.createElement('div');
                            canHighlight.className = 'checkpoint-highlight-info';
                            canHighlight.textContent = t('Click to highlight');
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
            };

            injectHighlightCSS();

            fetch(ajaxurl + '?action=crownpeakDqmGetCheckpoints', { credentials: 'same-origin' })
                .then(response => response.json())
                .then(async (data) => {
                    if (data.success && Array.isArray(data.checkpoints)) {
                        let checkpoints = data.checkpoints;

                        originalCheckpoints = JSON.parse(JSON.stringify(checkpoints));

                        const resolvedLocale = resolveLocale();
                        if (resolvedLocale !== currentLocale) {

                            currentLocale = resolvedLocale;
                        }

                        const targetLang = currentLocale || 'en';

                        const translationEnabled = getAIToggleState('translationEnabled', 'false') === 'true';
                        const hasOpenAIKey = CrownpeakDQM.openaiApiKey && CrownpeakDQM.openaiApiKey.length > 10;
                        const isTranslationReady = translationEnabled && hasOpenAIKey;
                        const isTranslationNeeded = targetLang && targetLang !== 'en';




                        if (!aiTranslationManager) {
                            console.warn('⚠️ Translation Manager not initialized');
                        } else if (!isTranslationReady) {
                            console.warn('⚠️ Translation not ready. Toggle enabled:', translationEnabled, 'API Key:', hasOpenAIKey);
                        } else if (!isTranslationNeeded) {

                        }

                        if (aiTranslationManager && isTranslationReady && isTranslationNeeded) {
                            try {
                                setAIButtonLoadingState(true);

                                topicsLoading.textContent = __('Translating titles...', 'dqm-wordpress-plugin');
                                topicsLoading.style.display = 'inline';

                                checkpoints = await aiTranslationManager.translateCheckpoints(
                                    checkpoints, 
                                    targetLang,
                                    (progress, state, error) => {
                                        if (progress) {
                                            const percent = Math.round((progress.translatedCheckpoints / progress.totalCheckpoints) * 100);
                                            topicsLoading.textContent = `${__('Translating titles...', 'dqm-wordpress-plugin')} ${percent}%`;

                                            updateTranslationProgressInDialog(progress, state);
                                        }
                                        if (error) {
                                            console.warn('⚠️ Title translation error:', error);
                                        }
                                    },
                                    true
                                );

                                allCheckpoints = checkpoints;

                                allTopics.clear();
                                checkpoints.forEach(cp => {
                                    if (Array.isArray(cp.topics)) {
                                        cp.topics.forEach(t => allTopics.add(t));
                                    }
                                });

                                while (topicsDropdown.options.length > 1) {
                                    topicsDropdown.remove(1);
                                }
                                Array.from(allTopics).sort().forEach(topic => {
                                    const opt = document.createElement('option');
                                    opt.value = topic;
                                    opt.textContent = topic;
                                    topicsDropdown.appendChild(opt);
                                });

                                renderCheckpointsList(topicsDropdown.value || 'all');
                                topicsLoading.style.display = 'none';

                                aiTranslationManager.translateCheckpoints(
                                    checkpoints, 
                                    targetLang,
                                    (progress, state, error) => {
                                        if (progress) {
                                            const percent = Math.round((progress.translatedCheckpoints / progress.totalCheckpoints) * 100);

                                            updateTranslationProgressInDialog(progress, state);
                                        }
                                        if (state === 'ready' || state === 'error') {
                                            setAIButtonLoadingState(false);
                                            updateTranslationProgressInDialog(progress, state);
                                        }
                                    },
                                    false 
                                ).then(fullyTranslatedCheckpoints => {

                                    checkpoints = fullyTranslatedCheckpoints;
                                    allCheckpoints = fullyTranslatedCheckpoints;

                                    allTopics.clear();
                                    fullyTranslatedCheckpoints.forEach(cp => {
                                        if (Array.isArray(cp.topics)) {
                                            cp.topics.forEach(t => allTopics.add(t));
                                        }
                                    });

                                    while (topicsDropdown.options.length > 1) {
                                        topicsDropdown.remove(1);
                                    }
                                    Array.from(allTopics).sort().forEach(topic => {
                                        const opt = document.createElement('option');
                                        opt.value = topic;
                                        opt.textContent = topic;
                                        topicsDropdown.appendChild(opt);
                                    });

                                    renderCheckpointsList(topicsDropdown.value || 'all');

                                    document.querySelectorAll('.checkpoint-item.translating').forEach(item => {
                                        item.classList.remove('translating');
                                    });

                                    setAIButtonLoadingState(false);

                                }).catch(err => {

                                    document.querySelectorAll('.checkpoint-item.translating').forEach(item => {
                                        item.classList.remove('translating');
                                    });

                                    setAIButtonLoadingState(false);
                                });

                                return;

                            } catch (error) {

                                if (error.name === 'AbortError' || error.message.includes('aborted')) {
                                    console.log('⏸️ Translation aborted (user switched language)');
                                } else {
                                    console.error('❌ Translation failed:', error);
                                }
                                setAIButtonLoadingState(false);
                            }
                        }

                        topicsLoading.style.display = 'none';
                        allCheckpoints = checkpoints;
                        allTopics.clear();
                        checkpoints.forEach(cp => {
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
                        topicsLoading.style.display = 'none';
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
            renderScoreCard = function(passedCount, totalCount) {
                const percent = totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0;
                let html = `

                    <div class="card">
                        <h3>📊 ${t('quality_overview')}</h3>
                        <div class="chart-container">
                            <div class="pie-chart"></div>
                            <div class="legend">
                                <div class="legend-item">
                                    <div class="legend-color passed"></div>
                                    <span>${t('passed')} (${passedCount})</span>
                                </div>
                                <div class="legend-item">
                                    <div class="legend-color failed"></div>
                                    <span>${t('failed')} (${totalCount - passedCount})</span>
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
                        <h3>📈 ${t('quality_breakdown')}</h3>`;
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
                                    <span>${passed}/${total} ${t('passed')}</span>
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
            };
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

                        if (getAIToggleState('summaryEnabled', 'false') === 'true') {
                            generateAISummary(data.assetId, allCheckpoints, currentLocale);
                        }

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

    function createLanguageSwitcher() {
        const container = document.createElement('div');
        container.className = 'dqm-language-switcher';
        container.style.cssText = 'position: relative; margin: 16px 0;';

        const button = document.createElement('button');
        button.className = 'dqm-language-button';
        button.setAttribute('aria-label', t('language'));
        button.disabled = localeSource === 'url';

        button.innerHTML = '<svg class="dqm-translate-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>';

        const menu = document.createElement('div');
        menu.className = 'dqm-language-menu';
        menu.style.display = 'none';

        const flagSvg = {
            en: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="14"><rect width="22" height="14" fill="#fff"/><g stroke-width="0"><rect y="0" width="22" height="2" fill="#b22234"/><rect y="3" width="22" height="2" fill="#b22234"/><rect y="6" width="22" height="2" fill="#b22234"/><rect y="9" width="22" height="2" fill="#b22234"/><rect y="12" width="22" height="2" fill="#b22234"/><rect width="10" height="8" fill="#3c3b6e"/></g></svg>',
            de: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="14"><rect width="22" height="14" fill="#ffce00"/><rect y="0" width="22" height="4.67" fill="#000"/><rect y="9.33" width="22" height="4.67" fill="#dd0000"/></svg>',
            es: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="14"><rect width="22" height="14" fill="#c60b1e"/><rect y="4" width="22" height="6" fill="#ffc400"/></svg>'
        };

        SUPPORTED_LOCALES.forEach(function(locale) {
            const menuItem = document.createElement('div');
            menuItem.className = 'dqm-language-menu-item';
            if (locale === currentLocale) {
                menuItem.classList.add('active');
            }

            const flagContainer = document.createElement('div');
            flagContainer.className = 'dqm-flag-container';
            flagContainer.innerHTML = flagSvg[locale];

            const labelContainer = document.createElement('div');
            labelContainer.className = 'dqm-language-label';

            const labelRow = document.createElement('div');
            labelRow.className = 'dqm-language-label-row';

            const label = document.createElement('span');
            label.textContent = t('language_' + locale);

            const code = document.createElement('span');
            code.className = 'dqm-language-code';
            code.textContent = locale.toUpperCase();

            labelRow.appendChild(label);
            labelRow.appendChild(code);
            labelContainer.appendChild(labelRow);

            if (locale === currentLocale) {
                const sourceLabel = document.createElement('div');
                sourceLabel.className = 'dqm-language-source';
                sourceLabel.textContent = t('source_' + localeSource);
                if (localeSource === 'url') {
                    sourceLabel.style.color = '#d63301';
                }
                labelContainer.appendChild(sourceLabel);
            }

            menuItem.appendChild(flagContainer);
            menuItem.appendChild(labelContainer);

            menuItem.addEventListener('click', function() {
                if (locale !== currentLocale && localeSource !== 'url') {
                    changeLanguage(locale);
                    menu.style.display = 'none';
                }
            });

            menu.appendChild(menuItem);
        });

        const divider = document.createElement('div');
        divider.className = 'dqm-menu-divider';
        menu.appendChild(divider);

        const resetItem = document.createElement('div');
        resetItem.className = 'dqm-language-menu-item dqm-reset-item';
        resetItem.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
        const resetText = document.createElement('span');
        resetText.textContent = t('reset');
        resetItem.appendChild(resetText);

        resetItem.addEventListener('click', function() {
            if (localeSource !== 'url' && userOverride) {
                resetLanguage();
                menu.style.display = 'none';
            }
        });

        if (!userOverride || localeSource === 'url') {
            resetItem.style.opacity = '0.5';
            resetItem.style.cursor = 'not-allowed';
        }

        menu.appendChild(resetItem);

        button.addEventListener('click', function(e) {
            e.stopPropagation();
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });

        document.addEventListener('click', function(e) {
            if (!container.contains(e.target)) {
                menu.style.display = 'none';
            }
        });

        container.appendChild(button);
        container.appendChild(menu);

        return container;
    }

    function updateTranslationProgressInDialog(progress, state) {
        const container = document.getElementById('dqm-translation-progress-container');
        const statusText = document.getElementById('dqm-translation-status-text');
        const progressFill = document.getElementById('dqm-translation-progress-fill');
        const progressText = document.getElementById('dqm-translation-progress-text');

        if (!container) return;

        if (state === 'translating' && progress) {
            container.style.display = 'block';
            const percent = progress.totalCheckpoints > 0 
                ? Math.round((progress.translatedCheckpoints / progress.totalCheckpoints) * 100) 
                : 0;
            
            if (statusText) statusText.textContent = t('Translating...');
            if (progressFill) progressFill.style.width = `${percent}%`;
            if (progressText) {
                progressText.textContent = `${progress.translatedCheckpoints} / ${progress.totalCheckpoints} ${t('checkpoints translated')}`;
            }
        } else if (state === 'ready') {

            setTimeout(() => {
                if (container) container.style.display = 'none';
            }, 2000);
        } else if (state === 'error' || state === 'idle') {
            container.style.display = 'none';
        }
    }

    function setAIButtonLoadingState(isLoading) {
        const aiAssistantBtn = document.getElementById('dqm-ai-assistant-btn');
        if (!aiAssistantBtn) return;

        if (isLoading) {
            aiAssistantBtn.classList.add('translating');
            const originalIcon = aiAssistantBtn.innerHTML;
            aiAssistantBtn.setAttribute('data-original-icon', originalIcon);
            aiAssistantBtn.innerHTML = `
                <svg class="dqm-ai-icon dqm-ai-icon-spinning" focusable="false" aria-hidden="true" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" opacity="0.25"/>
                    <path fill="currentColor" d="M12 2 A10 10 0 0 1 22 12" opacity="0.75"/>
                </svg>
            `;

            aiAssistantBtn.disabled = false;
        } else {
            aiAssistantBtn.classList.remove('translating');
            const originalIcon = aiAssistantBtn.getAttribute('data-original-icon');
            if (originalIcon) {
                aiAssistantBtn.innerHTML = originalIcon;
                aiAssistantBtn.removeAttribute('data-original-icon');
            }
            aiAssistantBtn.disabled = false;
        }
    }

    function changeLanguage(newLocale) {
        if (!SUPPORTED_LOCALES.includes(newLocale)) return;

        currentLocale = newLocale;
        localeSource = 'user';
        userOverride = true;
        persistLocale(newLocale);

        if (window.wp && wp.i18n && wp.i18n.setLocaleData) {
            try {
                const localeMap = { en: 'en_US', de: 'de_DE', es: 'es_ES' };
                const wpLocale = localeMap[newLocale] || 'en_US';

            } catch (e) {
                console.warn('Could not update WordPress locale:', e);
            }
        }

        if (window.DQM_I18N && window.DQM_I18N.loadLanguageFile) {
             window.DQM_I18N.loadLanguageFile(newLocale).then(() => {
                updateUITranslations();
                refreshResults();
             }).catch(e => {
                console.warn('Language load failed', e);
                updateUITranslations();
                refreshResults();
             });
        } else {
            updateUITranslations();
            refreshResults();
        }

        function refreshResults() {
             if (Object.keys(checkpointStatusMap).length > 0) {
                if (Array.isArray(allCheckpoints) && allCheckpoints.length > 0) {
                    const total = allCheckpoints.length;
                    const passed = allCheckpoints.filter(cp => !checkpointStatusMap[cp.id]).length;
                    const scoreCardContainer = document.getElementById('dqm-score-card-container');
                    if (scoreCardContainer) {
                        renderScoreCard(passed, total);
                    }
                }

                const dropdown = document.getElementById('dqm-topics-dropdown');
                if (dropdown && typeof renderCheckpointsList === 'function') {
                    renderCheckpointsList(dropdown.value);
                }
            }
        }

        const needsTranslation = aiTranslationManager && 
            aiTranslationManager.isTranslationReady() && 
            aiTranslationManager.isTranslationNeeded(newLocale);

        if (needsTranslation && Array.isArray(allCheckpoints) && allCheckpoints.length > 0) {
            setAIButtonLoadingState(true);
            
            const topicsLoading = document.getElementById('dqm-topics-loading');
            if (topicsLoading) {
                topicsLoading.textContent = t('Translating...');
                topicsLoading.style.display = 'inline';
            }

            aiTranslationManager.restartTranslation();

            aiTranslationManager.translateCheckpoints(
                allCheckpoints, 
                    newLocale,
                    (progress, state, error) => {
                        if (progress && topicsLoading) {
                            const percent = Math.round((progress.translatedCheckpoints / progress.totalCheckpoints) * 100);
                            topicsLoading.textContent = `${__('Translating...', 'dqm-wordpress-plugin')} ${percent}%`;
                            updateTranslationProgressInDialog(progress, state);
                        }
                    },
                    true
                ).then(translatedCheckpoints => {
                    allCheckpoints = translatedCheckpoints;

                    const topicsDropdown = document.getElementById('dqm-topics-dropdown');
                    if (topicsDropdown) {
                        const selectedValue = topicsDropdown.value;
                        allTopics.clear();
                        translatedCheckpoints.forEach(cp => {
                            if (Array.isArray(cp.topics)) {
                                cp.topics.forEach(t => allTopics.add(t));
                            }
                        });

                        while (topicsDropdown.options.length > 1) {
                            topicsDropdown.remove(1);
                        }
                        Array.from(allTopics).sort().forEach(topic => {
                            const opt = document.createElement('option');
                            opt.value = topic;
                            opt.textContent = topic;
                            topicsDropdown.appendChild(opt);
                        });
                        topicsDropdown.value = selectedValue;

                        renderCheckpointsList(selectedValue || 'all');
                    }

                    if (topicsLoading) {
                        topicsLoading.style.display = 'none';
                    }


                    aiTranslationManager.translateCheckpoints(
                        translatedCheckpoints, 
                        newLocale,
                        (progress, state, error) => {
                            updateTranslationProgressInDialog(progress, state);
                            if (state === 'ready' || state === 'error') {
                                setAIButtonLoadingState(false);
                            }
                        },
                        false
                    ).then(fullyTranslatedCheckpoints => {
                        allCheckpoints = fullyTranslatedCheckpoints;
                        const topicsDropdown = document.getElementById('dqm-topics-dropdown');
                        if (topicsDropdown) {
                            renderCheckpointsList(topicsDropdown.value || 'all');
                        }
                        setAIButtonLoadingState(false);

                    }).catch(error => {

                        if (error.name === 'AbortError' || error.message.includes('aborted')) {
                            console.log('⏸️ Translation aborted (user switched language)');
                        } else {
                            console.error('❌ Full translation error:', error);
                        }
                        setAIButtonLoadingState(false);
                    });

                }).catch(error => {

                    if (error.name === 'AbortError' || error.message.includes('aborted')) {
                        console.log('⏸️ Title translation aborted (user switched language)');
                    } else {
                        console.error('❌ Title translation error:', error);
                    }
                    if (topicsLoading) {
                        topicsLoading.style.display = 'none';
                    }
                    setAIButtonLoadingState(false);
                });
            } else {
                if (aiTranslationManager) {
                    aiTranslationManager.restartTranslation();
                }

                setAIButtonLoadingState(false);

                if (originalCheckpoints && originalCheckpoints.length > 0) {
                    allCheckpoints = JSON.parse(JSON.stringify(originalCheckpoints));

                    const topicsDropdown = document.getElementById('dqm-topics-dropdown');
                    if (topicsDropdown) {
                        const selectedValue = topicsDropdown.value;
                        allTopics.clear();
                        allCheckpoints.forEach(cp => {
                            if (Array.isArray(cp.topics)) {
                                cp.topics.forEach(t => allTopics.add(t));
                            }
                        });

                        while (topicsDropdown.options.length > 1) {
                            topicsDropdown.remove(1);
                        }
                        Array.from(allTopics).sort().forEach(topic => {
                            const opt = document.createElement('option');
                            opt.value = topic;
                            opt.textContent = topic;
                            topicsDropdown.appendChild(opt);
                        });
                        topicsDropdown.value = selectedValue;
                    }
                }

                const dropdown = document.getElementById('dqm-topics-dropdown');
                if (dropdown && typeof renderCheckpointsList === 'function') {
                    renderCheckpointsList(dropdown.value);
                }
            }

        if (lastAssetId && getAIToggleState('summaryEnabled', 'false') === 'true' && Object.keys(checkpointStatusMap).length > 0) {
            generateAISummary(lastAssetId, allCheckpoints, currentLocale);
        }

        const existingSwitcher = document.querySelector('.dqm-language-switcher');
        if (existingSwitcher) {
            const newSwitcher = createLanguageSwitcher();
            existingSwitcher.replaceWith(newSwitcher);
        }
    }

    function resetLanguage() {
        persistLocale(null);
        currentLocale = resolveLocale();
        updateUITranslations();

        if (Object.keys(checkpointStatusMap).length > 0) {
            if (Array.isArray(allCheckpoints) && allCheckpoints.length > 0) {
                const total = allCheckpoints.length;
                const passed = allCheckpoints.filter(cp => !checkpointStatusMap[cp.id]).length;
                const scoreCardContainer = document.getElementById('dqm-score-card-container');
                if (scoreCardContainer) {
                    renderScoreCard(passed, total);
                }
            }

            const dropdown = document.getElementById('dqm-topics-dropdown');
            if (dropdown && typeof renderCheckpointsList === 'function') {
                renderCheckpointsList(dropdown.value);
            }
        }

        if (lastAssetId && getAIToggleState('summaryEnabled', 'false') === 'true' && Object.keys(checkpointStatusMap).length > 0) {
            generateAISummary(lastAssetId, allCheckpoints, currentLocale);
        }

        const existingSwitcher = document.querySelector('.dqm-language-switcher');
        if (existingSwitcher) {
            const newSwitcher = createLanguageSwitcher();
            existingSwitcher.replaceWith(newSwitcher);
        }
    }

    function updateUITranslations() {
        const currentTranslations = (window.DQM_I18N && window.DQM_I18N[currentLocale]) || window.DQM_I18N.en;

        const headerTitle = document.querySelector('.dqm-header-title');
        if (headerTitle) {
            headerTitle.textContent = t('title');
        }

        const scanButtons = document.querySelectorAll('#dqm-scan-content-sidebar-btn, #dqm-scan-content-after-failed-btn');
        scanButtons.forEach(function(btn) {
            if (btn) btn.textContent = t('run_quality_check');
        });

        const topicsLabel = document.querySelector('.dqm-topics-label');
        if (topicsLabel) {
            topicsLabel.textContent = t('Filter by Topic:');
        }

        const topicsDropdown = document.getElementById('dqm-topics-dropdown');
        if (topicsDropdown) {
            const firstOption = topicsDropdown.querySelector('option[value="all"]');
            if (firstOption) {
                firstOption.textContent = t('All Topics');
            }
        }

        if (toggleButton && toggleButton.style.display !== 'none') {
            const buttonText = currentHighlightMode === 'page' ? 
                t('Source') : 
                t('Browser');
            toggleButton.textContent = buttonText;
        }

        const scoreCardHeadings = document.querySelectorAll('#dqm-score-card-container h3');
        scoreCardHeadings.forEach(function(heading) {
            if (heading.textContent.includes('Quality Overview') || heading.textContent.includes('Gesamtqualität') || heading.textContent.includes('Calidad general')) {
                heading.textContent = '📊 ' + t('quality_overview');
            }
            if (heading.textContent.includes('Quality Breakdown') || heading.textContent.includes('Qualitätsübersicht') || heading.textContent.includes('Desglose de calidad')) {
                heading.textContent = '📈 ' + t('quality_breakdown');
            }
        });

        const passedSpans = document.querySelectorAll('.dqm-breakdown-header span:last-child');
        passedSpans.forEach(function(span) {
            const text = span.textContent;
            const match = text.match(/(\d+)\/(\d+)\s+(.+)/);
            if (match) {
                span.textContent = match[1] + '/' + match[2] + ' ' + t('passed');
            }
        });

        const badgeSpans = document.querySelectorAll('.dqm-breakdown-item .badge');
        badgeSpans.forEach(function(badge) {
            const currentText = badge.textContent.trim();
            const categoryMap = {
                'Accessibility': 'Accessibility',
                'Barrierefreiheit': 'Accessibility',
                'Accesibilidad': 'Accessibility',
                'SEO': 'SEO',
                'Brand': 'Brand',
                'Marke': 'Brand',
                'Marca': 'Brand',
                'Regulatory': 'Regulatory',
                'Vorschriften': 'Regulatory',
                'Regulatorio': 'Regulatory',
                'Legal': 'Legal',
                'Rechtliches': 'Legal',
                'Rechtlich': 'Legal',
                'Usability': 'Usability',
                'Benutzerfreundlichkeit': 'Usability',
                'Usabilidad': 'Usability'
            };
            const englishKey = categoryMap[currentText];
            if (englishKey) {
                badge.textContent = t(englishKey);
            }
        });

        document.querySelectorAll('.checkpoint-no-highlight').forEach(function(el) {
            el.textContent = t('Cannot highlight');
        });

        document.querySelectorAll('.checkpoint-highlight-info').forEach(function(el) {
            el.textContent = t('Click to highlight');
        });

        const failedHeaders = document.querySelectorAll('.card h3');
        failedHeaders.forEach(function(heading) {
            const icon = heading.querySelector('i.fa-triangle-exclamation');
            if (icon) {
                heading.innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:#ff5630;margin-right:8px;"></i>' + t('failed_checkpoints_title');
            }
        });

        const dropdown = document.getElementById('dqm-topics-dropdown');
        if (dropdown && typeof renderCheckpointsList === 'function') {
            renderCheckpointsList(dropdown.value);
        }
    }

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

        const isTranslating = aiTranslationManager && 
                             !aiTranslationManager.isCheckpointFullyTranslated(cp.id) &&
                             aiTranslationManager.translationState === 'translating';

        if (isTranslating) {
            const loadingBanner = document.createElement('div');
            loadingBanner.className = 'dqm-dialog-loading-banner';
            loadingBanner.innerHTML = '<span class="dqm-dialog-loading-spinner"></span>' + __('Translating...', 'dqm-wordpress-plugin');
            checkpointDialog.appendChild(loadingBanner);
        }

        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.className = 'dqm-dialog-close';
        closeBtn.setAttribute('aria-label', __('Close', 'dqm-wordpress-plugin'));
        closeBtn.onclick = function() {
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

            if (isTranslating) {
                desc.innerHTML = '<span class="dqm-dialog-placeholder">' + __('Description translating...', 'dqm-wordpress-plugin') + '</span>';
            } else {
                desc.innerHTML = cp.description;
            }
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
                radios.forEach(function(r) { r.checked = false; });
            }
        }
    });

    let checkpointIssuesDialog = null;
})();