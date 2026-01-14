<?php

/**
 * Plugin Name: Crownpeak Digital Quality & Accessibility Management
 * Plugin URI: https://www.crownpeak.com/firstspirit/products/digital-accessibility/digital-accessibility-and-quality-management-dqm/
 * Description: A WordPress Plugin for Crownpeak Digital Quality & Accessibility Management.
 * Version: 1.0.0
 * Author: Crownpeak
 * Author URI: https://www.crownpeak.com
 * License: MIT
 * License URI: https://github.com/Crownpeak/dqm-wordpress-plugin/blob/main/LICENSE
 * Text Domain: dqm-wordpress-plugin
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CROWNPEAK_DQM_VERSION', '1.0.0');
define('CROWNPEAK_DQM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('CROWNPEAK_DQM_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('CROWNPEAK_DQM_PLUGIN_BASENAME', plugin_basename(__FILE__));

class DQMWordPressPlugin
{

    public function __construct()
    {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        register_uninstall_hook(__FILE__, array('DQMWordPressPlugin', 'uninstall'));
        add_action('wp_ajax_crownpeak_dqm_scan', 'crownpeak_dqm_scan_handler');
        add_action('wp_ajax_nopriv_crownpeak_dqm_scan', 'crownpeak_dqm_scan_handler');
        add_action('wp_ajax_crownpeakDqmGetCheckpoints', 'crownpeakDqmGetCheckpointsHandler');
        add_action('wp_ajax_crownpeak_dqm_spellcheck', 'crownpeak_dqm_spellcheck_handler');
        add_action('wp_ajax_nopriv_crownpeak_dqm_spellcheck', 'crownpeak_dqm_spellcheck_handler');
        add_action('wp_ajax_crownpeak_dqm_ai_summary', 'crownpeak_dqm_ai_summary_handler');
        add_action('wp_ajax_crownpeak_dqm_translate', 'crownpeak_dqm_translate_handler');
        add_action('wp_ajax_crownpeak_dqm_clear_translation_cache', 'crownpeak_dqm_clear_translation_cache_handler');
    }

    public function init()
    {
        load_plugin_textdomain('dqm-wordpress-plugin', false, dirname(CROWNPEAK_DQM_PLUGIN_BASENAME) . '/languages');

        if (is_admin()) {
            add_action('admin_menu', array($this, 'add_admin_menu'));
            add_action('admin_init', array($this, 'admin_init'));
            add_action('enqueue_block_editor_assets', array($this, 'enqueue_gutenberg_assets'));
            add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_assets'));
        }
    }

    public function activate()
    {
        flush_rewrite_rules();
    }

    public function deactivate()
    {
        flush_rewrite_rules();
    }

    public static function uninstall() {}

      public function add_admin_menu()
    {
        add_options_page(
            __('Crownpeak Digital Quality & Accessibility Management', 'dqm-wordpress-plugin'),
            __('Crownpeak Digital Quality & Accessibility Management', 'dqm-wordpress-plugin'),
            'manage_options',
            'dqm-wordpress-plugin',
            array($this, 'admin_page')
        );
    }

    public function admin_init()
    {
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_api_key');
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_website_id');
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_openai_api_key');
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_openai_model');
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_openai_base_url');
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_reasoning_effort');
    }

    public function admin_page()
    {
?>
        <div class="dqm-admin-page">
            <div class="wrap">
                <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

                <p class="plugin-description" style="font-size:16px;max-width:700px;margin-bottom:24px;color:#444;">
                    <?php _e('A WordPress Plugin for Crownpeak Digital Quality & Accessibility Management.', 'dqm-wordpress-plugin'); ?>
                </p>

                <div class="card">
                    <h3><?php _e('Configuration', 'dqm-wordpress-plugin'); ?></h3>

                    <form method="post" action="options.php">
                        <?php settings_fields('crownpeak_dqm_settings'); ?>
                        
                        <!-- Hidden fields to preserve AI settings when saving CMS configuration -->
                        <input type="hidden" name="crownpeak_dqm_openai_api_key" value="<?php echo esc_attr(get_option('crownpeak_dqm_openai_api_key', '')); ?>" />
                        <input type="hidden" name="crownpeak_dqm_openai_model" value="<?php echo esc_attr(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini')); ?>" />
                        <input type="hidden" name="crownpeak_dqm_openai_base_url" value="<?php echo esc_attr(get_option('crownpeak_dqm_openai_base_url', 'https://api.openai.com/v1')); ?>" />
                        <input type="hidden" name="crownpeak_dqm_reasoning_effort" value="<?php echo esc_attr(get_option('crownpeak_dqm_reasoning_effort', 'medium')); ?>" />

                        <div class="form-group">
                            <label class="form-label" for="crownpeak_dqm_api_key">
                                <?php _e('DQM CMS API Key', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <input
                                type="text"
                                id="crownpeak_dqm_api_key"
                                name="crownpeak_dqm_api_key"
                                value="<?php echo esc_attr(get_option('crownpeak_dqm_api_key', '')); ?>"
                                class="form-input"
                                placeholder="<?php _e('Enter your DQM API key', 'dqm-wordpress-plugin'); ?>" />
                            <div class="form-help">
                                <?php _e('Your Crownpeak DQM CMS API Key. Contact support@crownpeak.com if you do not have this.'); ?>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="crownpeak_dqm_website_id">
                                <?php _e('Website ID', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <input
                                type="text"
                                id="crownpeak_dqm_website_id"
                                name="crownpeak_dqm_website_id"
                                value="<?php echo esc_attr(get_option('crownpeak_dqm_website_id', '')); ?>"
                                class="form-input"
                                placeholder="<?php _e('Enter your Website ID', 'dqm-wordpress-plugin'); ?>" />
                            <div class="form-help">
                                <?php _e('Your DQM Website ID. If you are unsure what this is, please contact support@crownpeak.com.', 'dqm-wordpress-plugin'); ?>
                            </div>
                        </div>

                        <div class="submit">
                            <?php submit_button(__('Save Configuration', 'dqm-wordpress-plugin'), 'primary', 'submit', false); ?>
                        </div>
                    </form>
                </div>

                <div class="card" style="margin-top: 24px;">
                    <h3><?php _e('AI Assistant Configuration', 'dqm-wordpress-plugin'); ?></h3>
                    <p style="color:#666;margin-bottom:16px;">
                        <?php _e('Configure OpenAI API settings. AI features (translation, summary) can be toggled on/off in the Gutenberg editor.', 'dqm-wordpress-plugin'); ?>
                    </p>

                    <form method="post" action="options.php">
                        <?php settings_fields('crownpeak_dqm_settings'); ?>
                        
                        <!-- Hidden fields to preserve CMS configuration when saving AI settings -->
                        <input type="hidden" name="crownpeak_dqm_api_key" value="<?php echo esc_attr(get_option('crownpeak_dqm_api_key', '')); ?>" />
                        <input type="hidden" name="crownpeak_dqm_website_id" value="<?php echo esc_attr(get_option('crownpeak_dqm_website_id', '')); ?>" />

                        <div class="form-group">
                            <label class="form-label" for="crownpeak_dqm_openai_api_key">
                                <?php _e('OpenAI API Key', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <input
                                type="password"
                                id="crownpeak_dqm_openai_api_key"
                                name="crownpeak_dqm_openai_api_key"
                                value="<?php echo esc_attr(get_option('crownpeak_dqm_openai_api_key', '')); ?>"
                                class="form-input"
                                placeholder="<?php _e('Enter your OpenAI API key (sk-...)', 'dqm-wordpress-plugin'); ?>" />
                            <div class="form-help">
                                <?php _e('Your OpenAI API key is required for AI features. Get one at https://platform.openai.com/api-keys', 'dqm-wordpress-plugin'); ?>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="crownpeak_dqm_openai_base_url">
                                <?php _e('OpenAI Base URL', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <input
                                type="text"
                                id="crownpeak_dqm_openai_base_url"
                                name="crownpeak_dqm_openai_base_url"
                                value="<?php echo esc_attr(get_option('crownpeak_dqm_openai_base_url', 'https://api.openai.com/v1')); ?>"
                                class="form-input"
                                placeholder="https://api.openai.com/v1" />
                            <div class="form-help">
                                <?php _e('OpenAI-compatible API base URL. Use default for OpenAI or custom for proxies.', 'dqm-wordpress-plugin'); ?>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="crownpeak_dqm_openai_model">
                                <?php _e('OpenAI Model', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <select
                                id="crownpeak_dqm_openai_model"
                                name="crownpeak_dqm_openai_model"
                                class="form-input"
                                onchange="document.getElementById('reasoning_effort_section').style.display = this.value.startsWith('gpt-5') ? 'block' : 'none';">
                                <option value="gpt-5.2" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-5.2'); ?>>gpt-5.2 🆕</option>
                                <option value="gpt-4o-mini" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-4o-mini'); ?>>gpt-4o-mini (Recommended)</option>
                                <option value="gpt-4o" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-4o'); ?>>gpt-4o</option>
                                <option value="gpt-4.1-mini" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-4.1-mini'); ?>>gpt-4.1-mini</option>
                                <option value="gpt-4.1" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-4.1'); ?>>gpt-4.1</option>
                            </select>
                            <div class="form-help">
                                <?php _e('Choose the OpenAI model for AI features. gpt-4o-mini offers the best balance of cost and quality.', 'dqm-wordpress-plugin'); ?>
                            </div>
                        </div>

                        <div class="form-group" id="reasoning_effort_section" style="display: <?php echo (strpos(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-5') === 0) ? 'block' : 'none'; ?>;">
                            <label class="form-label" for="crownpeak_dqm_reasoning_effort">
                                <?php _e('🧠 Reasoning Effort (GPT-5 only)', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <select
                                id="crownpeak_dqm_reasoning_effort"
                                name="crownpeak_dqm_reasoning_effort"
                                class="form-input">
                                <option value="low" <?php selected(get_option('crownpeak_dqm_reasoning_effort', 'medium'), 'low'); ?>>Fast - Quick responses, lower cost</option>
                                <option value="medium" <?php selected(get_option('crownpeak_dqm_reasoning_effort', 'medium'), 'medium'); ?>>Balanced - Good quality and speed</option>
                                <option value="high" <?php selected(get_option('crownpeak_dqm_reasoning_effort', 'medium'), 'high'); ?>>Thorough - Best quality, slower</option>
                            </select>
                            <div class="form-help">
                                <?php _e('Controls how thoroughly GPT-5 analyzes content. Only applies to GPT-5 models.', 'dqm-wordpress-plugin'); ?>
                            </div>
                        </div>

                        <div class="submit">
                            <?php submit_button(__('Save AI Settings', 'dqm-wordpress-plugin'), 'primary', 'submit', false); ?>
                        </div>
                    </form>
                </div>
            </div>
        </div>
<?php
    }

    public function enqueue_gutenberg_assets()
    {
        wp_enqueue_script(
            'dqm-wordpress-plugin-i18n',
            CROWNPEAK_DQM_PLUGIN_URL . 'dqm-wordpress-plugin-i18n.js',
            array(),
            CROWNPEAK_DQM_VERSION,
            true
        );
        
        wp_enqueue_script(
            'dqm-ai-context',
            CROWNPEAK_DQM_PLUGIN_URL . 'ai-context.js',
            array(),
            CROWNPEAK_DQM_VERSION,
            true
        );
        
        wp_enqueue_script(
            'dqm-ai-helpers',
            CROWNPEAK_DQM_PLUGIN_URL . 'ai-helpers.js',
            array('dqm-ai-context'),
            CROWNPEAK_DQM_VERSION,
            true
        );
        
        wp_enqueue_script(
            'dqm-ai-translation-manager',
            CROWNPEAK_DQM_PLUGIN_URL . 'ai-translation-manager.js',
            array('dqm-ai-context', 'dqm-ai-helpers'),
            CROWNPEAK_DQM_VERSION,
            true
        );
        
        wp_enqueue_script(
            'dqm-wordpress-plugin-gutenberg',
            CROWNPEAK_DQM_PLUGIN_URL . 'dqm-wordpress-plugin-gutenberg.js',
            array('wp-element', 'wp-edit-post', 'wp-plugins', 'wp-components', 'wp-data', 'wp-i18n', 'dqm-wordpress-plugin-i18n', 'dqm-ai-context', 'dqm-ai-helpers', 'dqm-ai-translation-manager'),
            CROWNPEAK_DQM_VERSION,
            true
        );
        wp_set_script_translations('dqm-wordpress-plugin-gutenberg', 'dqm-wordpress-plugin', CROWNPEAK_DQM_PLUGIN_PATH . 'languages');
        wp_localize_script('dqm-wordpress-plugin-gutenberg', 'CrownpeakDQM', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'pluginUrl' => plugin_dir_url(__FILE__),
            'apiKey' => get_option('crownpeak_dqm_api_key', ''),
            'openaiApiKey' => get_option('crownpeak_dqm_openai_api_key', ''),
            'openaiModel' => get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'),
            'openaiBaseUrl' => get_option('crownpeak_dqm_openai_base_url', 'https://api.openai.com/v1'),
            'reasoningEffort' => get_option('crownpeak_dqm_reasoning_effort', 'medium'),
            'websiteId' => get_option('crownpeak_dqm_website_id', ''),
        ));
        wp_enqueue_style(
            'font-awesome',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
            array(),
            '6.5.0'
        );
        wp_enqueue_style(
            'dqm-wordpress-plugin-gutenberg-css',
            CROWNPEAK_DQM_PLUGIN_URL . 'dqm-wordpress-plugin-gutenberg.css',
            array(),
            CROWNPEAK_DQM_VERSION
        );
        wp_enqueue_style(
            'dqm-ai-features-css',
            CROWNPEAK_DQM_PLUGIN_URL . 'ai-features.css',
            array(),
            CROWNPEAK_DQM_VERSION
        );
    }

    public function enqueue_admin_assets($hook)
    {
        if ($hook !== 'settings_page_dqm-wordpress-plugin') {
            return;
        }
        wp_enqueue_style(
            'crownpeak-dqm-admin-css',
            CROWNPEAK_DQM_PLUGIN_URL . 'dqm-wordpress-plugin-gutenberg.css',
            array(),
            CROWNPEAK_DQM_VERSION
        );
    }
}

new DQMWordPressPlugin();

function crownpeak_dqm_insights()
{
    return DQMWordPressPlugin::class;
}

function crownpeak_dqm_scan_handler()
{

    $api_key = get_option('crownpeak_dqm_api_key', '');
    $website_id = get_option('crownpeak_dqm_website_id', '');
    $content = isset($_POST['content']) ? $_POST['content'] : '';
    $asset_id = isset($_POST['assetId']) ? sanitize_text_field($_POST['assetId']) : '';
    $method = isset($_POST['method']) ? sanitize_text_field(strtoupper($_POST['method'])) : 'POST';

    if (empty($api_key) || !is_string($api_key) || strlen($api_key) < 10) {
        wp_send_json(['success' => false, 'message' => 'Invalid API key.']);
        wp_die();
    }

    if (empty($website_id) || !is_string($website_id) || strlen($website_id) < 3) {
        wp_send_json(['success' => false, 'message' => 'Invalid Website ID.']);
        wp_die();
    }

    if (empty($content) || !is_string($content) || strlen($content) < 10) {
        wp_send_json(['success' => false, 'message' => 'No valid content provided.']);
        wp_die();
    }
    
    if (!empty($asset_id) && !preg_match('/^[a-zA-Z0-9\-_]+$/', $asset_id)) {
        wp_send_json(['success' => false, 'message' => 'Invalid assetId format.']);
        wp_die();
    }
    
    $allowed_methods = ['POST', 'PUT'];
    if (!in_array($method, $allowed_methods, true)) {
        wp_send_json(['success' => false, 'message' => 'Invalid method.']);
        wp_die();
    }

    $response = null;
    $status_code = null;
    if ($method === 'PUT' && !empty($asset_id)) {
        $endpoint = 'https://api.crownpeak.net/dqm-cms/v1/assets/' . $asset_id . '?apiKey=' . $api_key;
        $args = [
            'method' => 'PUT',
            'headers' => [
                'Content-Type' => 'application/x-www-form-urlencoded',
                'x-api-key' => $api_key,
            ],
            'body' => http_build_query([
                'content' => $content,
                'contentType' => 'text/html; charset=UTF-8',
                'websiteId' => $website_id,
            ]),
            'timeout' => 30,
        ];
        $response = wp_remote_request($endpoint, $args);
        $status_code = wp_remote_retrieve_response_code($response);
        if ($status_code == 404) {
            $endpoint = 'https://api.crownpeak.net/dqm-cms/v1/assets?apiKey=' . $api_key;
            $args = [
                'headers' => [
                    'Content-Type' => 'application/x-www-form-urlencoded',
                    'x-api-key' => $api_key,
                ],
                'body' => http_build_query([
                    'content' => $content,
                    'contentType' => 'text/html; charset=UTF-8',
                    'websiteId' => $website_id,
                ]),
                'timeout' => 30,
            ];
            $response = wp_remote_post($endpoint, $args);
        }
    } else {
        $endpoint = 'https://api.crownpeak.net/dqm-cms/v1/assets?apiKey=' . $api_key;
        $args = [
            'headers' => [
                'Content-Type' => 'application/x-www-form-urlencoded',
                'x-api-key' => $api_key,
            ],
            'body' => http_build_query([
                'content' => $content,
                'contentType' => 'text/html; charset=UTF-8',
                'websiteId' => $website_id,
            ]),
            'timeout' => 30,
        ];
        $response = wp_remote_post($endpoint, $args);
    }
    if (is_wp_error($response)) {
        wp_send_json(['success' => false, 'message' => $response->get_error_message()]);
        wp_die();
    }
    $status_code = wp_remote_retrieve_response_code($response);
    $response_headers = wp_remote_retrieve_headers($response);
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    if (isset($data['assetId']) || isset($data['id'])) {
        $asset_id = isset($data['assetId']) ? $data['assetId'] : $data['id'];
        wp_send_json(['success' => true, 'assetId' => $asset_id]);
    } else {
        wp_send_json(['success' => false, 'message' => $body]);
    }
    wp_die();
}

function crownpeakDqmGetCheckpointsHandler()
{

    $api_key = get_option('crownpeak_dqm_api_key', '');

    if (empty($api_key) || !is_string($api_key) || strlen($api_key) < 10) {
        wp_send_json(['success' => false, 'message' => 'API key is missing or invalid.']);
        wp_die();
    }
    $endpoint = 'https://api.crownpeak.net/dqm-cms/v1/checkpoints?apiKey=' . $api_key;
    $args = [
        'headers' => [
            'Content-Type' => 'application/json',
            'x-api-key' => $api_key,
        ],
        'timeout' => 30,
    ];
    $response = wp_remote_get($endpoint, $args);
    if (is_wp_error($response)) {
        wp_send_json(['success' => false, 'message' => $response->get_error_message()]);
        wp_die();
    }
    $body = wp_remote_retrieve_body($response);
    if (empty($body)) {
        wp_send_json(['success' => false, 'message' => 'Empty response from API.']);
        wp_die();
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        wp_send_json(['success' => false, 'message' => 'Invalid API response format.']);
        wp_die();
    }
    $checkpoints = [];
    foreach ($data as $cp) {
        if (!is_array($cp)) {
            wp_send_json(['success' => false, 'message' => 'Malformed checkpoint data.']);
            wp_die();
        }
        $checkpoints[] = $cp;
    }
    wp_send_json(['success' => true, 'checkpoints' => $checkpoints]);
    wp_die();
}

function crownpeak_dqm_spellcheck_handler()
{

    $api_key = get_option('crownpeak_dqm_api_key', '');
    $asset_id = isset($_POST['assetId']) ? sanitize_text_field($_POST['assetId']) : '';
    
    if (empty($api_key) || !is_string($api_key) || strlen($api_key) < 10) {
        wp_send_json(['success' => false, 'message' => 'Invalid API key.']);
        wp_die();
    }
    
    if (empty($asset_id) || !preg_match('/^[a-zA-Z0-9\-_]+$/', $asset_id)) {
        wp_send_json(['success' => false, 'message' => 'No valid assetId provided.']);
        wp_die();
    }
    $endpoint = 'https://api.crownpeak.net/dqm-cms/v1/assets/' . esc_url_raw($asset_id) . '/spellcheck?apiKey=' . $api_key;
    $args = [
        'headers' => [
            'x-api-key' => $api_key,
        ],
        'timeout' => 30,
    ];
    $response = wp_remote_get($endpoint, $args);
    if (is_wp_error($response)) {
        wp_send_json(['success' => false, 'message' => $response->get_error_message()]);
        wp_die();
    }
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    wp_send_json(['success' => true, 'data' => $data]);
    wp_die();
}

function crownpeak_dqm_ai_summary_handler()
{
    $openai_api_key = get_option('crownpeak_dqm_openai_api_key', '');
    $openai_model = get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini');
    $asset_id = isset($_POST['assetId']) ? sanitize_text_field($_POST['assetId']) : '';
    $checkpoints_json = isset($_POST['checkpoints']) ? $_POST['checkpoints'] : '';
    $target_lang = isset($_POST['targetLang']) ? sanitize_text_field($_POST['targetLang']) : 'en';
    
    if (empty($openai_api_key) || !is_string($openai_api_key) || strlen($openai_api_key) < 10) {
        wp_send_json(['success' => false, 'message' => 'OpenAI API key is missing or invalid.']);
        wp_die();
    }
    
    if (empty($asset_id) || !preg_match('/^[a-zA-Z0-9\-_]+$/', $asset_id)) {
        wp_send_json(['success' => false, 'message' => 'No valid assetId provided.']);
        wp_die();
    }
    
    if (empty($checkpoints_json)) {
        wp_send_json(['success' => false, 'message' => 'No checkpoints data provided.']);
        wp_die();
    }
    
    $checkpoints = json_decode(stripslashes($checkpoints_json), true);
    if (!is_array($checkpoints)) {
        wp_send_json(['success' => false, 'message' => 'Invalid checkpoints data format.']);
        wp_die();
    }
    
    $failed_checkpoints = array_filter($checkpoints, function($cp) {
        return isset($cp['failed']) && $cp['failed'] === true;
    });
    
    if (empty($failed_checkpoints)) {
        wp_send_json(['success' => false, 'message' => 'No failed checkpoints to summarize.']);
        wp_die();
    }
    
    $checkpoint_details = [];
    foreach ($failed_checkpoints as $cp) {
        $checkpoint_details[] = sprintf(
            "- %s: %s",
            $cp['name'] ?? 'Unknown',
            $cp['description'] ?? 'No description'
        );
    }
    
    $checkpoint_list = implode("\n", $checkpoint_details);
    $total_failed = count($failed_checkpoints);
    
    $language_names = [
        'en' => 'English',
        'de' => 'German (Deutsch)',
        'es' => 'Spanish (Español)'
    ];
    
    $language_name = isset($language_names[$target_lang]) ? $language_names[$target_lang] : $language_names['en'];
    
    $language_specific_instruction = '';
    if ($target_lang === 'de') {
        $language_specific_instruction = ' Schreiben Sie auf Deutsch; vermeiden Sie Anglizismen, wenn möglich.';
    } elseif ($target_lang === 'es') {
        $language_specific_instruction = ' Escribe en español; evita anglicismos cuando sea posible.';
    }
    
    $system_prompt = sprintf(
        'You are an assistant that summarizes a website quality/accessibility report for developers. Write in %s (%s).%s Return 5–7 concise bullet points with the most important findings and next actions. Each bullet must be <= 140 characters. No prefixes like "Next step:" / "Nächster Schritt:". Base the summary on the checkpoint texts (name/description). Prefer actionable wording and group similar issues. Do not hallucinate; only use the provided data. Return JSON only.',
        $language_name,
        $target_lang,
        $language_specific_instruction
    );
    
    $payload = [
        'failedCheckpoints' => array_map(function($cp) {
            return [
                'id' => $cp['id'] ?? '',
                'name' => $cp['name'] ?? '',
                'description' => $cp['description'] ?? ''
            ];
        }, array_values($failed_checkpoints)),
        'siteName' => 'WordPress Site',
        'failedCount' => $total_failed
    ];
    
    $schema = json_encode([
        'type' => 'object',
        'properties' => [
            'bullets' => [
                'type' => 'array',
                'items' => ['type' => 'string']
            ]
        ],
        'required' => ['bullets'],
        'additionalProperties' => false
    ]);
    
    $user_prompt = sprintf(
        "Payload: %s\n\nSchema (JSON): %s",
        json_encode($payload),
        $schema
    );
    
    $endpoint = 'https://api.openai.com/v1/chat/completions';
    $args = [
        'method' => 'POST',
        'headers' => [
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $openai_api_key,
        ],
        'body' => json_encode([
            'model' => $openai_model,
            'messages' => [
                ['role' => 'system', 'content' => $system_prompt],
                ['role' => 'user', 'content' => $user_prompt]
            ],
            'response_format' => ['type' => 'json_object'],
            'temperature' => 0.3,
            'max_completion_tokens' => $target_lang === 'en' ? 384 : 512,
        ]),
        'timeout' => 60,
    ];
    
    $response = wp_remote_post($endpoint, $args);
    
    if (is_wp_error($response)) {
        wp_send_json(['success' => false, 'message' => 'OpenAI API request failed: ' . $response->get_error_message()]);
        wp_die();
    }
    
    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if ($status_code !== 200) {
        $error_message = isset($data['error']['message']) ? $data['error']['message'] : 'Unknown error';
        wp_send_json(['success' => false, 'message' => 'OpenAI API error: ' . $error_message]);
        wp_die();
    }
    
    if (!isset($data['choices'][0]['message']['content'])) {
        wp_send_json(['success' => false, 'message' => 'Invalid response from OpenAI API.']);
        wp_die();
    }
    
    $summary = trim($data['choices'][0]['message']['content']);
    
    $json_data = json_decode($summary, true);
    if (json_last_error() === JSON_ERROR_NONE && isset($json_data['bullets']) && is_array($json_data['bullets'])) {
        $bullets = array_map('trim', $json_data['bullets']);
        $bullets = array_filter($bullets, function($b) {
            return !empty($b);
        });
        $bullets = array_values($bullets);
    } else {
        $bullets = [];
        $lines = explode("\n", $summary);
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line)) continue;
            $line = preg_replace('/^[-*•]\s*/', '', $line);
            $line = preg_replace('/^\d+\.\s*/', '', $line);
            if (!empty($line)) {
                $bullets[] = $line;
            }
        }
    }
    
    $stats = [
        'totalCheckpoints' => count($checkpoints),
        'failedCheckpoints' => $total_failed,
        'model' => $openai_model,
    ];
    
    wp_send_json([
        'success' => true,
        'bullets' => $bullets,
        'stats' => $stats,
        'cached' => false
    ]);
    wp_die();
}

