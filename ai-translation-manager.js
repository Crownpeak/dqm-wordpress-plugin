
class AITranslationManager {
    constructor() {
        this.translationCache = {};
        this.translationState = 'idle';
        this.translationProgress = {
            translatedCheckpoints: 0,
            totalCheckpoints: 0
        };
        this.translationError = null;
        this.abortController = null;
        this.checkpointTranslationStatus = {};
        this.titlesTranslated = false;
    }

    isTranslationNeeded(targetLang) {
        return targetLang && targetLang !== 'en';
    }

    isTranslationReady() {

        const translationEnabled = this.getToggleState('translationEnabled') === 'true';
        const hasKey = CrownpeakDQM.openaiApiKey && CrownpeakDQM.openaiApiKey.length > 10;




        return translationEnabled && hasKey;
    }

    getTranslationMode() {

        return this.getToggleState('translationMode') || 'fast';
    }

    getToggleState(key) {
        try {

            const snakeCase = key.replace(/([A-Z])/g, '_$1').toLowerCase();
            const storageKey = `dqm_${snakeCase}`;
            const value = localStorage.getItem(storageKey);

            return value;
        } catch (e) {
            console.error('[AITranslationManager] Failed to get toggle state:', e);
            return null;
        }
    }

    async translateCheckpoints(checkpoints, targetLang, onProgress, titlesOnly = false) {
        if (!this.isTranslationReady()) {
            throw new Error('Translation is not enabled or configured');
        }

        if (!this.isTranslationNeeded(targetLang)) {
            return checkpoints;
        }

        const cacheKey = `${targetLang}_${this.getTranslationMode()}_${titlesOnly ? 'titles_' : ''}${this.generateCheckpointHash(checkpoints)}`;

        if (this.translationCache[cacheKey]) {
            return this.translationCache[cacheKey];
        }

        this.translationState = 'initializing';
        this.translationProgress = {
            translatedCheckpoints: 0,
            totalCheckpoints: checkpoints.length
        };
        this.translationError = null;
        this.abortController = new AbortController();

        if (onProgress) {
            onProgress(this.translationProgress, this.translationState);
        }

        const translatedCheckpoints = [];
        const batchSize = 10;
        let batchStart = 0;

        try {
            this.translationState = 'translating';

            while (batchStart < checkpoints.length) {
                if (this.abortController.signal.aborted) {
                    throw new Error('Translation aborted');
                }

                const formData = new FormData();
                formData.append('action', 'crownpeak_dqm_translate');
                formData.append('checkpoints', JSON.stringify(checkpoints));
                formData.append('targetLang', targetLang);
                formData.append('batchStart', batchStart);
                formData.append('batchSize', batchSize);
                formData.append('titlesOnly', titlesOnly ? '1' : '0');

                const response = await fetch(CrownpeakDQM.ajaxurl, {
                    method: 'POST',
                    body: formData,
                    signal: this.abortController.signal
                });

                if (!response.ok) {
                    throw new Error(`Translation request failed: ${response.statusText}`);
                }

                const data = await response.json();

                if (!data.success) {

                    this.translationState = data.state || 'partial';
                    this.translationError = data.message || 'Translation failed';

                    console.error('[AITranslationManager] Translation error:', {
                        message: data.message,
                        state: data.state,
                        translatedSoFar: translatedCheckpoints.length
                    });

                    if (onProgress) {
                        onProgress(this.translationProgress, this.translationState, this.translationError);
                    }

                    if (translatedCheckpoints.length > 0) {
                        return this.mergeTranslations(checkpoints, translatedCheckpoints);
                    }

                    throw new Error(data.message || 'Translation failed');
                }

                if (data.translatedCheckpoints && Array.isArray(data.translatedCheckpoints)) {
                    translatedCheckpoints.push(...data.translatedCheckpoints);

                    data.translatedCheckpoints.forEach(tc => {
                        this.checkpointTranslationStatus[tc.id] = titlesOnly ? 'title' : 'full';
                    });
                }

                if (data.progress) {
                    this.translationProgress = data.progress;
                    this.translationState = data.progress.state || 'translating';

                    if (onProgress) {
                        onProgress(this.translationProgress, this.translationState);
                    }
                }

                if (data.isComplete) {
                    break;
                }

                batchStart = data.nextBatchStart || (batchStart + batchSize);
            }

            const result = this.mergeTranslations(checkpoints, translatedCheckpoints);

            this.translationCache[cacheKey] = result;

            if (titlesOnly) {
                this.titlesTranslated = true;
            }

            this.translationState = 'ready';
            this.translationError = null;

            if (onProgress) {
                onProgress(this.translationProgress, this.translationState);
            }

            return result;

        } catch (error) {
            this.translationState = 'error';
            this.translationError = error.message;

            if (onProgress) {
                onProgress(this.translationProgress, this.translationState, this.translationError);
            }

            if (translatedCheckpoints.length > 0) {
                return this.mergeTranslations(checkpoints, translatedCheckpoints);
            }

            throw error;
        }
    }

    mergeTranslations(originalCheckpoints, translatedCheckpoints) {
        const translationMap = new Map();

        translatedCheckpoints.forEach(tc => {
            if (tc.id) {
                translationMap.set(tc.id, tc);
            }
        });

        return originalCheckpoints.map(cp => {
            const translated = translationMap.get(cp.id);
            if (translated) {
                return {
                    ...cp,
                    name: translated.name || cp.name,
                    description: translated.description || cp.description,
                    category: translated.category || cp.category,
                    topics: translated.topics || cp.topics || [],
                    translated: true
                };
            }
            return { ...cp, translated: false };
        });
    }

    generateCheckpointHash(checkpoints) {
        const ids = checkpoints.map(cp => cp.id).sort().join(',');
        return this.simpleHash(ids);
    }

    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(36);
    }

    async clearCache() {
        this.translationCache = {};

        const formData = new FormData();
        formData.append('action', 'crownpeak_dqm_clear_translation_cache');

        try {
            const response = await fetch(CrownpeakDQM.ajaxurl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            return data.success;
        } catch (error) {
            console.error('Failed to clear translation cache:', error);
            return false;
        }
    }

    restartTranslation() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.translationState = 'idle';
        this.translationProgress = {
            translatedCheckpoints: 0,
            totalCheckpoints: 0
        };
        this.translationError = null;
        this.checkpointTranslationStatus = {};
        this.titlesTranslated = false;
    }

    isCheckpointFullyTranslated(checkpointId) {
        return this.checkpointTranslationStatus[checkpointId] === 'full';
    }

    areTitlesTranslated() {
        return this.titlesTranslated;
    }

    getState() {
        return {
            state: this.translationState,
            progress: this.translationProgress,
            error: this.translationError
        };
    }
}

window.AITranslationManager = AITranslationManager;
