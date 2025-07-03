<?php

/**
 * Plugin Name: Crownpeak Digital Quality & Accessibility Management
 * Plugin URI: https://www.crownpeak.com/firstspirit/products/digital-accessibility/digital-accessibility-and-quality-management-dqm/
 * Description: A WordPress Plugin for Crownpeak Digital Quality & Accessibility Management.
 * Version: 1.0.0
 * Author: Crownpeak
 * Author URI: https://example.com
 * License: GPL v2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: crownpeak-dqm-insights
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}

define('CROWNPEAK_DQM_VERSION', '1.0.0');
define('CROWNPEAK_DQM_PLUGIN_URL', plugin_dir_url(__FILE__));
define('CROWNPEAK_DQM_PLUGIN_PATH', plugin_dir_path(__FILE__));
define('CROWNPEAK_DQM_PLUGIN_BASENAME', plugin_basename(__FILE__));

/**
 * Main Crownpeak DQM Class
 */
class CrownpeakDQMInsights
{

    public function __construct()
    {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
        register_uninstall_hook(__FILE__, array('CrownpeakDQMInsights', 'uninstall'));
        add_action('wp_ajax_crownpeak_dqm_scan', 'crownpeak_dqm_scan_handler');
        add_action('wp_ajax_nopriv_crownpeak_dqm_scan', 'crownpeak_dqm_scan_handler');
        add_action('wp_ajax_crownpeak_dqm_get_checkpoints', 'crownpeak_dqm_get_checkpoints_handler');
        add_action('wp_ajax_crownpeak_dqm_spellcheck', 'crownpeak_dqm_spellcheck_handler');
        add_action('wp_ajax_nopriv_crownpeak_dqm_spellcheck', 'crownpeak_dqm_spellcheck_handler');
    }

    public function init()
    {
        load_plugin_textdomain('crownpeak-dqm-insights', false, dirname(CROWNPEAK_DQM_PLUGIN_BASENAME) . '/languages');

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

    /**
     * Add admin menu
     */
    public function add_admin_menu()
    {
        add_options_page(
            __('Crownpeak Digital Quality & Accessibility Management', 'crownpeak-dqm-insights'),
            __('Crownpeak Digital Quality & Accessibility Managemet', 'crownpeak-dqm-insights'),
            'manage_options',
            'crownpeak-dqm-insights',
            array($this, 'admin_page')
        );
    }

    /**
     * Admin initialization
     */
    public function admin_init()
    {
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_api_key');
        register_setting('crownpeak_dqm_settings', 'crownpeak_dqm_website_id');
    }

    public function admin_page()
    {
?>
        <div class="dqm-admin-page">
            <div class="wrap">
                <h1><?php echo esc_html(get_admin_page_title()); ?></h1>

                <p class="plugin-description" style="font-size:16px;max-width:700px;margin-bottom:24px;color:#444;">
                    <?php _e('A WordPress Plugin for Crownpeak Digital Quality & Accessibility Management.', 'crownpeak-dqm-insights'); ?>
                </p>

                <div class="card">
                    <h3><?php _e('Configuration', 'crownpeak-dqm-insights'); ?></h3>

                    <form method="post" action="options.php">
                        <?php settings_fields('crownpeak_dqm_settings'); ?>

                        <div class="form-group">
                            <label class="form-label" for="crownpeak_dqm_api_key">
                                <?php _e('DQM CMS API Key', 'crownpeak-dqm-insights'); ?>
                            </label>
                            <input
                                type="text"
                                id="crownpeak_dqm_api_key"
                                name="crownpeak_dqm_api_key"
                                value="<?php echo esc_attr(get_option('crownpeak_dqm_api_key', '')); ?>"
                                class="form-input"
                                placeholder="<?php _e('Enter your DQM API key', 'crownpeak-dqm-insights'); ?>" />
                            <div class="form-help">
                                <?php _e('Your Crownpeak DQM CMS API Key. Contact support@crownpeak.com if you do not have this.'); ?>
                            </div>
                        </div>

                        <div class="form-group">
                            <label class="form-label" for="crownpeak_dqm_website_id">
                                <?php _e('Website ID', 'crownpeak-dqm-insights'); ?>
                            </label>
                            <input
                                type="text"
                                id="crownpeak_dqm_website_id"
                                name="crownpeak_dqm_website_id"
                                value="<?php echo esc_attr(get_option('crownpeak_dqm_website_id', '')); ?>"
                                class="form-input"
                                placeholder="<?php _e('Enter your Website ID', 'crownpeak-dqm-insights'); ?>" />
                            <div class="form-help">
                                <?php _e('Your DQM Website ID. If you are unsure what this is, please contact support@crownpeak.com.', 'crownpeak-dqm-insights'); ?>
                            </div>
                        </div>

                        <div class="submit">
                            <?php submit_button(__('Save Configuration', 'crownpeak-dqm-insights'), 'primary', 'submit', false); ?>
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
            'crownpeak-dqm-gutenberg',
            CROWNPEAK_DQM_PLUGIN_URL . 'src/crownpeak-dqm-gutenberg.js',
            array('wp-element', 'wp-edit-post', 'wp-plugins', 'wp-components', 'wp-data', 'wp-i18n'),
            CROWNPEAK_DQM_VERSION,
            true
        );
        wp_set_script_translations('crownpeak-dqm-gutenberg', 'crownpeak-dqm-insights', CROWNPEAK_DQM_PLUGIN_PATH . 'languages');
        wp_localize_script('crownpeak-dqm-gutenberg', 'CrownpeakDQM', array(
            'ajaxurl' => admin_url('admin-ajax.php'),
            'apiKey' => get_option('crownpeak_dqm_api_key', ''),
            'websiteId' => get_option('crownpeak_dqm_website_id', ''),
        ));
        wp_enqueue_style(
            'font-awesome',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
            array(),
            '6.5.0'
        );
        wp_enqueue_style(
            'crownpeak-dqm-gutenberg-css',
            CROWNPEAK_DQM_PLUGIN_URL . 'src/crownpeak-dqm-gutenberg.css',
            array(),
            CROWNPEAK_DQM_VERSION
        );
    }

