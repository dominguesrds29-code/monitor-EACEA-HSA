<?php
// Configuration file
$db_host = 'localhost';
$db_user = 'root';
$db_pass = '';
$db_name = 'energy_monitor';

$conn = new mysqli($db_host, $db_user, $db_pass, $db_name);

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}

// Function to log event
function logEvent($type, $value = null, $image = null, $audio = null) {
    global $conn;
    $stmt = $conn->prepare("INSERT INTO status_logs (event_type, status_value, image_path, audio_path) VALUES (?, ?, ?, ?)");
    $stmt->bind_param("ssss", $type, $value, $image, $audio);
    $stmt->execute();
    $stmt->close();
}

// Function to update current status
function updateStatus($power, $generator, $fuel = null) {
    global $conn;
    $stmt = $conn->prepare("UPDATE current_status SET is_power_online = ?, is_generator_running = ?, fuel_level = ? WHERE id = 1");
    $stmt->bind_param("iis", $power, $generator, $fuel);
    $stmt->execute();
    $stmt->close();
}
?>
