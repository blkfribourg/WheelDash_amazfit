import { getText } from "@zos/i18n";
import * as Styles from "zosLoader:./index.[pf].layout.js";
import AutoGUI from "@silver-zepp/autogui";
import BLEMaster, {
  PERMISSIONS,
  ab2hex,
  ab2num,
  ab2str,
} from "@silver-zepp/easy-ble";
import LKDecoder from "../utils/LKDecoder";
const ble = new BLEMaster();
const AppContext = {
  MainUI: null,
  //LKDecoder: null,
  BLE: null,
};

//const MAC_EUC = "88:25:83:F3:5E:E2";
const MAC_EUC = "D8:BC:38:E5:8C:F2";
//const MAC_VARIA = "CA:D1:66:93:69:67";
const MAC_VARIA = "CB:08:79:B6:C9:34";
const LK_SERVICE_UUID = "0000ffe0-0000-1000-8000-00805f9b34fb";
const LK_UUID_NOTIFY_CHAR = "0000ffe1-0000-1000-8000-00805f9b34fb";
const VARIA_UUID_NOTIFY_CHAR = "6a4e3203-667b-11e3-949a-0800200c9a66";

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
    "0783b03e-8535-b5a0-7140-a304d2495cbb": ["2902"], // NOTIFY chara UUID
    //  ^--- descriptor UUID
  },
  // ... add other services here if needed
};

Page({
  onInit() {
    AutoGUI.SetTextSize(20);
    //AutoGUI.SetPadding(0);
    //AutoGUI.SetBtnRadius(180);
    //AutoGUI.SetColor(COLOR_BLUE);
    //AutoGUI.SetColor(multiplyHexColor(COLOR_WHITE, 0.2));
    //AutoGUI.SetTextColor(COLOR_GREEN);
    this.indexPage = new UI();
    this.indexPage.init();

    this.BLE = new BLE();
    this.BLE.init(2);
    BLEMaster.SetDebugLevel(3);

    AppContext.MainUI = this.indexPage;
  },
  destroy() {
    Object.keys(this.BLE.connections).forEach((mac) => {
      if (!ble.quit(mac)) {
        console.log(`Failed to quit BLE connection for ${mac}`);
      }
    });
    this.indexPage.quit();
  },
});

class UI {
  init() {
    const gui = new AutoGUI();
    // add a text widget
    this.spd_txt = gui.text("Spd:");
    gui.newRow();
    this.vlt_txt = gui.text("Vlt:");
    gui.newRow();
    this.pwm_txt = gui.text("PWM:");
    gui.newRow();
    this.vehspd_txt = gui.text("VehSpd:");
    gui.newRow();
    this.vehdst_txt = gui.text("VehDst:");
    // split the row

    // finally render the GUI
    gui.render();
  }
  drawGUI() {
    this.mainView();
  }

  mainView() {}
}

class BLE {
  // initial setup
  init(expectedDeviceCount) {
    console.log("=========================================");
    console.log("Initializing BLE operations", Date.now());

    this.expectedDeviceCount = expectedDeviceCount;
    this.decoder = null; // Initialize decoder to null
    this.devices = {}; // mac (uppercased) → device_name
    this.connections = {}; // mac → { name, connected, decoder, notifChar}
    this.deviceQueue = []; // Queue of devices to connect to
    this.isConnecting = false; // Flag to track ongoing connections
    this.scan();
  }