function crownpeak_dqm_translate_handler()
{
    $openai_api_key = get_option('crownpeak_dqm_openai_api_key', '');
    $openai_model = get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini');
    $openai_base_url = get_option('crownpeak_dqm_openai_base_url', 'https://api.openai.com/v1');
    $translation_mode = get_option('crownpeak_dqm_translation_mode', 'fast');
    $reasoning_effort = get_option('crownpeak_dqm_reasoning_effort', 'medium');
    
    $checkpoints_json = isset($_POST['checkpoints']) ? $_POST['checkpoints'] : '';
    $target_lang = isset($_POST['targetLang']) ? sanitize_text_field($_POST['targetLang']) : 'en';
    $batch_start = isset($_POST['batchStart']) ? intval($_POST['batchStart']) : 0;
    $batch_size = isset($_POST['batchSize']) ? intval($_POST['batchSize']) : 10;
    $titles_only = isset($_POST['titlesOnly']) && $_POST['titlesOnly'] === '1';
    
    if (empty($openai_api_key) || !is_string($openai_api_key) || strlen($openai_api_key) < 10) {
        wp_send_json(['success' => false, 'message' => 'OpenAI API key is missing or invalid.', 'state' => 'error']);
        wp_die();
    }
    
    if (empty($checkpoints_json)) {
        wp_send_json(['success' => false, 'message' => 'No checkpoints data provided.', 'state' => 'error']);
        wp_die();
    }
    
    $checkpoints = json_decode(stripslashes($checkpoints_json), true);
    if (!is_array($checkpoints)) {
        wp_send_json(['success' => false, 'message' => 'Invalid checkpoints data format.', 'state' => 'error']);
        wp_die();
    }
    
    $batch_checkpoints = array_slice($checkpoints, $batch_start, $batch_size);
    $total_checkpoints = count($checkpoints);
    
    if (empty($batch_checkpoints)) {
        wp_send_json([
            'success' => true,
            'translatedCheckpoints' => [],
            'progress' => [
                'translatedCheckpoints' => $batch_start,
                'totalCheckpoints' => $total_checkpoints,
                'state' => 'ready'
            ]
        ]);
        wp_die();
    }
    
    $language_names = [
        'en' => 'English',
        'de' => 'German (Deutsch)',
        'es' => 'Spanish (Español)',
        'fr' => 'French (Français)',
        'it' => 'Italian (Italiano)',
        'pt' => 'Portuguese (Português)',
        'nl' => 'Dutch (Nederlands)',
        'ja' => 'Japanese (日本語)',
        'zh' => 'Chinese (中文)',
    ];
    
    $language_name = isset($language_names[$target_lang]) ? $language_names[$target_lang] : 'English';
    
    if ($titles_only) {
        $system_prompt = sprintf(
            'You are a fast translator. Translate ONLY name, category, and topics to %s (%s). Skip description field. Keep translations concise and natural. Return JSON only.',
            $language_name,
            $target_lang
        );
    } elseif ($translation_mode === 'full') {
        $system_prompt = sprintf(
            'You are a professional translator. Translate ALL text fields (name, description, category, topics) to %s (%s). CRITICAL: ALL text fields MUST be translated to the target language. Maintain technical accuracy, preserve HTML tags if present, and ensure translations are natural and idiomatic. Return JSON only with translated fields.',
            $language_name,
            $target_lang
        );
    } else {
        $system_prompt = sprintf(
            'You are a fast translator. Quickly translate all text fields (name, description, category, topics) to %s (%s). Keep it concise. CRITICAL: ALL fields must be in the target language. Return JSON only.',
            $language_name,
            $target_lang
        );
    }
    
    $checkpoint_data = [];
    foreach ($batch_checkpoints as $idx => $cp) {
        $item = [
            'id' => $cp['id'] ?? $idx,
            'name' => $cp['name'] ?? '',
            'category' => $cp['category'] ?? '',
            'topics' => $cp['topics'] ?? [],
            'failed' => $cp['failed'] ?? false
        ];
        
        if (!$titles_only) {
            $item['description'] = $cp['description'] ?? '';
        }
        
        $checkpoint_data[] = $item;
    }
    
    if ($titles_only) {
        $user_prompt = sprintf(
            "Translate checkpoint names, categories, and topics to %s (skip description):\n%s\n\nReturn JSON array with same structure but with 'name', 'category', and 'topics' translated to %s. Leave 'description' empty or omit it. Preserve 'id' and 'failed' unchanged.",
            $language_name,
            json_encode($checkpoint_data, JSON_PRETTY_PRINT),
            $language_name
        );
    } else {
        $user_prompt = sprintf(
            "Translate these checkpoints to %s:\n%s\n\nReturn JSON array with same structure but with ALL text fields ('name', 'description', 'category', 'topics') fully translated to %s. Preserve the 'id' and 'failed' fields unchanged. Each checkpoint must have translated name, description, category, and topics array.",
            $language_name,
            json_encode($checkpoint_data, JSON_PRETTY_PRINT),
            $language_name
        );
    }
    
    $endpoint = rtrim($openai_base_url, '/') . '/chat/completions';
    
    $messages = [
        ['role' => 'system', 'content' => $system_prompt],
        ['role' => 'user', 'content' => $user_prompt]
    ];
    
    $body_data = [
        'model' => $openai_model,
        'messages' => $messages,
        'temperature' => $titles_only ? 0.1 : ($translation_mode === 'full' ? 0.2 : 0.1),
        'max_completion_tokens' => $titles_only ? 1024 : ($translation_mode === 'full' ? 4096 : 2048),
    ];
    
    if (strpos($openai_model, 'gpt-5') === 0) {
        $body_data['reasoning_effort'] = $reasoning_effort;
    }
    
    $args = [
        'method' => 'POST',
        'headers' => [
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $openai_api_key,
        ],
        'body' => json_encode($body_data),
        'timeout' => 90,
    ];
    
    $response = wp_remote_post($endpoint, $args);
    
    if (is_wp_error($response)) {
        wp_send_json([
            'success' => false,
            'message' => 'Translation API request failed: ' . $response->get_error_message(),
            'state' => 'error',
            'progress' => [
                'translatedCheckpoints' => $batch_start,
                'totalCheckpoints' => $total_checkpoints,
                'state' => 'error'
            ]
        ]);
        wp_die();
    }
    
    $status_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);
    
    if ($status_code !== 200) {
        $error_message = isset($data['error']['message']) ? $data['error']['message'] : 'Unknown error';
        
        wp_send_json([
            'success' => false,
            'message' => 'Translation API error: ' . $error_message,
            'state' => 'partial',
            'translatedCheckpoints' => [],
            'progress' => [
                'translatedCheckpoints' => $batch_start,
                'totalCheckpoints' => $total_checkpoints,
                'state' => 'partial'
            ]
        ]);
        wp_die();
    }
    
    if (!isset($data['choices'][0]['message']['content'])) {
        error_log('DQM Translation: Invalid API response structure');
        wp_send_json([
            'success' => false,
            'message' => 'Invalid response from translation API.',
            'state' => 'error',
            'progress' => [
                'translatedCheckpoints' => $batch_start,
                'totalCheckpoints' => $total_checkpoints,
                'state' => 'error'
            ]
        ]);
        wp_die();
    }
    
    $finish_reason = isset($data['choices'][0]['finish_reason']) ? $data['choices'][0]['finish_reason'] : 'unknown';
    error_log('DQM Translation: Finish reason: ' . $finish_reason);
    
    if ($finish_reason === 'length') {
        error_log('DQM Translation: WARNING - Response truncated due to token limit!');
    }
    
    $translation_text = trim($data['choices'][0]['message']['content']);
    
    error_log('DQM Translation: Raw response length: ' . strlen($translation_text) . ' chars');
    error_log('DQM Translation: First 200 chars: ' . substr($translation_text, 0, 200));
    error_log('DQM Translation: Last 200 chars: ' . substr($translation_text, -200));
    
    if (preg_match('/```json\\s*(.+?)\\s*```/s', $translation_text, $matches)) {
        $translation_text = $matches[1];
        error_log('DQM Translation: Extracted from ```json block (length: ' . strlen($translation_text) . ')');
    } elseif (preg_match('/```\\s*(.+?)\\s*```/s', $translation_text, $matches)) {
        $translation_text = $matches[1];
        error_log('DQM Translation: Extracted from ``` block (length: ' . strlen($translation_text) . ')');
    } else {
        if (preg_match('/\\[.+\\]/s', $translation_text, $matches)) {
            $translation_text = $matches[0];
            error_log('DQM Translation: Extracted JSON array directly');
        }
    }
    
    $translation_text = trim($translation_text);
    
    $translated_data = json_decode($translation_text, true);
    
    if (json_last_error() !== JSON_ERROR_NONE || !is_array($translated_data)) {
        $error_msg = json_last_error_msg();
        error_log('DQM Translation: JSON parse error: ' . $error_msg);
        error_log('DQM Translation: Text length: ' . strlen($translation_text));
        error_log('DQM Translation: First 500 chars: ' . substr($translation_text, 0, 500));
        error_log('DQM Translation: Last 500 chars: ' . substr($translation_text, -500));
        
        $is_truncated = !preg_match('/\\]\\s*$/', $translation_text);
        
        wp_send_json([
            'success' => false,
            'message' => 'Failed to parse translation response. JSON Error: ' . $error_msg . ($is_truncated ? ' (Response appears truncated)' : ''),
            'state' => 'partial',
            'translatedCheckpoints' => [],
            'debug' => [
                'responseLength' => strlen($translation_text),
                'isTruncated' => $is_truncated,
                'endsCorrectly' => preg_match('/\\]\\s*$/', $translation_text) ? 'yes' : 'no',
                'startsCorrectly' => preg_match('/^\\s*\\[/', $translation_text) ? 'yes' : 'no',
            ],
            'progress' => [
                'translatedCheckpoints' => $batch_start,
                'totalCheckpoints' => $total_checkpoints,
                'state' => 'partial'
            ]
        ]);
        wp_die();
    }
    
    $new_batch_start = $batch_start + count($batch_checkpoints);
    $is_complete = $new_batch_start >= $total_checkpoints;
    
    wp_send_json([
        'success' => true,
        'translatedCheckpoints' => $translated_data,
        'progress' => [
            'translatedCheckpoints' => $new_batch_start,
            'totalCheckpoints' => $total_checkpoints,
            'state' => $is_complete ? 'ready' : 'translating'
        ],
        'isComplete' => $is_complete,
        'nextBatchStart' => $is_complete ? null : $new_batch_start
    ]);
    wp_die();
}

function crownpeak_dqm_clear_translation_cache_handler()
{
    global $wpdb;
    
    $transient_prefix = $wpdb->prefix . 'transient_crownpeak_dqm_translation_';
    $wpdb->query(
        $wpdb->prepare(
            "DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s",
            $wpdb->esc_like($transient_prefix) . '%',
            $wpdb->esc_like('_' . $transient_prefix) . '%'
        )
    );
    
    wp_send_json([
        'success' => true,
        'message' => 'Translation cache cleared successfully.'
    ]);
    wp_die();
}

