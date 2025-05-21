import { log } from "@zos/utils";
import BLEMaster from "@silver-zepp/easy-ble";
import LKDecoder from "../utils/LKDecoder";
import EngoComm from "../utils/EngoComm";
import VariaPacketParser from "../utils/VariaParser";

const { wdEvent } = getApp()._options.globalData;

const ble = new BLEMaster();
const logger = log.getLogger("BLE.background");
const LK_UUID_NOTIFY_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";
const VARIA_UUID_NOTIFY_CHAR = "6a4e3203-667b-11e3-949a-0800200c9a66";
const ENGO_UUID_RX_CHAR = "0783b03e-8535-b5a0-7140-a304d2495cba";
const ENGO_UUID_TX_CHAR = "0783b03e-8535-b5a0-7140-a304d2495cb8";
const ENGO_UUID_GEST_CHAR = "0783b03e-8535-b5a0-7140-a304d2495cbb"; // TX characteristic UUID for ENGO
const ENGO_UUID_BAT_CHAR = "00002A19-0000-1000-8000-00805F9B34FB";
const lk_services = {
  // service #1
  "0000ffe0-0000-1000-8000-00805f9b34fb": {
    // service UUID
    [LK_UUID_NOTIFY_CHAR]: ["2902"], // NOTIFY chara UUID
    //  ^--- descriptor UUID
  },
  // ... add other services here if needed
};

const varia_services = {
  // service #1
  "6a4e3200-667b-11e3-949a-0800200c9a66": {
    // service UUID
    [VARIA_UUID_NOTIFY_CHAR]: ["2902"], // NOTIFY chara UUID
    //  ^--- descriptor UUID
  },
  // ... add other services here if needed
};
const engo_services = {
  // service #1

  "0783b03e-8535-b5a0-7140-a304d2495cb7": {
    // service UUID
    [ENGO_UUID_TX_CHAR]: ["2902"], // TX NOTIFY chara UUID
    [ENGO_UUID_RX_CHAR]: [], // RX NOTIFY chara UUID
    [ENGO_UUID_GEST_CHAR]: ["2902"], //  Proximity sensor NOTIFY chara UUID
    //  ^--- descriptor UUID
  },

  // ... add other services here if needed
};