  // the mac of a device you are connecting to
  scan() {
    console.log("Starting BLE scan...");
    const scan_success = ble.startScan(
      (scan_result) => {
        const device = ble.get.devices();
        const keys = Object.keys(device);

        for (let i = 0; i < keys.length; i++) {
          const device_mac = keys[i];
          const device_name = device[keys[i]].dev_name;

          if (this.connections[device_mac]?.connected) {
            console.log(
              `Already connected to ${device_name} (${device_mac}). Skipping.`
            );
            continue;
          }

          // Check if the device is already in the queue
          const isAlreadyInQueue = this.deviceQueue.some(
            (queuedDevice) => queuedDevice.mac === device_mac
          );

          if (isAlreadyInQueue) {
            console.log(
              `Device ${device_name} (${device_mac}) is already in the queue. Skipping.`
            );
            continue;
          }

          const deviceTypes = [
            { prefix: "LK", name: "LK EUC" },
            { prefix: "ENG", name: "Engo" },
            { prefix: "RVR", name: "Varia" },
          ];

          for (const { prefix, name } of deviceTypes) {
            if (device_name && device_name.startsWith(prefix)) {
              console.log(`${name} found, adding to queue:`, device_mac);
              this.deviceQueue.push({ mac: device_mac, name: device_name });

              // Stop scanning if we have enough devices
              if (this.deviceQueue.length >= this.expectedDeviceCount) {
                console.log("Expected devices found. Stopping scan.");
                ble.stopScan();
                this.processQueue(); // Start processing the connection queue
                return;
              }
              break;
            }
          }
        }
      },
      { allow_duplicates: true } // Ensure duplicates are allowed to keep scanning
    );

    if (!scan_success) {
      console.log("Failed to start BLE scan.");
    }
  }
  enableCharNotif() {
    console.log("All listeners started. Executing enableCharNotif...");
    for (const mac in this.connections) {
      const notifChar = this.connections[mac].notifChar;
      if (notifChar) {
        ble.write[mac].enableCharaNotifications(notifChar, true);

        ble.on[mac].descWriteComplete((chara, desc, status) => {
          console.log(`Returned status: ${status} for uuid: ${chara}`);
          if (status === 0) {
            console.log(`Notifications enabled for ${mac} (${chara})`);

            // Register notification handler after successful enable
            // I don't get this part. My understanding is hmble.mstOnCharaNotification is global (ie not returning notification per device but is rather a global notification handler).
            // I tried moving the charaNotification outside of the on class so it would be global but it doesn't work.
            // The following call will return notifications for all devices, regardless of specified mac adress (I removed the profile_pid filtering).
            // It's an ugly implementation but I can't make it work otherwise.
            ble.on[mac].charaNotification((uuid, data, length) => {
              /*
              console.log(
                `Notification received from ${mac}:`,
                uuid,
                ab2hex(data)
              );
             */
              // Handle notification data here
              if (uuid == LK_UUID_NOTIFY_CHAR) {
                if (!this.decoder) {
                  console.log("EUC decoder is not initialized.");
                  return;
                }

                //      n = n + 1;
                //console.log(ab2hex(data));
                const result = this.decoder.frameBuffer(data);
                if (!result) {
                  //  console.log("No valid frame received yet.");
                  return;
                }

                const { speed, hPWM, voltage } = result;
                this.updateUI(speed, hPWM, voltage);
              }
              if (uuid == VARIA_UUID_NOTIFY_CHAR) {
                let vehspd;
                let vehdst;
                const variaData = new Uint8Array(data);
                if (variaData.byteLength >= 4) {
                  vehspd = variaData[3];
                  vehdst = variaData[2];
                } else {
                  vehspd = "--";
                  vehdst = "--";
                }
                this.updateVariaUI(vehspd, vehdst);
              }
            });
          }
        });
      } else {
        console.log(`No notification char_uuid found for ${mac}`);
      }
    }
  }

  processQueue() {
    if (this.isConnecting || this.deviceQueue.length === 0) {
      // If no more devices in the queue and all listeners are active, call enableCharNotif
      if (
        this.deviceQueue.length === 0 &&
        Object.keys(this.connections).length >= this.expectedDeviceCount
      ) {
        console.log("All devices processed. Calling enableCharNotif...");
        this.enableCharNotif();
      }
      return;
    }

    const { mac, name } = this.deviceQueue.shift();
    this.isConnecting = true;

    console.log(`Connecting to device: ${name} (${mac})`);
    this.connect(mac, name);
  }

