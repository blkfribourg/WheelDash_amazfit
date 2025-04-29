#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

BLECharacteristic *pNotifyCharacteristic;
bool deviceConnected = false;
unsigned long lastNotifyTime = 0;
const int mtuSize = 20;
size_t notifyIndex = 0;

// Array of hex data strings
const char* hexDataArray[] = {
  "DC5A5C20247F0000813F000845B5006200000D410C2200000AF00AF004530003DED50000",
  "DC5A5C20247F000A813F000845B5006200000D410C2200000AF00AF004530003DED50000",
  "DC5A5C20247F0014813F000845B5006200000D410C2200000AF00AF004530003DED50000"
};
const int hexDataCount = sizeof(hexDataArray) / sizeof(hexDataArray[0]);
int currentHexIndex = 0;

std::string notifyData;

// Convert hex string to byte array
std::string hexStringToBytes(const char* hex) {
  std::string bytes;
  while (*hex && *(hex + 1)) {
    char byteString[3] = { hex[0], hex[1], 0 };
    bytes.push_back((char)strtoul(byteString, nullptr, 16));
    hex += 2;
  }
  return bytes;
}

class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) {
    deviceConnected = true;
  }

  void onDisconnect(BLEServer* pServer) {
    deviceConnected = false;
    notifyIndex = 0;
    pServer->getAdvertising()->start();
  }
};

void setup() {
  Serial.begin(115200);

  BLEDevice::init("LK4862");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService("0000ffe0-0000-1000-8000-00805f9b34fb");

  pNotifyCharacteristic = pService->createCharacteristic(
    "0000ffe1-0000-1000-8000-00805f9b34fb",
    BLECharacteristic::PROPERTY_NOTIFY
  );
  pNotifyCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID("0000ffe0-0000-1000-8000-00805f9b34fb");
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  pAdvertising->start();
}

void loop() {
  if (deviceConnected) {
    unsigned long currentTime = millis();

    if (currentTime - lastNotifyTime >= 200) {
      lastNotifyTime = currentTime;
      notifyIndex = 0;

      // Convert current hex string to bytes
      notifyData = hexStringToBytes(hexDataArray[currentHexIndex]);

      while (notifyIndex < notifyData.length()) {
        size_t chunkSize = std::min<size_t>(mtuSize, notifyData.length() - notifyIndex);
        std::string chunk = notifyData.substr(notifyIndex, chunkSize);
        pNotifyCharacteristic->setValue(chunk);
        pNotifyCharacteristic->notify();
        notifyIndex += chunkSize;
        delay(10); // Small delay between packets
      }

      // Move to next hex data for the next cycle
      currentHexIndex = (currentHexIndex + 1) % hexDataCount;
    }
  }
}
