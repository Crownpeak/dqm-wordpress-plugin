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
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_ai_summary_enabled');
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
                        <?php _e('Enable AI-powered summaries of quality check results using OpenAI.', 'dqm-wordpress-plugin'); ?>
                    </p>

                    <form method="post" action="options.php">
                        <?php settings_fields('crownpeak_dqm_settings'); ?>

                        <div class="form-group">
                            <label class="form-label">
                                <input
                                    type="checkbox"
                                    name="crownpeak_dqm_ai_summary_enabled"
                                    value="1"
                                    <?php checked(get_option('crownpeak_dqm_ai_summary_enabled', '0'), '1'); ?> />
                                <?php _e('Enable AI Summary', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <div class="form-help">
                                <?php _e('Generate AI-powered bullet-point summaries of the most critical quality issues.', 'dqm-wordpress-plugin'); ?>
                            </div>
                        </div>

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
                            <label class="form-label" for="crownpeak_dqm_openai_model">
                                <?php _e('OpenAI Model', 'dqm-wordpress-plugin'); ?>
                            </label>
                            <select
                                id="crownpeak_dqm_openai_model"
                                name="crownpeak_dqm_openai_model"
                                class="form-input">
                                <option value="gpt-4o-mini" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-4o-mini'); ?>>gpt-4o-mini (Recommended)</option>
                                <option value="gpt-4o" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-4o'); ?>>gpt-4o</option>
                                <option value="gpt-4-turbo" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-4-turbo'); ?>>gpt-4-turbo</option>
                                <option value="gpt-3.5-turbo" <?php selected(get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'), 'gpt-3.5-turbo'); ?>>gpt-3.5-turbo</option>
                            </select>
                            <div class="form-help">
                                <?php _e('Choose the OpenAI model for AI summary generation. gpt-4o-mini offers the best balance of cost and quality.', 'dqm-wordpress-plugin'); ?>
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
            'dqm-wordpress-plugin-gutenberg',
            CROWNPEAK_DQM_PLUGIN_URL . 'dqm-wordpress-plugin-gutenberg.js',
            array('wp-element', 'wp-edit-post', 'wp-plugins', 'wp-components', 'wp-data', 'wp-i18n', 'dqm-wordpress-plugin-i18n'),
            CROWNPEAK_DQM_VERSION,
            true
        );
        wp_set_script_translations('dqm-wordpress-plugin-gutenberg', 'dqm-wordpress-plugin', CROWNPEAK_DQM_PLUGIN_PATH . 'languages');
        wp_localize_script('dqm-wordpress-plugin-gutenberg', 'CrownpeakDQM', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'apiKey' => get_option('crownpeak_dqm_api_key', ''),
            'openaiApiKey' => get_option('crownpeak_dqm_openai_api_key', ''),
            'openaiModel' => get_option('crownpeak_dqm_openai_model', 'gpt-4o-mini'),
            'aiSummaryEnabled' => get_option('crownpeak_dqm_ai_summary_enabled', '0'),
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
    
    // Filter failed checkpoints
    $failed_checkpoints = array_filter($checkpoints, function($cp) {
        return isset($cp['failed']) && $cp['failed'] === true;
    });
    
    if (empty($failed_checkpoints)) {
        wp_send_json(['success' => false, 'message' => 'No failed checkpoints to summarize.']);
        wp_die();
    }
    
    // Build prompt for OpenAI
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
    
    $system_prompt = "You are a quality assurance expert analyzing web page quality issues. Provide a concise summary of the most critical issues in 3-7 bullet points. Focus on actionable insights and prioritize by severity.";
    
    $lang_instructions = [
        'de' => 'Provide the summary in German.',
        'es' => 'Provide the summary in Spanish.',
        'en' => 'Provide the summary in English.'
    ];
    
    $lang_instruction = isset($lang_instructions[$target_lang]) ? $lang_instructions[$target_lang] : $lang_instructions['en'];
    
    $user_prompt = sprintf(
        "Analyze these %d failed quality checkpoints and provide a concise summary:\n\n%s\n\n%s Return only the bullet points without introduction.",
        $total_failed,
        $checkpoint_list,
        $lang_instruction
    );
    
    // Call OpenAI API
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
            'temperature' => 0.7,
            'max_tokens' => 500,
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
    
    // Parse bullet points
    $bullets = [];
    $lines = explode("\n", $summary);
    foreach ($lines as $line) {
        $line = trim($line);
        if (empty($line)) continue;
        // Remove common bullet markers
        $line = preg_replace('/^[-*•]\s*/', '', $line);
        if (!empty($line)) {
            $bullets[] = $line;
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
