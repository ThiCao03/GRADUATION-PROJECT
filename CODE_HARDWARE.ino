#include <WiFi.h>
#include <WiFiManager.h>
#include <Wire.h>
#include "MAX30105.h"
#include "spo2_algorithm.h"
#include <Adafruit_GFX.h>
#include <Adafruit_GC9A01A.h>
#include <PubSubClient.h>
#include <WiFiClientSecure.h>

// ==== Pin cấu hình ====
#define TFT_CS   12
#define TFT_DC   11
#define TFT_RST  -1
#define TFT_MOSI 9
#define TFT_SCLK 8
#define LCD_BLK 13

#define I2C_SDA 2
#define I2C_SCL 3
#define MAX30102_INT_PIN 1
#define BATTERY_ADC_PIN 7

// ==== MQTT Config ====
const char *mqtt_server = "3d4f01052fa04a539a871f0ca82c4419.s1.eu.hivemq.cloud";
const int mqtt_port = 8883;
const char *mqtt_user = "caodinhthi2003";
const char *mqtt_password = "Thi2k3er";

// ==== MQTT Client Secure ====
WiFiClientSecure espClient;
PubSubClient client(espClient);

// ==== Biến toàn cục ====
MAX30105 particleSensor;
Adafruit_GC9A01A tft(TFT_CS, TFT_DC, TFT_MOSI, TFT_SCLK, TFT_RST, -1);

#define BUFFER_SIZE 100
uint32_t irBuffer[BUFFER_SIZE];
uint32_t redBuffer[BUFFER_SIZE];
int32_t spo2 = 0, heartRate = 0;
int8_t validSPO2 = 0, validHeartRate = 0;
int batteryPercent = 0;

bool backlightOn = true;
bool sensorOn = true;
unsigned long lastFingerDetectedTime = 0;

// ==== Thời gian ====
unsigned long lastSensorReadTime = 0;
unsigned long lastMqttSendTime = 0;
unsigned long lastDisplayUpdateTime = 0;
const long SENSOR_READ_INTERVAL = 100;   // Đọc cảm biến mỗi 100ms
const long MQTT_SEND_INTERVAL = 3000;    // Gửi MQTT mỗi 3 giây
const long DISPLAY_UPDATE_INTERVAL = 3000; // Cập nhật màn hình mỗi 3 giây

// ==== Đọc phần trăm pin ====
int readBatteryPercent() {
  int raw = analogRead(BATTERY_ADC_PIN);
  float voltage = raw * (3.3 / 4095.0) * 2.0;
  int percent = map(voltage * 100, 330, 420, 0, 100);
  percent = constrain(percent, 0, 100);
  return percent;
}

// ==== Điều khiển đèn nền ====
void setBacklightBrightness(uint8_t b) {
  analogWrite(LCD_BLK, b);
}

void fadeOutBacklight() {
  for (int b = 255; b >= 0; b -= 5) {
    setBacklightBrightness(b);
    delay(5);
  }
  backlightOn = false;
}

void fadeInBacklight() {
  for (int b = 0; b <= 255; b += 5) {
    setBacklightBrightness(b);
    delay(5);
  }
  backlightOn = true;
}

// ==== MQTT Callbacks ====
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("]: ");
  for (int i = 0; i < length; i++) {
    Serial.print((char)payload[i]);
  }
  Serial.println();
}

// ==== Reconnect MQTT ====
void reconnect() {
  if (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    if (client.connect("SmartBand_Client", mqtt_user, mqtt_password)) {
      Serial.println("connected");
      client.subscribe("smartband/commands");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
    }
  }
}

// ==== Đọc và xử lý dữ liệu cảm biến ====
bool readSensorData() {
  for (int i = 0; i < BUFFER_SIZE; i++) {
    while (!particleSensor.check()) delay(1);
    redBuffer[i] = particleSensor.getRed();
    irBuffer[i] = particleSensor.getIR();
  }

  bool fingerDetected = irBuffer[BUFFER_SIZE - 1] >= 50000;

  if (fingerDetected) {
    lastFingerDetectedTime = millis();
    maxim_heart_rate_and_oxygen_saturation(irBuffer, BUFFER_SIZE, redBuffer,
      &spo2, &validSPO2, &heartRate, &validHeartRate);

    if (!sensorOn) {
      particleSensor.setPulseAmplitudeRed(0x0A);
      particleSensor.setPulseAmplitudeGreen(0);
      sensorOn = true;
      fadeInBacklight();
      Serial.println("🔆 Bật lại MAX30102 và LCD");
    }
  } else {
    if (sensorOn && (millis() - lastFingerDetectedTime > 10000)) {
      particleSensor.setPulseAmplitudeRed(0);
      particleSensor.setPulseAmplitudeGreen(0);
      sensorOn = false;
      fadeOutBacklight();
      Serial.println("🌙 Tắt MAX30102 và LCD do không có ngón tay");
    }
  }
  
  return fingerDetected;
}

