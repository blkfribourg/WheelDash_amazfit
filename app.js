import { EventBus } from "@zos/utils";
import { setWakeUpRelaunch } from "@zos/display";

App({
  globalData: {
    wdEvent: new EventBus(),
    bleDevices: [],
  },
  onCreate(options) {
    console.log("app on create invoke");
    setWakeUpRelaunch({ relaunch: true });
  },

  onDestroy(options) {
    console.log("app on destroy invoke");
    setWakeUpRelaunch({ relaunch: false });
  },
});
