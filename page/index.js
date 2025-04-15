import { getText } from "@zos/i18n";
import * as Styles from "zosLoader:./index.[pf].layout.js";
import AutoGUI from "@silver-zepp/autogui";
import BLEMaster, {
  PERMISSIONS,
  ab2hex,
  ab2num,
  ab2str,
} from "@silver-zepp/easy-ble";
import * as appService from "@zos/app-service";
import { queryPermission, requestPermission } from "@zos/app";
const { wdEvent } = getApp()._options.globalData;
const ble = new BLEMaster();
const AppContext = {
  MainUI: null,
  //LKDecoder: null,
};
import { setWakeUpRelaunch } from "@zos/display";
setWakeUpRelaunch({ relaunch: true });
let thisFile = "pages/index";
const serviceFile = "app-service/wd_ble";
const permissions = ["device:os.bg_service"];
const BLEDevicesNb = 3;
function permissionRequest(vm) {
  const [result2] = queryPermission({
    permissions,
  });

  if (result2 === 0) {
    requestPermission({
      permissions,
      callback([result2]) {
        if (result2 === 2) {
          startTimeService(vm);
        }
      },
    });
  } else if (result2 === 2) {
    startTimeService(vm);
  }
}
function startTimeService(vm) {
  console.log(`=== start service: ${serviceFile} ===`);
  const result = appService.start({
    url: serviceFile,
    param: `service=${serviceFile}&action=start`,
    complete_func: (info) => {
      console.log(`startService result: ` + JSON.stringify(info));
    },
  });

  if (result) {
    console.log("startService result: ", result);
  }
}

function stopTimeService(vm) {
  console.log(`=== stop service: ${serviceFile} ===`);
  appService.stop({
    url: serviceFile,
    param: `service=${serviceFile}&action=stop`,
    complete_func: (info) => {
      console.log(`stopService result: ` + JSON.stringify(info));

      // refresh for button status
    },
  });
}

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
    this.BLE.init(BLEDevicesNb);
    BLEMaster.SetDebugLevel(3);

    AppContext.MainUI = this.indexPage;
  },
  build() {
    const vm = this;
    let services = appService.getAllAppServices();
    vm.state.running = services.includes(serviceFile);

    console.log("service status %s", vm.state.running);
    permissionRequest(vm);
  },
  destroy() {
    stopTimeService(vm);
    /*
    Object.keys(this.BLE.connections).forEach((mac) => {
      if (!ble.quit(mac)) {
        console.log(`Failed to quit BLE connection for ${mac}`);
      }
    });
    this.indexPage.quit();
    */
  },
});
class BLE {
  init(expectedDeviceCount) {
    // this.connections = {};
    this.deviceQueue = [];
    this.expectedDeviceCount = expectedDeviceCount; // Set the expected number of devices

    this.scan();
  }
  scan() {
    console.log("Starting BLE scan...");
    const scan_success = ble.startScan(
      (scan_result) => {
        const device = ble.get.devices();
        const keys = Object.keys(device);

        for (let i = 0; i < keys.length; i++) {
          const device_mac = keys[i];
          const device_name = device[keys[i]].dev_name;
          /*
          if (this.connections[device_mac]?.connected) {
            console.log(
              `Already connected to ${device_name} (${device_mac}). Skipping.`
            );
            continue;
          }
*/
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
                wdEvent.emit("deviceQueue", this.deviceQueue);
                //   this.processQueue(); // Start processing the connection queue
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
}
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
    this.checkForUpdate();
  }
  drawGUI() {
    this.mainView();
  }

  mainView() {}
  checkForUpdate() {
    wdEvent.on("EUCData", (result) => {
      const { speed, hPWM, voltage } = result;
      this.updateUI(speed, hPWM, voltage);
    });

    wdEvent.on("variaData", (result) => {
      const { vehdst, vehspd } = result;
      this.updateVariaUI(vehspd, vehdst);
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
