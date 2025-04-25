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
import { back, exit } from "@zos/router";
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
    if (key === 93 && keyEvent === 1) {
      back(); //go to main
    }
    return true;
  },
});

const fakeRes = { hPWM: 3, speed: 23, temperature: 45, battery: 50 };
Page({
  onInit() {
    console.log("MenuInit----------------------------------------");

    console.log("MenuInit----------------------------------------");

    this.menuPage = new UI();
    this.menuPage.init();

    //this.BLE = new BLE();

    // this.BLE.init(BLEDevicesNb);
    // BLEMaster.SetDebugLevel(3);

    AppContext.MainUI = this.indexPage;
  },

  onDestroy() {
    console.log("Menu onDestroy");
  },
});
class BLE {
  init() {
    // this.connections = {};
    this.deviceQueue = [];

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
    createWidget(widget.BUTTON, {
      x: 0,
      y: 0,
      w: 480,
      h: 80,
      text: "Connect Menu",
      textSize: 30,
    });
    const viewContainer = createWidget(widget.VIEW_CONTAINER, {
      x: 0,
      y: 80,
      w: 480,
      h: 320,
    });
    const itemNb = 10;
    const gap = 10;
    for (i = 0; i < itemNb; i++) {
      const group = viewContainer.createWidget(widget.GROUP, {
        x: 70,
        y: gap * i + i * 80,
        w: 330,
        h: 80,
        text: "LK000\n" + i,
        textSize: 25,
        radius: 10,
        normal_color: 0x333333,
        press_color: 0x0986d4,
      });
      group.createWidget(widget.FILL_RECT, {
        x: 0,
        y: 0,
        w: 330,
        h: 80,
        color: 0x333333,
        radius: 20,
      });
      group.createWidget(widget.TEXT, {
        x: 10,
        y: 10,
        w: 330,
        h: 80,
        text: "EUC\nName: Yadayada" + i,
        color: 0xffffff,
      });
      group.createWidget(widget.SLIDE_SWITCH, {
        x: 250,
        y: 21,
        w: 59,
        h: 40,
        select_bg: "switch_on.png",
        un_select_bg: "switch_off.png",
        slide_src: "radio_select.png",
        slide_select_x: 28,
        slide_un_select_x: 8,
      });
    }
    // Creating UI sub-widgets

    //   this.viewContainer = createWidget(widget.VIEW_CONTAINER, Param);
  }
}
