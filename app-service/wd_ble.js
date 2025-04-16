import { log } from "@zos/utils";
import { EventBus } from "@zos/utils";
import BLEMaster, {
  PERMISSIONS,
  ab2hex,
  ab2num,
  ab2str,
} from "@silver-zepp/easy-ble";
import LKDecoder from "../utils/LKDecoder";
import EngoComms from "../utils/EngoComms";
import * as appServiceMgr from "@zos/app-service";
const { wdEvent } = getApp()._options.globalData;
const ble = new BLEMaster();
const logger = log.getLogger("BLE.background");
const LK_UUID_NOTIFY_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";
const VARIA_UUID_NOTIFY_CHAR = "6a4e3203-667b-11e3-949a-0800200c9a66";
const ENGO_UUID_RX_CHAR = "0783b03e-8535-b5a0-7140-a304d2495cba";

const lk_services = {
  // service #1
  "0000ffe0-0000-1000-8000-00805f9b34fb": {
    // service UUID
    "0000ffe1-0000-1000-8000-00805f9b34fb": ["2902"], // NOTIFY chara UUID
    //  ^--- descriptor UUID
  },
  // ... add other services here if needed
};

const varia_services = {
  // service #1
  "6a4e3200-667b-11e3-949a-0800200c9a66": {
    // service UUID
    "6a4e3203-667b-11e3-949a-0800200c9a66": ["2902"], // NOTIFY chara UUID
    //  ^--- descriptor UUID
  },
  // ... add other services here if needed
};
const engo_services = {
  // service #1

  "0783b03e-8535-b5a0-7140-a304d2495cb7": {
    // service UUID
    "0783b03e-8535-b5a0-7140-a304d2495cbb": ["2902"], //  Proximity sensor NOTIFY chara UUID
    "0783b03e-8535-b5a0-7140-a304d2495cb8": ["2902"], // TX NOTIFY chara UUID
    "0783b03e-8535-b5a0-7140-a304d2495cba": [], // RX NOTIFY chara UUID
    //  ^--- descriptor UUID
  },
  // ... add other services here if needed
};

AppService({
  onInit(e) {
    logger.log(`service onInit(${e})`);

    this.BLE = new BLE();
    // this.BLE.init();
    BLEMaster.SetDebugLevel(3);
    wdEvent.on("deviceQueue", (deviceQueue) => {
      logger.log("deviceQueue", deviceQueue);
      this.BLE.expectedDeviceCount = deviceQueue.length; // Set expected device count
      this.BLE.deviceQueue = deviceQueue;
      this.BLE.processQueue();
    });
  },

  onDestroy() {
    logger.log("service on destroy invoke");
  },
});

/*
Page({
  onInit() {
    this.BLE = new BLE();
    this.BLE.init(2);
    BLEMaster.SetDebugLevel(3);
  },
  destroy() {
    Object.keys(this.BLE.connections).forEach((mac) => {
      if (!ble.quit(mac)) {
        logger.log(`Failed to quit BLE connection for ${mac}`);
      }
    });
  },
});
*/

class BLE {
  // initial setup
  constructor() {
    logger.log("=========================================");
    logger.log("Initializing BLE operations", Date.now());

    this.decoder = null; // Initialize decoder to null
    this.engoCmms = null; // Initialize EngoComms to null
    this.devices = {}; // mac (uppercased) → device_name
    this.connections = {}; // mac → { name, connected, decoder, notifChar}
    this.deviceQueue = []; // Queue of devices to connect to
    this.isConnecting = false; // Flag to track ongoing connections
    this.expectedDeviceCount = 0; // Expected number of devices to connect to
    this.engoMAC = null;
    //this.scan();
  }

  // the mac of a device you are connecting to

  enableCharNotif(mac, callback) {
    logger.log("All listeners started. Executing enableCharNotif...");

    const services = this.connections[mac].services; // Retrieve services for the device

    if (!services) {
      logger.log(`No services found for ${mac}`);
      return;
    }

    for (const service_uuid in services) {
      const characteristics = services[service_uuid];
      for (const char_uuid in characteristics) {
        const descriptors = characteristics[char_uuid];
        if (descriptors.includes("2902")) {
          logger.log(
            `Enabling notifications for ${mac}, characteristic: ${char_uuid}`
          );
          ble.write[mac].enableCharaNotifications(char_uuid, true);

          ble.on[mac].descWriteComplete((chara, desc, status) => {
            if (status === 0) {
              logger.log(
                `Notifications enabled for ${mac}, characteristic: ${chara}`
              );
              callback();
              //this.connections[mac].ready = true; // Set the "ready" status
              ble.on[mac].charaNotification((uuid, data, length) => {
                /*
                  logger.log(
                    `Notification received from ${mac}, characteristic: ${uuid}`
                  );
                  */
                // Handle notification data here
                if (uuid === LK_UUID_NOTIFY_CHAR) {
                  const result = this.decoder.frameBuffer(data);
                  if (result) {
                    wdEvent.emit("EUCData", result);
                    logger.log(
                      `engoMac : ${this.engoMAC}, engoCmms : ${this.engoCmms}`
                    );
                    if (
                      this.engoMAC &&
                      ble.write[this.engoMAC] &&
                      this.engoCmms
                    ) {
                      //engoData def
                      const engoSpd = this.engoCmms.writeTextDefault(
                        "speed : " + result["speed"],
                        230,
                        210
                      );
                      const engoPWM = this.engoCmms.writeTextDefault(
                        "PWM : " + result["hPWM"],
                        230,
                        150
                      );
                      const engoVlt = this.engoCmms.writeTextDefault(
                        "Voltage : " + result["voltage"],
                        230,
                        90
                      );
                      const engoCLS = this.engoCmms.getClearScreenCmd();
                      logger.log("sending ENGO data");
                      const engoData = new Uint8Array([
                        ...engoCLS,
                        ...engoSpd,
                        ...engoPWM,
                        ...engoVlt,
                      ]).buffer;

                      ble.write[this.engoMAC].characteristic(
                        ENGO_UUID_RX_CHAR,
                        engoData,
                        (write_without_response = true)
                      );
                    }
                  }
                } else if (uuid === VARIA_UUID_NOTIFY_CHAR) {
                  const variaData = new Uint8Array(data);
                  const vehspd = variaData[3] || "--";
                  const vehdst = variaData[2] || "--";
                  wdEvent.emit("variaData", { vehdst, vehspd });
                }
              });
            } else {
              logger.log(
                `Failed to enable notifications for ${mac}, characteristic: ${chara}`
              );
            }
          });
        }
      }
    }
  }