    public function enqueue_admin_assets($hook)
    {
        if ($hook !== 'settings_page_crownpeak-dqm-insights') {
            return;
        }
        wp_enqueue_style(
            'crownpeak-dqm-admin-css',
            CROWNPEAK_DQM_PLUGIN_URL . 'src/crownpeak-dqm-gutenberg.css',
            array(),
            CROWNPEAK_DQM_VERSION
        );
    }
}

new CrownpeakDQMInsights();

function crownpeak_dqm_insights()
{
    return CrownpeakDQMInsights::class;
}

function crownpeak_dqm_scan_handler()
{
    $api_key = get_option('crownpeak_dqm_api_key', '');
    $website_id = get_option('crownpeak_dqm_website_id', '');
    $content = isset($_POST['content']) ? $_POST['content'] : '';
    $asset_id = isset($_POST['assetId']) ? sanitize_text_field($_POST['assetId']) : '';
    $method = isset($_POST['method']) ? strtoupper($_POST['method']) : 'POST';
    if (empty($content)) {
        wp_send_json(['success' => false, 'message' => 'No content provided.']);
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

function crownpeak_dqm_get_checkpoints_handler()
{
    $api_key = get_option('crownpeak_dqm_api_key', '');
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
    $data = json_decode($body, true);
    $checkpoints = [];
    if (is_array($data)) {
        foreach ($data as $cp) {
            $checkpoints[] = $cp;
        }
    }
    wp_send_json(['success' => true, 'checkpoints' => $checkpoints]);
    wp_die();
}

function crownpeak_dqm_spellcheck_handler()
{
    $api_key = get_option('crownpeak_dqm_api_key', '');
    $asset_id = isset($_POST['assetId']) ? sanitize_text_field($_POST['assetId']) : '';
    if (empty($asset_id)) {
        wp_send_json(['success' => false, 'message' => 'No assetId provided.']);
        wp_die();
    }
    $endpoint = 'https://api.crownpeak.net/dqm-cms/v1/assets/' . $asset_id . '/spellcheck?apiKey=' . $api_key;
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
