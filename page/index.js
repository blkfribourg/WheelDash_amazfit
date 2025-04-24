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
import ExitConfirmation from "../utils/ExitConfirmation";
import CurrentTime from "../utils/CurrentTime";
import Alarm from "../utils/Alarm";
import { exit } from "@zos/router";
import { createWidget, widget, align } from "@zos/ui";

const { wdEvent } = getApp()._options.globalData;
const ble = new BLEMaster();
const AppContext = {
  MainUI: null,
  //LKDecoder: null,
};

import { onKey, KEY_UP, KEY_EVENT_CLICK } from "@zos/interaction";

onKey({
  callback: (key, keyEvent) => {
    console.log("KEY EVENT: ", key, keyEvent);
    if (key === 36 && keyEvent === 1) {
      // HOME BUTTON ACTIVE2
      console.log("Exit app confirmation");
      const exitDialog = new ExitConfirmation(() => {
        console.log("Exit app");
        exitService();
        AppContext.MainUI = null;
        exit();
      });
      exitDialog.showExitConfirmation();
    }
    return true;
  },
});

let thisFile = "pages/index";
const serviceFile = "app-service/wd_ble";
const permissions = ["device:os.bg_service"];
const BLEDevicesNb = 1;
function permissionRequest(vm) {
  const [result2] = queryPermission({
    permissions,
  });

  if (result2 === 0) {
    requestPermission({
      permissions,
      callback([result2]) {
        if (result2 === 2) {
          startService(vm);
        }
      },
    });
  } else if (result2 === 2) {
    startService();
  }
}
function startService() {
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

function stopService() {
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
function exitService() {
  stopService();
  console.log(`=== exit service: ${serviceFile} ===`);
  appService.exit();
}
Page({
  onInit() {
    console.log("sandbox----------------------------------------");
    const alarmMonitor = new Alarm();
    console.log("end of sandbox---------------------------------");

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
  onDestroy() {
    console.log("Page onDestroy");
  },
});
class BLE {
  init(expectedDeviceCount) {
    // this.connections = {};
    this.deviceQueue = [];
    this.expectedDeviceCount = expectedDeviceCount; // Set the expected number of devices
    // wdEvent.emit("deviceQueue", { mac: "00:01:02:03:04:05", name: "LK0203" });
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
    this.time = createWidget(widget.TEXT, {
      x: 180,
      y: 80,
      w: 100,
      h: 50,
      text: new CurrentTime().getCurrentTime(),
      color: 0xffffff,
      text_size: 30,
      align_h: align.CENTER_H,
    });
    setInterval(() => {
      if (this.time) {
        //console.log("Time update");
        this.time.text = new CurrentTime().getCurrentTime(); // or this.time = new Date();
      }
    }, 1000);
    this.spd = createWidget(widget.TEXT, {
      x: 155,
      y: 140,
      w: 150,
      h: 150,
      text: "--",
      color: 0x999999,
      text_size: 130,
      align_h: align.CENTER_H,
    });
    this.batVal = createWidget(widget.TEXT, {
      x: 80,
      y: 310,
      w: 80,
      h: 50,
      text: "--%",
      color: 0x999999,
      text_size: 30,
      align_h: align.LEFT,
    });
    this.tempVal = createWidget(widget.TEXT, {
      x: 305,
      y: 310,
      w: 80,
      h: 50,
      text: "--°C",
      color: 0x999999,
      text_size: 30,
      align_h: align.RIGHT,
    });

    this.PWMArc_bg = createWidget(widget.ARC, {
      x: 27.5,
      y: 27.5,
      w: 410,
      h: 410,
      radius: 0,
      color: 0x333333,
      start_angle: 150,
      end_angle: 390,
      line_width: 25,
    });
    this.PWMArc = createWidget(widget.ARC, {
      x: 27.5,
      y: 27.5,
      w: 410,
      h: 410,
      radius: 0,
      color: 0x999999,
      start_angle: 150,
      end_angle: 150,
      line_width: 25,
    });

    this.batArc_bg = createWidget(widget.ARC, {
      x: 62.5,
      y: 62.5,
      w: 340,
      h: 340,
      radius: 0,
      color: 0x333333,
      start_angle: 150,
      end_angle: 220,
      line_width: 25,
    });
    this.batArc = createWidget(widget.ARC, {
      x: 62.5,
      y: 62.5,
      w: 340,
      h: 340,
      radius: 0,
      color: 0x999999,
      start_angle: 150,
      end_angle: 150,
      line_width: 25,
    });

    this.tempArc_bg = createWidget(widget.ARC, {
      x: 62.5,
      y: 62.5,
      w: 340,
      h: 340,
      radius: 0,
      color: 0x333333,
      start_angle: 390,
      end_angle: 320,
      line_width: 25,
    });
    this.tempArc = createWidget(widget.ARC, {
      x: 62.5,
      y: 62.5,
      w: 340,
      h: 340,
      radius: 0,
      color: 0x999999,
      start_angle: 390,
      end_angle: 390,
      line_width: 25,
    });

    /*
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
*/
    this.checkForUpdate();
  }

  computeArcAngle(value, max, arc, reverse) {
    const range = arc.end_angle - arc.start_angle;
    let ratio = value / max;
    if (reverse) {
      ratio = -ratio;
    }
    const angle = arc.start_angle + range * ratio;
    return angle;
  }

  drawGUI() {
    this.mainView();
  }

  mainView() {}
  checkForUpdate() {
    wdEvent.on("EUCPaired", (isPaired) => {
      console.log("EUCPaired event received:", isPaired);
      this.isEUCConnected(isPaired);
    });
    wdEvent.on("EUCData", (result) => {
      // console.log(JSON.stringify(result));
      const { hPWM, speed, temperature, battery } = result;
      this.updateUI(hPWM, speed, temperature, battery);
    });

    wdEvent.on("variaData", (result) => {
      /*
      const { vehdst, vehspd } = result;
      this.updateVariaUI(vehspd, vehdst);
      */
    });
  }
  isEUCConnected(isPaired) {
    const ui = AppContext.MainUI;
    if (isPaired === true) {
      ui.spd.color = 0xffffff;
      ui.PWMArc.color = 0x3366cc;
      ui.tempArc.color = 0x58ba1a;
      ui.batArc.color = 0x58ba1a;
    } else {
      ui.spd.color = 0x999999;
      ui.PWMArc.color = 0x999999;
      ui.tempArc.color = 0x999999;
      ui.batArc.color = 0x999999;
    }
  }
  // Method to update the UI
  updateUI(hPWM, speed, temperature, battery) {
    try {
      const ui = AppContext.MainUI;
      //console.log("speed", speed);
      const speedText =
        speed !== undefined && speed !== null ? Math.round(speed) : "--";
      //  console.log("speedText", speedText);
      const tempText =
        temperature !== undefined && temperature !== null
          ? Math.round(temperature)
          : "--";
      const batteryText =
        battery !== undefined && battery !== null ? Math.round(battery) : "--";
      ui.spd.text = speedText.toString();
      ui.batVal.text = batteryText + " %";
      ui.tempVal.text = tempText + " °C";

      ui.PWMArc.end_angle = this.computeArcAngle(
        hPWM,
        100,
        ui.PWMArc_bg,
        false
      );
      ui.tempArc.end_angle = this.computeArcAngle(
        temperature,
        100,
        ui.tempArc_bg,
        false
      );
      ui.batArc.end_angle = this.computeArcAngle(
        battery,
        100,
        ui.batArc_bg,
        false
      );
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
