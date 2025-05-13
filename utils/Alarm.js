const { wdEvent } = getApp()._options.globalData;
import { setPageBrightTime } from "@zos/display";
import { Vibrator, VIBRATOR_SCENE_DURATION } from "@zos/sensor";
import { SoundPlayer } from "@silver-zepp/easy-media";
import { SystemSounds } from "@zos/sensor";
export default class Alarm {
  constructor() {
    this.alarmType = "";
    this.PWM_thr = 70; // threshold for PWM alarm
    this.speed_thr = 25; // threshold for speed alarm
    this.temp_thr = 40; // threshold for temperature alarm
    //  console.log("=== starting alarm player ===");
    this.systemSounds = new SystemSounds();

    //this.player = new SoundPlayer();
    this.vibrator = new Vibrator();
    this.vibrator.setMode(VIBRATOR_SCENE_DURATION);
    wdEvent.on("EUCData", (result) => {
      this.alarmOnCondition(result);
    });
  }

  playPWMAlarm() {
    // this.player.play("assets://raw/alarms/PWM.mp3");
    const alarmType = this.systemSounds.getSourceType().SOS;
    this.systemSounds.start(alarmType);
  }
  playSpeedAlarm() {
    //  this.player.play("assets://raw/alarms/Speed.mp3");
    const alarmType = this.systemSounds.getSourceType().ABN_LOW;
    this.systemSounds.start(alarmType);
  }
  playTempAlarm() {
    // this.player.play("assets://raw/alarms/Temperature.mp3");
    const alarmType = this.systemSounds.getSourceType().ABN_HIGH;
    this.systemSounds.start(alarmType);
  }

  alarmOnCondition(result) {
    //PWM alarm
    //   console.log("=== check alarm ===");
    const { hPWM, speed, temperature } = result;
    switch (true) {
      case hPWM >= this.PWM_thr:
        setPageBrightTime({
          brightTime: 1000,
        });
        if (!this.PWMAlarmInterval || this.alarmType != "PWM") {
          this.clearAlarms();
          this.playPWMAlarm();
          this.PWMAlarmInterval = setInterval(() => {
            this.playPWMAlarm();
            this.vibrator.start();
          }, 1000);
        }
        this.alarmType = "PWM";
        break;
      case temperature >= this.temp_thr:
        setPageBrightTime({
          brightTime: 1000,
        });
        if (!this.tempAlarmInterval || this.alarmType != "Temperature") {
          this.clearAlarms();
          this.playTempAlarm();
          this.tempAlarmInterval = setInterval(() => {
            this.playTempAlarm();
            this.vibrator.start();
          }, 10000);
        }
        this.alarmType = "Temperature";
        break;
      case speed >= this.speed_thr:
        setPageBrightTime({
          brightTime: 1000,
        });
        if (!this.speedAlarmInterval || this.alarmType != "Speed") {
          this.clearAlarms();
          this.playSpeedAlarm();
          this.speedAlarmInterval = setInterval(() => {
            this.playSpeedAlarm();
            this.vibrator.start();
          }, 5000);
        }
        this.alarmType = "Speed";
        break;
      default:
        this.clearAlarms();
        break;
    }

    /*
    if (hPWM >= this.PWM_thr) {
      setPageBrightTime({
        brightTime: 1000,
      });
      this.playPWMAlarm();
      // console.log("=== PWM alarm ===");
      if (!this.pwmAlarmInterval) {
        this.pwmAlarmInterval = setInterval(() => {
          this.playPWMAlarm();
          this.vibrator.start();
        }, 1000);
      }
    } else {
      if (this.pwmAlarmInterval) {
        clearInterval(this.pwmAlarmInterval);
        this.pwmAlarmInterval = null;
        this.player.stop();
        this.vibrator.stop();
      }
    }*/
  }
  clearAlarms() {
    if (this.PWMAlarmInterval) {
      clearInterval(this.PWMAlarmInterval);
      this.PWMAlarmInterval = null;
      this.systemSounds.stop();
      //   this.player.stop();
      this.vibrator.stop();
    }
    if (this.tempAlarmInterval) {
      clearInterval(this.tempAlarmInterval);
      this.tempAlarmInterval = null;
      //   this.player.stop();
      this.systemSounds.stop();
      this.vibrator.stop();
    }
    if (this.speedAlarmInterval) {
      clearInterval(this.speedAlarmInterval);
      this.speedAlarmInterval = null;
      //   this.player.stop();
      this.systemSounds.stop();
      this.vibrator.stop();
    }
  }
}

/*

import { create, id } from "@zos/media";
const { wdEvent } = getApp()._options.globalData;
export default class Alarm {
  constructor() {
    this.player = create(id.PLAYER);
    this.PWM_thr = 30; // threshold for PWM alarm
    this.isPrepared = false;
    this.isPlaying = false;
    wdEvent.on("EUCData", (result) => {
      this.alarmOnCondition(result);
    });

    this.player.addEventListener(this.player.event.PREPARE, (result) => {
      if (result) {
        console.log("=== prepare succeed ===");
        this.isPrepared = true;
        // this.player.start();
        //  this.isPlaying = true;
      } else {
        console.log("=== prepare fail ===");
        this.player.release();
        this.isPrepared = false;
        //  this.isPlaying = false;
      }
    });

    this.player.addEventListener(this.player.event.COMPLETE, () => {
      console.log("=== play end ===");
      //   this.isPlaying = false;
      // Do not release here, only on alarm end
    });
  }

  playPWMAlarm() {
    if (!this.isPrepared) {
      this.player.setSource(this.player.source.FILE, {
        file: "raw/alarms/PWM.mp3",
      });
      this.player.prepare();
      // start() will be called in PREPARE event
    } else {
      console.log("=== play start (or trying) ===");
      this.player.start();
      // this.isPlaying = true;
    }
  }

  alarmOnCondition(result) {
    //PWM alarm
    const { hPWM } = result;
    if (hPWM < this.PWM_thr) {
      if (!this.pwmAlarmInterval) {
        console.log("=== PWM alarm ===");
        this.playPWMAlarm();
        this.pwmAlarmInterval = setInterval(() => {
          if (hPWM < this.PWM_thr) {
            this.playPWMAlarm();
          } else {
            clearInterval(this.pwmAlarmInterval);
            this.pwmAlarmInterval = null;
          }
        }, 1000);
      }
    } else {
      if (this.pwmAlarmInterval) {
        clearInterval(this.pwmAlarmInterval);
        this.pwmAlarmInterval = null;
        this.player.stop();
        this.player.release();
        this.isPrepared = false;
        //  this.isPlaying = false;
      }
    }
  }
}
*/
