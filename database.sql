-- Database schema for Energy Monitor
CREATE DATABASE IF NOT EXISTS energy_monitor;
USE energy_monitor;

CREATE TABLE IF NOT EXISTS status_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type ENUM('queda_energia', 'energia_normalizada', 'gerador_ligado', 'gerador_desligado', 'leitura_painel') NOT NULL,
    status_value VARCHAR(255),
    image_path VARCHAR(255),
    audio_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS current_status (
    id INT PRIMARY KEY DEFAULT 1,
    is_power_online BOOLEAN DEFAULT TRUE,
    is_generator_running BOOLEAN DEFAULT FALSE,
    fuel_level VARCHAR(50),
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Initialize current status
INSERT INTO current_status (id, is_power_online, is_generator_running, fuel_level) 
VALUES (1, TRUE, FALSE, 'Unknown')
ON DUPLICATE KEY UPDATE last_update = CURRENT_TIMESTAMP;
