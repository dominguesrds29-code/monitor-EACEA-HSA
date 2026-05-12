<?php
require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// Error logging to file - Disable display to avoid breaking JSON
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', 'php_errors.log');
error_reporting(E_ALL);

$action = $_POST['action'] ?? $_GET['action'] ?? '';

if ($action === 'update_power') {
    $is_online = isset($_POST['online']) ? (int)$_POST['online'] : 1;
    updateStatus($is_online, ($is_online ? 0 : 1)); 
    logEvent($is_online ? 'power_restore' : 'power_outage');
    ob_clean();
    echo json_encode(['status' => 'success']);
    exit;
} 

elseif ($action === 'upload_image') {
    if (isset($_FILES['image'])) {
        $upload_dir = 'uploads/images/';
        if (!is_dir($upload_dir)) {
            if (!mkdir($upload_dir, 0777, true)) {
                error_log("Failed to create directory: " . $upload_dir);
            }
        }
        
        $filename = time() . '_' . basename($_FILES['image']['name']);
        $target_file = $upload_dir . $filename;
        
        if (move_uploaded_file($_FILES['image']['tmp_name'], $target_file)) {
            logEvent('fuel_check', 'Image uploaded', $target_file);
            ob_clean();
            echo json_encode(['status' => 'success', 'path' => $target_file]);
        } else {
            error_log("File upload failed: " . $_FILES['image']['error']);
            ob_clean();
            echo json_encode(['status' => 'error', 'message' => 'Upload failed']);
        }
        exit;
    }
}

elseif ($action === 'log_generator') {
    $running = isset($_POST['running']) ? (int)$_POST['running'] : 0;
    updateStatus(null, $running); // Only update generator status
    logEvent($running ? 'generator_start' : 'generator_stop');
    
    if (isset($_FILES['audio'])) {
        $upload_dir = 'uploads/audio/';
        if (!is_dir($upload_dir)) mkdir($upload_dir, 0777, true);
        $filename = time() . '_gen.wav';
        move_uploaded_file($_FILES['audio']['tmp_name'], $upload_dir . $filename);
    }
    
    ob_clean();
    echo json_encode(['status' => 'success']);
    exit;
}

elseif ($action === 'get_status') {
    $result = $conn->query("SELECT * FROM current_status WHERE id = 1");
    $current = $result->fetch_assoc();
    
    $logs = $conn->query("SELECT * FROM status_logs ORDER BY created_at DESC LIMIT 20");
    $history = [];
    while ($row = $logs->fetch_assoc()) {
        $history[] = $row;
    }
    
    ob_clean();
    echo json_encode([
        'current' => $current,
        'history' => $history
    ]);
    exit;
}