  processQueue() {
    if (this.deviceQueue.length === 0) {
      // if (this.isConnecting || this.deviceQueue.length === 0) {
      // If no more devices in the queue and all listeners are active, call enableCharNotif
      if (
        this.deviceQueue.length === 0 &&
        Object.keys(this.connections).length >= this.expectedDeviceCount
      ) {
        logger.log("All devices processed. Calling enableCharNotif...");
        //  this.enableCharNotif();
      }
      return;
    }

    const { mac, name } = this.deviceQueue.shift();
    //this.isConnecting = true;

    logger.log(`Connecting to device: ${name} (${mac})`);
    this.connect(mac, name, () => {
      // this.isConnecting = false;
      //   this.processQueue(); // Proceed to the next device in the queue
      if (name.startsWith("RVR")) {
        this.listen(mac, varia_services, () => {
          this.enableCharNotif(mac, () => {
            this.processQueue(); // Proceed to the next device in the queue
          });
        });
      } else if (name.startsWith("ENG")) {
        this.engoMAC = mac;
        this.engoCmms = new EngoComms();
        this.listen(mac, engo_services, () => {
          this.enableCharNotif(mac, () => {
            this.processQueue(); // Proceed to the next device in the queue
          });
        });
      } else if (name.startsWith("LK")) {
        // Initialize the EUC decoder
        this.decoder = new LKDecoder();
        this.listen(mac, lk_services, () => {
          this.enableCharNotif(mac, () => {
            this.processQueue(); // Proceed to the next device in the queue
          });
        });
      }
    });
  }

  connect(mac, name, callback, attempt = 1, max_attempts = 5, delay = 1000) {
    if (this.connections[mac]?.connected) {
      logger.log(`Already connected to ${name} (${mac}). Skipping.`);
      callback();
      return;
    }

    logger.log("Connecting to:", name, mac);
    ble.connect(mac, (connect_result) => {
      logger.log("Connect result:", JSON.stringify(connect_result));

      if (!connect_result.connected) {
        if (attempt < max_attempts) {
          logger.log(
            `Attempt ${attempt} failed for ${name} (${mac}). Retrying in ${
              delay / 1000
            } seconds...`
          );
          setTimeout(
            () =>
              this.connect(
                mac,
                name,
                callback,
                attempt + 1,
                max_attempts,
                delay
              ),
            delay
          );
        } else {
          logger.log(
            `Connection failed for ${name} (${mac}). Max attempts reached.`
          );
          callback();
        }
      } else {
        logger.log(`Connected to ${name} (${mac}).`);
        this.connections[mac] = {
          name,
          connected: true,
        };
        callback();
        // Start listening for notifications
      }
    });
  }

  listen(mac, services, callback, attempt = 1, max_attempts = 5, delay = 1000) {
    const profile_object = ble.generateProfileObject(services, mac);
    this.connections[mac].services = services; // Store services for later use in enableCharNotif
    const service_uuid = Object.keys(services)[0];
    const notifChar = Object.keys(services[service_uuid])[0]; // note notifChar is the 1st char uuid!!
    logger.log("Setting up listener for ", mac, notifChar);
    this.connections[mac].notifChar = notifChar;

    ble.startListener(profile_object, mac, (response) => {
      if (response.success) {
        logger.log(`Listener started for ${mac}`);
        callback(); // Proceed to the next device in the queue
      } else {
        logger.log(
          `Failed to start listener for ${mac} (attempt ${attempt}):`,
          response.message
        );
        if (attempt < max_attempts) {
          setTimeout(() => {
            this.listen(
              mac,
              services,
              callback,
              attempt + 1,
              max_attempts,
              delay
            );
          }, delay);
        } else {
          logger.log(`Max attempts reached for starting listener on ${mac}.`);
          callback(); // Proceed even if listener fails after retries
        }
      }
    });
  }
}