AppService({
  onInit(e) {
    logger.log(`service onInit(${e})`);
    this.BLE = new BLE();

    wdEvent.on("deviceQueue", (deviceQueue) => {
      ble.stopScan(); // Stop scanning when deviceQueue is received
      logger.log("deviceQueue", deviceQueue);
      // Only create BLEMaster when deviceQueue is received

      this.BLE.deviceQueue = deviceQueue;
      this.BLE.processQueue();
    });
    wdEvent.on("getBLEConnections", () => {
      this.BLE.communicateDeviceStatus();
    });
    // Add scan event handler
    wdEvent.on("startScan", () => {
      this.BLE.scan();
    });
  },

  onDestroy() {
    logger.log("service on destroy invoke");
    this.BLE.killAllConnections();
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
    this.devices = {};
    this.decoder = null; // Initialize decoder to null
    this.engoComm = null; // Initialize engoComm to null
    this.variaParser = null; // Initialize variaParser to null
    this.connections = {}; // mac → { name, connected, decoder, notifChar}
    this.deviceQueue = []; // Queue of devices to connect to
    this.isConnecting = false; // Flag to track ongoing connections
    this.engoMAC = null;
    this.EUCReady = false;
    this.variaReady = false;

    //this.scan();
  }
  getDeviceType(name) {
    if (!name) return "Unknown";
    if (name.startsWith("LK")) return "EUC";
    if (name.startsWith("ENGO")) return "Engo Smartglasses";
    if (name.startsWith("RVR")) return "Varia Radar";
    return "Unknown";
  }
  scan() {
    logger.log("Starting BLE scan...");
    this._scanDeviceQueue = [];
    ble.startScan(
      () => {
        const devices = ble.get.devices();
        Object.keys(devices).forEach((mac) => {
          const name = devices[mac].dev_name;
          const type = this.getDeviceType(name);
          // Only add a device to queue if device type isn't "Unknow"
          // too many listed devices induce crashing (additionnal testing are required to ensure crash is related to UI (ie huge amount of widget created) and not BLE stack)
          if (
            !this._scanDeviceQueue.some((d) => d.mac === mac) &&
            type != "Unknown"
          ) {
            this._scanDeviceQueue.push({
              mac,
              name,
              type,
            });
          }
        });
        // Sort devices by desired order
        const typeOrder = ["EUC", "Varia Radar", "Engo Smartglasses"];
        this._scanDeviceQueue.sort((a, b) => {
          const aIdx = typeOrder.indexOf(a.type);
          const bIdx = typeOrder.indexOf(b.type);
          // Devices not in the list get a high index (sorted last)
          return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
        });
        // Emit scan result to pages
        wdEvent.emit("scanResult", this._scanDeviceQueue);
      },
      {
        allow_duplicates: false,
        duration: 5000, //temporary fix : stop scanning after 5 seconds to avoid device reboot/crash in crowded areas (like train station) as too many callbacks are generated.
        on_duration: () => console.log("Scan complete"),
      }
    );
  }
  stopScan() {
    ble.stopScan();
  }
  killAllConnections() {
    logger.log("Killing all connections...");
    Object.keys(this.connections).forEach((mac) => {
      ble.quit(mac);
    });
  }

  enableCharNotif(mac, callback) {
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
          ble.write[mac].enableCharaNotifications(char_uuid, true);

          ble.on[mac].descWriteComplete((chara, desc, status) => {
            if (status === 0) {
              logger.log(
                `Notifications enabled for ${mac}, characteristic: ${chara}`
              );
              if (chara === ENGO_UUID_TX_CHAR) {
                logger.log("sending fw req cmd");
                //Send getFirmware command to initialize the ENGO communications process
                ble.write[mac].characteristic(
                  ENGO_UUID_RX_CHAR, // ENGO RX char UUID
                  new Uint8Array(this.engoComm.getFwCmd()).buffer,
                  (write_without_response = true)
                );
              }
              if (chara === VARIA_UUID_NOTIFY_CHAR) {
                this.variaReady = true;
              }
              if (chara === LK_UUID_NOTIFY_CHAR) {
                this.EUCReady = true;
              }
              //this.connections[mac].ready = true; // Set the "ready" status
              ble.on[mac].charaNotification((uuid, data, length) => {
                /*
                  logger.log(
                    `Notification received from ${mac}, characteristic: ${uuid}`
                  );
                  */
                // Handle notification data here
                switch (uuid) {
                  case LK_UUID_NOTIFY_CHAR:
                    const result = this.decoder.frameBuffer(data);
                    if (result) {
                      wdEvent.emit("EUCData", result);
                      /*
                      logger.log(
                        `engoMac : ${this.engoMAC}, engoComm : ${this.engoComm}`
                      );*/
                      if (
                        this.engoMAC &&
                        ble.write[this.engoMAC] &&
                        this.engoComm &&
                        this.engoComm.engoReady
                      ) {
                        const pageCmd = new Uint8Array(
                          this.engoComm.engoDisplayEUCData(result)
                        ).buffer;

                        if (pageCmd.byteLength > 0) {
                          ble.write[this.engoMAC].characteristic(
                            ENGO_UUID_RX_CHAR,
                            pageCmd,
                            (write_without_response = true)
                          );
                        }
                      }
                    }
                    break;
                  case VARIA_UUID_NOTIFY_CHAR:
                    const variaData = new Uint8Array(data);
                    const variaTarget = this.variaParser.push(variaData);
                    //console.log(JSON.stringify(variaTarget));
                    wdEvent.emit("variaTarget", variaTarget);
                    break;
                  case ENGO_UUID_TX_CHAR:
                    // 1. Process TX data
                    const txData = new Uint8Array(data);
                    // 2. Prepare RX data (replace with your logic)
                    const rxData = this.processEngoTxAndPrepareRx(txData);
                    if (txData && ble.write[mac]) {
                      // 3. Write to TX characteristic
                      //  logger.log("rxData: " + JSON.stringify(rxData));
                      if (rxData) {
                        ble.write[mac].characteristic(
                          ENGO_UUID_RX_CHAR, // ENGO RX char UUID
                          rxData,
                          (write_without_response = true) // write without response
                        );
                      }
                    }
                    break;

                  case ENGO_UUID_GEST_CHAR:
                    wdEvent.emit("engoGst", data);
                    const pageCmd = new Uint8Array(
                      this.engoComm.getClearScreenCmd()
                    ).buffer;
                    ble.write[this.engoMAC].characteristic(
                      ENGO_UUID_RX_CHAR,
                      pageCmd,
                      (write_without_response = true)
                    );
                    break;
                }
              });
            } else {
              // TODO, retry subscribing notifications
              logger.log(
                `Failed to enable notifications for ${mac}, characteristic: ${chara}`
              );
            }
            callback();
          });
        }
      }
    }
  }

  processQueue() {
    if (this.deviceQueue.length === 0) {
      this.communicateDeviceStatus();
      return;
    }

    const { mac, name } = this.deviceQueue.shift();
    this.connections[mac] = {
      name,
      connected: false,
      callback: null,
      type: null,
      ready: false,
    };
    logger.log(`Connecting to device: ${name} (${mac})`);
    const connCallback = () => {
      const type = this.getDeviceType(name);
      switch (type) {
        case "Varia Radar":
          this.variaParser = new VariaPacketParser();
          this.connections[mac].type = "Varia Radar";
          this.communicateDeviceStatus();
          this.listen(mac, varia_services, () => {
            this.enableCharNotif(mac, () => {
              const waitForVariaReady = () => {
                if (this.variaReady) {
                  this.connections[mac].ready = true;
                  this.processQueue();
                } else {
                  setTimeout(waitForVariaReady, 200); // check every 200ms
                }
              };
              waitForVariaReady();
            });
          });
          break;
        case "Engo Smartglasses":
          this.engoMAC = mac;
          this.engoComm = new EngoComm();
          this.connections[mac].type = "Engo Smartglasses";
          this.communicateDeviceStatus();
          this.listen(mac, engo_services, () => {
            this.enableCharNotif(mac, () => {
              // Wait until engoComm.engoReady is true before proceeding
              const waitForEngoReady = () => {
                if (this.engoComm && this.engoComm.engoReady) {
                  this.connections[mac].ready = true;
                  this.processQueue();
                } else {
                  setTimeout(waitForEngoReady, 200); // check every 200ms
                }
              };
              waitForEngoReady();
            });
          });
          break;
        case "EUC":
          this.decoder = new LKDecoder();
          this.connections[mac].type = "EUC";
          this.communicateDeviceStatus();
          logger.log("EUC flag set for", mac);
          this.listen(mac, lk_services, () => {
            this.enableCharNotif(mac, () => {
              const waitForEUCReady = () => {
                if (this.EUCReady) {
                  this.connections[mac].ready = true;
                  this.processQueue();
                } else {
                  setTimeout(waitForEUCReady, 200); // check every 200ms
                }
              };
              waitForEUCReady();
            });
          });
          break;
        default:
          logger.log(`Unknown device type for ${name} (${mac}). Skipping.`);
          this.processQueue();
          break;
      }
    };
    this.connections[mac].callback = connCallback;

    this.connect(mac, name, () => {
      this.connections[mac].callback();
    });
  }

  connect(mac, name, callback, attempt = 1, max_attempts = 50, delay = 1000) {
    if (this.connections[mac]?.connected) {
      logger.log(`Already connected to ${name} (${mac}). Skipping.`);
      callback();
      return;
    }

    ble.connect(mac, (connect_result) => {
      // if disconnected, try to reconnect
      if (connect_result.status === "disconnected") {
        logger.log(`Device ${mac} disconnected.`);
        // get mac from bluebooth backend to get the proper device (dirty fix, should do a better implementation)

        mac = connect_result.mac;
        name = this.connections[mac]?.name;
        logger.log(`Device ${mac}, ${name} disconnected.`);

        // need to get the pid and destroy the connection
        // ble.stopListener(mac);
        // NOTE : in case of disconnection, reconnection is not working : forget to set is_connected to false, to test after a night of sleep
        this.connections[mac].connected = false;

        this.communicateDeviceStatus(); //for UI updating
        this.connections[mac].ready = false; // Set the "ready" status after communicating disconnection to avoid setting status to unconnected (and display slideswitches on UI)
        logger.log(
          "device connection status :",
          this.connections[mac].connected
        );
        setTimeout(
          () => this.connect(mac, name, this.connections[mac].callback),
          delay
        );
      }

      logger.log("Connect result:", JSON.stringify(connect_result));

      if (
        !connect_result.connected &&
        connect_result.status !== "disconnected"
      ) {
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
          //  callback();
        }
      }
      if (connect_result.connected) {
        logger.log(`Connected to ${name} (${mac}).`);
        this.connections[mac].connected = true;
        //  this.communicateDeviceStatus(); //for UI updating
        callback();
        // Start listening for notifications
      }
    });
  }

  listen(mac, services, callback, attempt = 1, max_attempts = 5, delay = 1000) {
    const profile_object = ble.generateProfileObject(services, mac);

    this.connections[mac].services = services; // Store services for later use in enableCharNotif
    /*
    const service_uuid = Object.keys(services)[0];
    const notifChar = Object.keys(services[service_uuid])[0]; // note notifChar is the 1st char uuid!!
    logger.log("Setting up listener for ", mac, notifChar);
    this.connections[mac].notifChar = notifChar;
    */

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
  communicateDeviceStatus() {
    const BLEConnections = Object.keys(this.connections).map((mac) => {
      const { name, connected, type, ready } = this.connections[mac];
      return { mac, name, connected, type, ready };
    });
    wdEvent.emit("BLEConnections", BLEConnections);
  }
  // Helper function to process TX and prepare RX data
  processEngoTxAndPrepareRx(txData) {
    // logger.log("processEngoTxAndPrepareRx called", txData);
    const dataBuffer = new Uint8Array(txData);

    if (dataBuffer[0] === 0xff) {
      const cmdType = dataBuffer[1];

      switch (cmdType) {
        case 0x06: // firmware
          // get battery
          return new Uint8Array(this.engoComm.getConfigsCmd()).buffer;
        case 0x05: // battery
          this.engoComm.battery = dataBuffer[4]; // NOTE : ONLY GETTING BAT ONCE HERE, SHOULD WRITE A FCT TO GET IT EVERY MINUTE
          // check that config exists:
          return null;

        case 0xd3: // config list
          if (this.engoComm.checkConfigExists(dataBuffer)) {
            this.engoComm.engoReady = true;
            return new Uint8Array(this.engoComm.setConfigCmd()).buffer;
          }
      }
      //TBC
      return null; // Replace with your logic
    } else {
      if (!this.engoComm.engoReady) {
        if (this.engoComm.checkConfigExists(dataBuffer)) {
          this.engoComm.engoReady = true;
          return new Uint8Array(this.engoComm.setConfigCmd()).buffer;
        }
      }
    }
  }
}
