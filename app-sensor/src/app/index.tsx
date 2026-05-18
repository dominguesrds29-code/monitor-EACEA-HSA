import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ScrollView, 
  Platform,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Battery from 'expo-battery';
import { CameraView, Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';
import { createClient } from '@supabase/supabase-js';

const SB_URL = "https://wzbgryhhwpaejjkcnssh.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YmdyeWhod3BhZWpqa2Nuc3NoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTY0MzcsImV4cCI6MjA5NDE3MjQzN30.KyC7aqIGQNjVLZ-cNwrJlappj-btxikJZaziqzFdCbM";

const supabaseClient = createClient(SB_URL, SB_KEY);

interface LogEntry {
  time: string;
  msg: string;
  type: 'info' | 'success' | 'error' | 'warn';
}

export default function SensorScreen() {
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [hasAudioPermission, setHasAudioPermission] = useState<boolean | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isPowerOnline, setIsPowerOnline] = useState<boolean | null>(null);
  const [isGeneratorRunning, setIsGeneratorRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  const cameraRef = useRef<any>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const photoIntervalRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);
  const audioIntervalRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Ativa o Keep Awake se o monitoramento estiver rodando
  if (isMonitoring) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useKeepAwake();
  }

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') => {
    const time = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { time, msg, type }]);
  };

  // Scroll automatico de logs
  useEffect(() => {
    if (scrollViewRef.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [logs]);

  useEffect(() => {
    (async () => {
      const cameraStatus = await Camera.requestCameraPermissionsAsync();
      setHasCameraPermission(cameraStatus.status === 'granted');

      const audioStatus = await Audio.requestPermissionsAsync();
      setHasAudioPermission(audioStatus.status === 'granted');

      addLog("Aplicativo carregado. Permissões verificadas.", "info");
    })();

    return () => {
      stopMonitoring();
    };
  }, []);

  const startMonitoring = async () => {
    if (!hasCameraPermission || !hasAudioPermission) {
      addLog("❌ Permissões de câmera ou microfone ausentes!", "error");
      alert("Por favor, conceda permissões de câmera e microfone nas configurações.");
      return;
    }

    try {
      setIsMonitoring(true);
      addLog("⚡ Iniciando monitoramento nativo...", "info");

      // 1. Iniciar Bateria
      await initBattery();

      // 2. Iniciar Áudio (Monitor de Ruído)
      await initAudio();

      // 3. Primeira Foto imediata
      setTimeout(takePhoto, 3000);

      // 4. Intervalo de Foto (10 minutos = 600000ms)
      photoIntervalRef.current = setInterval(takePhoto, 600000);

      // 5. Heartbeat a cada 20 segundos
      sendHeartbeat(true);
      heartbeatIntervalRef.current = setInterval(() => sendHeartbeat(true), 20000);

      addLog("🚀 Monitoramento Ativo com Sucesso!", "success");
    } catch (e: any) {
      addLog(`❌ Erro ao iniciar: ${e.message}`, "error");
      stopMonitoring();
    }
  };

  const stopMonitoring = async () => {
    setIsMonitoring(false);
    addLog("🛑 Monitoramento interrompido.", "warn");

    // Limpar intervalos
    if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
    if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    if (audioIntervalRef.current) clearInterval(audioIntervalRef.current);

    // Parar gravação de áudio
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (e) {}
      recordingRef.current = null;
    }

    // Enviar heartbeat final como inativo
    sendHeartbeat(false);
  };

  const sendHeartbeat = async (isActive: boolean) => {
    try {
      const timestamp = isActive ? new Date().toISOString() : new Date(0).toISOString();
      await supabaseClient.from('current_status').update({
        last_update: timestamp
      }).eq('id', 1);
    } catch (e) {}
  };

  const initBattery = async () => {
    const batteryInfo = await Battery.getPowerStateAsync();
    const online = batteryInfo.batteryState === Battery.BatteryState.CHARGING || 
                   batteryInfo.batteryState === Battery.BatteryState.FULL;
    
    setIsPowerOnline(online);
    logBatteryState(online);

    // Listener para mudanças na bateria
    Battery.addBatteryStateListener(({ batteryState }) => {
      const isCharging = batteryState === Battery.BatteryState.CHARGING || 
                         batteryState === Battery.BatteryState.FULL;
      setIsPowerOnline(isCharging);
      logBatteryState(isCharging);
    });
  };

  const logBatteryState = async (online: boolean) => {
    addLog(`⚡ Entrada de energia: ${online ? "Conectado" : "QUEDA!"}`, online ? "success" : "warn");
    try {
      await supabaseClient.from('current_status').upsert({
        id: 1,
        is_power_online: online,
        last_update: new Date().toISOString()
      });

      await supabaseClient.from('status_logs').insert({ 
        event_type: online ? 'energia_normalizada' : 'queda_energia' 
      });
      addLog("☁️ Estado da bateria enviado para a nuvem", "info");
    } catch (e: any) {
      addLog(`❌ Erro ao enviar bateria: ${e.message}`, "error");
    }
  };

  const initAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      recordingRef.current = recording;
      await recording.startAsync();
      addLog("🎙️ Microfone ativado. Monitorando ruídos...", "success");

      let isGenRunning = false;

      // Loop para verificar os decibéis (metering)
      audioIntervalRef.current = setInterval(async () => {
        if (!recordingRef.current) return;
        
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording && status.metering !== undefined) {
          const dB = status.metering; // Valor entre -160 e 0
          
          // -40 dB a 0 dB geralmente indica barulho alto (gerador próximo)
          if (dB > -35 && !isGenRunning) {
            isGenRunning = true;
            setIsGeneratorRunning(true);
            addLog("⚠️ BARULHO! Gerador detectado.", "warn");
            await supabaseClient.from('current_status').update({ is_generator_running: true }).eq('id', 1);
            await supabaseClient.from('status_logs').insert({ event_type: 'gerador_ligado' });
          } else if (dB < -50 && isGenRunning) {
            isGenRunning = false;
            setIsGeneratorRunning(false);
            addLog("🤫 Silêncio. Gerador parou.", "info");
            await supabaseClient.from('current_status').update({ is_generator_running: false }).eq('id', 1);
            await supabaseClient.from('status_logs').insert({ event_type: 'gerador_desligado' });
          }
        }
      }, 2000); // Verifica a cada 2 segundos

    } catch (e: any) {
      addLog(`❌ Erro no Microfone: ${e.message}`, "error");
    }
  };

  const takePhoto = async () => {
    if (!cameraRef.current) {
      addLog("❌ Câmera não inicializada no momento da foto.", "error");
      return;
    }

    try {
      addLog("📸 Capturando imagem...", "info");
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.4,
        skipProcessing: true // Acelera o processo no Android
      });

      addLog("🖼️ Comprimindo e preparando upload...", "info");
      const response = await fetch(photo.uri);
      const blob = await response.blob();

      const fileName = `fuel_${Date.now()}.jpg`;
      const { data, error } = await supabaseClient.storage.from('assets').upload(fileName, blob, {
        contentType: 'image/jpeg'
      });

      if (error) throw error;

      const { data: { publicUrl } } = supabaseClient.storage.from('assets').getPublicUrl(fileName);

      await supabaseClient.from('status_logs').insert({
        event_type: 'leitura_painel',
        image_url: publicUrl
      });

      addLog(`✅ Foto enviada com sucesso! (${(blob.size / 1024).toFixed(1)} KB)`, "success");
    } catch (e: any) {
      addLog(`❌ Erro ao enviar foto: ${e.message}`, "error");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sensor EACEA-HSA</Text>
        <Text style={styles.subtitle}>Aplicativo Sensor de Painel & Energia</Text>
      </View>

      {/* Box de Status Principal */}
      <View style={[styles.statusBox, isMonitoring ? styles.statusBoxActive : styles.statusBoxInactive]}>
        <View style={[styles.indicator, isMonitoring ? styles.indicatorActive : styles.indicatorInactive]} />
        <Text style={styles.statusText}>
          {isMonitoring ? "MONITORAMENTO ATIVO" : "MONITORAMENTO PARADO"}
        </Text>
      </View>

      {/* Grid de Metadados rápidos */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>🔋 Energia</Text>
          <Text style={[styles.statValue, isPowerOnline === null ? styles.textGray : (isPowerOnline ? styles.textGreen : styles.textRed)]}>
            {isPowerOnline === null ? "..." : (isPowerOnline ? "Carregando" : "Sem Energia")}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>⚙️ Gerador</Text>
          <Text style={[styles.statValue, isGeneratorRunning ? styles.textOrange : styles.textGray]}>
            {isGeneratorRunning ? "LIGADO" : "Desligado"}
          </Text>
        </View>
      </View>

      {/* Painel de Log com scroll */}
      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Histórico de Logs Nativos</Text>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.logScroll} 
          contentContainerStyle={styles.logContent}
        >
          {logs.length === 0 ? (
            <Text style={styles.emptyLog}>Nenhum log registrado ainda.</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logLine}>
                <Text style={styles.logTime}>[{log.time}]</Text>
                <Text style={[
                  styles.logMsg, 
                  log.type === 'success' && styles.logSuccess,
                  log.type === 'error' && styles.logError,
                  log.type === 'warn' && styles.logWarn
                ]}>
                  {log.msg}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

      {/* Botões de Ação */}
      <View style={styles.actions}>
        {!isMonitoring ? (
          <TouchableOpacity style={styles.btnStart} onPress={startMonitoring}>
            <Text style={styles.btnText}>LIGAR MONITORAMENTO</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.btnStop} onPress={stopMonitoring}>
            <Text style={styles.btnText}>PARAR MONITORAMENTO</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Câmera em tamanho minúsculo 1x1 em absoluto para permitir que ela funcione sem ocupar espaço visível */}
      {isMonitoring && (
        <View style={styles.hiddenCameraContainer}>
          <CameraView
            ref={cameraRef}
            style={styles.hiddenCamera}
            facing="back"
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0d0e',
    padding: 20,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginVertical: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 14,
    color: '#8e8e93',
    marginTop: 4,
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 30,
    borderWidth: 1,
    marginVertical: 10,
  },
  statusBoxActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: '#34c759',
  },
  statusBoxInactive: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: '#ff3b30',
  },
  indicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  indicatorActive: {
    backgroundColor: '#34c759',
  },
  indicatorInactive: {
    backgroundColor: '#ff3b30',
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 14,
    color: '#ffffff',
    letterSpacing: 1.1,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 15,
    marginVertical: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1c1c1e',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#2c2c2e',
  },
  statLabel: {
    fontSize: 12,
    color: '#aeaeb2',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  textGreen: {
    color: '#34c759',
  },
  textRed: {
    color: '#ff3b30',
  },
  textOrange: {
    color: '#ff9500',
  },
  textGray: {
    color: '#8e8e93',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#121314',
    borderWidth: 1,
    borderColor: '#222325',
    borderRadius: 15,
    padding: 15,
    marginVertical: 15,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  logScroll: {
    flex: 1,
  },
  logContent: {
    paddingVertical: 5,
  },
  emptyLog: {
    color: '#636366',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  logLine: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  logTime: {
    color: '#64d2ff',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginRight: 6,
    fontSize: 12,
  },
  logMsg: {
    color: '#e5e5ea',
    fontSize: 12,
    flex: 1,
  },
  logSuccess: {
    color: '#30d158',
  },
  logError: {
    color: '#ff453a',
  },
  logWarn: {
    color: '#ffd60a',
  },
  actions: {
    marginVertical: 10,
  },
  btnStart: {
    backgroundColor: '#0071e3',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#0071e3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnStop: {
    backgroundColor: '#ff3b30',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#ff3b30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  btnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  hiddenCameraContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0.01,
    overflow: 'hidden',
  },
  hiddenCamera: {
    width: 10,
    height: 10,
  }
});