// ==== Cập nhật màn hình ====
void updateDisplay() {
  tft.fillScreen(GC9A01A_BLACK);

  batteryPercent = readBatteryPercent();
  tft.setCursor(70, 80);
  tft.setTextColor(GC9A01A_WHITE);
  tft.setTextSize(2);
  tft.print("Pin: ");
  tft.print(batteryPercent);
  tft.print("%");

  tft.setCursor(70, 110);
  if (validHeartRate && heartRate != 0) {
    tft.print("BPM: ");
    tft.print(heartRate);
  } else {
    tft.print("BPM:...");
  }

  tft.setCursor(70, 140);
  if (validSPO2 && spo2 != 0) {
    tft.print("SpO2: ");
    tft.print(spo2);
    tft.print("%");
  } else {
    tft.print("SpO2:...");
  }
}

// ==== Gửi dữ liệu MQTT ====
void sendMqttData() {
  if (client.connected()) {
    batteryPercent = readBatteryPercent();
    
    // Chỉ gửi khi BPM và SpO2 hợp lệ
    if (validHeartRate && heartRate != 0 && validSPO2 && spo2 != 0) {
      String payload = "{\"battery\":" + String(batteryPercent) +
                      ",\"heartRate\":" + String(heartRate) +
                      ",\"spo2\":" + String(spo2) + "}";
      client.publish("smartband/data", payload.c_str());
      Serial.println("📤 Gửi MQTT: " + payload);
    } else {
      Serial.println("⚠️ Dữ liệu không hợp lệ, không gửi MQTT");
    }
  }
}

// ==== setup ====
void setup() {
  Serial.begin(115200);
  Wire.begin(I2C_SDA, I2C_SCL);
  pinMode(LCD_BLK, OUTPUT);
  pinMode(MAX30102_INT_PIN, INPUT_PULLUP);
  pinMode(BATTERY_ADC_PIN, INPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  tft.begin();
  tft.setRotation(0);
  tft.fillScreen(GC9A01A_BLACK);

  if (!particleSensor.begin()) {
    Serial.println("Không tìm thấy MAX30102!");
    while (1);
  }

  particleSensor.setup();
  particleSensor.setPulseAmplitudeRed(0x0A);
  particleSensor.setPulseAmplitudeGreen(0);

  setBacklightBrightness(255);

  // Thiết lập WiFi
  WiFiManager wm;
  bool res = wm.autoConnect("SmartBand_ThiCao", "211410101");
  if (!res) {
    Serial.println("❌ Wi-Fi thất bại. Reset lại...");
    ESP.restart();
  }

  Serial.println("✅ Wi-Fi OK! IP: " + WiFi.localIP().toString());

  // Bỏ verify cert nếu HiveMQ không yêu cầu
  espClient.setInsecure();

  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);
}

void loop() {
  unsigned long currentMillis = millis();
  
  // Kiểm tra kết nối MQTT
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  // Đọc dữ liệu cảm biến mỗi SENSOR_READ_INTERVAL
  if (currentMillis - lastSensorReadTime >= SENSOR_READ_INTERVAL) {
    lastSensorReadTime = currentMillis;
    readSensorData();
  }
  
  // Gửi MQTT và cập nhật màn hình mỗi MQTT_SEND_INTERVAL
  if (currentMillis - lastMqttSendTime >= MQTT_SEND_INTERVAL) {
    lastMqttSendTime = currentMillis;
    lastDisplayUpdateTime = currentMillis;  // Đồng bộ thời gian cập nhật màn hình
    
    // Chỉ cập nhật và gửi dữ liệu khi màn hình đang bật
    if (backlightOn) {
      updateDisplay();
      sendMqttData();
    }
  }
}