const { wdEvent } = getApp()._options.globalData;
import { setPageBrightTime } from "@zos/display";
import { Vibrator, VIBRATOR_SCENE_DURATION } from "@zos/sensor";
import { SoundPlayer } from "@silver-zepp/easy-media";
export default class Alarm {
  constructor() {
    this.PWM_thr = 0; // threshold for PWM alarm
    this.speed_thr = 0; // threshold for speed alarm
    this.temp_thr = 0; // threshold for temperature alarm
    console.log("=== starting alarm player ===");
    this.player = new SoundPlayer();
    this.vibrator = new Vibrator();
    this.vibrator.setMode(VIBRATOR_SCENE_DURATION);
    wdEvent.on("EUCData", (result) => {
      this.alarmOnCondition(result);
    });
  }

  playPWMAlarm() {
    this.player.play("assets://raw/alarms/PWM.mp3");
  }
  playSpeedAlarm() {
    this.player.play("assets://raw/alarms/Speed.mp3");
  }
  playTempAlarm() {
    this.player.play("assets://raw/alarms/Temperature.mp3");
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
        this.playPWMAlarm();
        // console.log("=== PWM alarm ===");
        if (!this.alarmInterval) {
          this.alarmInterval = setInterval(() => {
            this.playPWMAlarm();
            this.vibrator.start();
          }, 1000);
        }
        break;
      case temperature >= this.temp_thr:
        setPageBrightTime({
          brightTime: 1000,
        });
        this.playTempAlarm();
        // console.log("=== PWM alarm ===");
        if (!this.alarmInterval) {
          this.alarmInterval = setInterval(() => {
            this.playTempAlarm();
            this.vibrator.start();
          }, 10000);
        }
        break;
      case speed >= this.speed_thr:
        setPageBrightTime({
          brightTime: 1000,
        });
        this.playSpeedAlarm();

        if (!this.pwmSpeedInterval) {
          this.pwmSpeedInterval = setInterval(() => {
            this.playSpeedAlarm();
            this.vibrator.start();
          }, 5000);
        }
        break;
      default:
        if (this.alarmInterval) {
          clearInterval(this.alarmInterval);
          this.alarmInterval = null;
          this.player.stop();
          this.vibrator.stop();
        }
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