  connect(mac, name, attempt = 1, max_attempts = 30, delay = 1000) {
    if (this.connections[mac]?.connected) {
      console.log(`Already connected to ${name} (${mac}). Skipping.`);
      this.isConnecting = false;
      this.processQueue(); // Proceed to the next device in the queue
      return;
    }

    console.log("Connecting to:", name, mac);
    ble.connect(mac, (connect_result) => {
      console.log("Connect result:", JSON.stringify(connect_result));

      if (!connect_result.connected) {
        if (attempt < max_attempts) {
          console.log(
            `Attempt ${attempt} failed for ${name} (${mac}). Retrying in ${
              delay / 1000
            } seconds...`
          );
          setTimeout(
            () => this.connect(mac, name, attempt + 1, max_attempts, delay),
            delay
          );
        } else {
          console.log(
            `Connection failed for ${name} (${mac}). Max attempts reached.`
          );
          this.isConnecting = false;
          this.processQueue(); // Proceed to the next device in the queue
        }
      } else {
        console.log(`Connected to ${name} (${mac}).`);
        this.connections[mac] = {
          name,
          connected: true,
        };

        // Start listening for notifications
        if (name.startsWith("RVR")) {
          this.listen(mac, varia_services);
        } else if (name.startsWith("ENG")) {
          this.listen(mac, engo_services);
        } else if (name.startsWith("LK")) {
          //initialize the EUC decoder
          this.decoder = new LKDecoder();
          this.listen(mac, lk_services);
        }
      }
    });
  }

  listen(mac, services) {
    const profile_object = ble.generateProfileObject(services, mac);
    const service_uuid = Object.keys(services)[0];
    const notifChar = Object.keys(services[service_uuid])[0]; // note notifChar is the 1st char uuid!!
    console.log("setting up listener for ", mac, notifChar);
    this.connections[mac].notifChar = notifChar;
    ble.startListener(profile_object, mac, (response) => {
      if (response.success) {
        console.log(`Listener started for ${mac}`);
        //  const service_uuid = Object.keys(services)[0];
        // const char_uuid = Object.keys(services[service_uuid])[0];
        this.isConnecting = false;
        this.processQueue();
        /*
        console.log(`Enabling notifications for ${mac} (${char_uuid})`);

        ble.write[mac].enableCharaNotifications(char_uuid, true);

        ble.on[mac].descWriteComplete((chara, desc, status) => {
          console.log(`Returned status: ${status} for uuid: ${chara}`);
          if (status === 0) {
            console.log(`Notifications enabled for ${mac} (${chara})`);

            // Register notification handler after successful enable
            ble.on[mac].charaNotification((uuid, data, length) => {
              console.log(
                `Notification received from ${mac}:`,
                uuid,
                ab2hex(data)
              );
              const connection = this.connections[mac];
              // Handle notification data here
            });

            // Proceed to the next device in the queue
            this.isConnecting = false;
            this.processQueue();
          } else {
            console.log(`Failed to enable notifications for ${mac}`);
            this.isConnecting = false;
            this.processQueue(); // Proceed even if enabling notifications fails
          }
        });*/
      } else {
        console.log(`Failed to start listener for ${mac}:`, response.message);
        this.isConnecting = false;
        this.processQueue(); // Proceed to the next device in the queue
      }
    });
  }

  // Method to update the UI
  updateUI(speed, hPWM, voltage) {
    try {
      const ui = AppContext.MainUI;
      if (ui?.spd_txt?.update) {
        ui.spd_txt.update({ text: `Spd : ${speed}` });
      }
      if (ui?.pwm_txt?.update) {
        ui.pwm_txt.update({ text: `PWM : ${hPWM}` });
      }
      if (ui?.vlt_txt?.update) {
        ui.vlt_txt.update({ text: `Vlt : ${voltage}` });
      }
    } catch (error) {
      console.log("Error updating UI:", error);
    }
  }

  // Method to update the VariaUI
  updateVariaUI(vehspd, vehdst) {
    try {
      const ui = AppContext.MainUI;
      if (ui?.vehspd_txt.update) {
        ui.vehspd_txt.update({ text: `Vehspd : ${vehspd}` });
      }
      if (ui?.vehdst_txt?.update) {
        ui.vehdst_txt.update({ text: `Vehdst : ${vehdst}` });
      }
    } catch (error) {
      console.log("Error updating Varia UI:", error);
    }
  }
}
